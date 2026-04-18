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
                    const loginData = (await request.json()) as any;
                    const result = await api.login(loginData as LoginRequest);
                    return Response.json(result);
                }

                // 数据库初始化
                if (path === "init" && method === "GET") {
                    const initResult = await api.initDB();
                    return new Response(initResult.alreadyInitialized ? "Already Initialized" : "Success");
                }

                // 获取分组
                if (path === "groups" && method === "GET") {
                    const groups = await api.getGroups();
                    return Response.json(groups);
                }

                // 核心：数据导入接口
                if (path === "import" && method === "POST") {
                    const data = (await request.json()) as ExportData;
                    const result = await api.importData(data);
                    return Response.json(result);
                }

                return new Response("API Path Not Found", { status: 404 });
            } catch (error) {
                console.error(`API Error: ${error}`);
                return new Response(`Internal Server Error`, { status: 500 });
            }
        }

        // --- 2. 应急恢复界面（当数据库为空或访问首页时显示） ---
        return new Response(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>乐影导航站 - 恢复模式</title>
            <style>
                body { font-family: -apple-system, system-ui, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 90%; max-width: 400px; text-align: center; }
                h2 { color: #1a73e8; margin-bottom: 10px; }
                p { color: #5f6368; font-size: 14px; margin-bottom: 20px; }
                input[type="file"] { border: 2px dashed #dadce0; padding: 20px; width: 100%; box-sizing: border-box; border-radius: 8px; margin-bottom: 20px; cursor: pointer; }
                button { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; transition: background 0.2s; }
                button:hover { background: #1557b0; }
                #s { margin-top: 15px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>乐影导航站恢复模式</h2>
                <p>检测到数据库为空，请上传您的备份文件：</p>
                <input type="file" id="f" accept=".json">
                <button onclick="doImport()">立即恢复数据</button>
                <div id="s"></div>
            </div>
            <script>
                async function doImport() {
                    const fileInput = document.getElementById('f');
                    const status = document.getElementById('s');
                    if (!fileInput.files.length) return alert('请先选择 JSON 备份文件');
                    
                    status.style.color = '#1a73e8';
                    status.innerText = '正在导入并重构数据库...';
                    
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const res = await fetch('/api/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: e.target.result
                            });
                            if (res.ok) {
                                status.style.color = '#34a853';
                                status.innerText = '✅ 恢复成功！2秒后自动跳转...';
                                setTimeout(() => window.location.href = '/', 2000);
                            } else {
                                status.style.color = '#d93025';
                                status.innerText = '❌ 导入失败，请检查文件格式';
                            }
                        } catch (err) {
                            status.style.color = '#d93025';
                            status.innerText = '❌ 网络请求错误';
                        }
                    };
                    reader.readAsText(fileInput.files[0]);
                }
            </script>
        </body>
        </html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
} satisfies ExportedHandler;

// --- 3. 必须的类型定义（防止 GitHub 报错） ---
interface Env {
    DB: D1Database;
    AUTH_ENABLED?: string;
    AUTH_USERNAME?: string;
    AUTH_PASSWORD?: string;
    AUTH_SECRET?: string;
}

interface ExportedHandler {
    fetch(request: Request, env: Env): Promise<Response>;
}

interface D1Database {
    prepare(query: string): any;
    exec(query: string): Promise<any>;
}
