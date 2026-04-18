import {
    NavigationAPI,
    type LoginRequest,
    type ExportData,
    type Group,
    type Site,
} from "../src/API/http";

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);

        // --- 1. API 路由处理 ---
        if (url.pathname.startsWith("/api/")) {
            const path = url.pathname.replace("/api/", "");
            const method = request.method;

            try {
                const api = new NavigationAPI(env);

                // 登录路由
                if (path === "login" && method === "POST") {
                    const loginData = (await request.json()) as LoginInput;
                    const result = await api.login(loginData as LoginRequest);
                    return Response.json(result);
                }

                // 初始化数据库
                if (path === "init" && method === "GET") {
                    const initResult = await api.initDB();
                    return new Response(initResult.alreadyInitialized ? "已初始化" : "初始化成功");
                }

                // 这里的 API 逻辑保持原样...
                if (path === "groups" && method === "GET") {
                    return Response.json(await api.getGroups());
                }
                
                if (path === "import" && method === "POST") {
                    const data = (await request.json()) as ExportData;
                    const result = await api.importData(data);
                    return Response.json(result);
                }

                return new Response("API Not Found", { status: 404 });
            } catch (error) {
                return new Response(`Server Error`, { status: 500 });
            }
        }

        // --- 2. 前端界面处理（解决乱码的关键） ---
        
        // 构建一个极简的后台管理 HTML，确保你永远能看到“导入按钮”
        const adminHtml = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>乐影导航站 - 管理后台</title>
            <style>
                body { font-family: system-ui; background: #f4f4f9; display: flex; justify-content: center; padding-top: 50px; }
                .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
                h1 { font-size: 1.5rem; color: #333; }
                .btn { background: #0070f3; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 1rem; margin-top: 10px; }
                input[type="file"] { margin: 20px 0; border: 1px dashed #ccc; padding: 20px; width: 100%; box-sizing: border-box; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 导航站数据恢复</h1>
                <p>请选择你的 JSON 备份文件进行导入：</p>
                <input type="file" id="fileInput" accept=".json">
                <button class="btn" onclick="handleImport()">立即导入数据</button>
                <div id="status" style="margin-top:15px; font-size:0.9rem;"></div>
            </div>

            <script>
                async function handleImport() {
                    const fileInput = document.getElementById('fileInput');
                    const status = document.getElementById('status');
                    if (!fileInput.files.length) return alert('请先选择文件');
                    
                    status.innerText = '正在导入...';
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const data = JSON.parse(e.target.result);
                            const res = await fetch('/api/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            if (res.ok) {
                                status.style.color = 'green';
                                status.innerText = '✅ 导入成功！正在跳转首页...';
                                setTimeout(() => window.location.href = '/', 2000);
                            } else {
                                throw new Error('导入失败');
                            }
                        } catch (err) {
                            status.style.color = 'red';
                            status.innerText = '❌ 错误: ' + err.message;
                        }
                    };
                    reader.readAsText(fileInput.files[0]);
                }
            </script>
        </body>
        </html>`;

        // 如果访问的是 /admin 或首页，直接显示这个导入界面（直到你导完数据为止）
        return new Response(adminHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    },
} satisfies ExportedHandler;

// --- 3. 类型定义（保持不变） ---
interface Env {
    DB: D1Database;
    AUTH_ENABLED?: string;
    AUTH_USERNAME?: string;
    AUTH_PASSWORD?: string;
    AUTH_SECRET?: string;
}

interface LoginInput { username?: string; password?: string; rememberMe?: boolean; }
interface ExportedHandler { fetch(request: Request, env: Env): Promise<Response>; }
interface D1Database { prepare(query: string): any; exec(query: string): any; }
