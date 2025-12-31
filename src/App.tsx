import { useState, useEffect, useMemo } from 'react';
import { NavigationClient } from './API/client';
import { MockNavigationClient } from './API/mock';
import { Site, Group } from './API/http';
import { GroupWithSites } from './types';
import ThemeToggle from './components/ThemeToggle';
import GroupCard from './components/GroupCard';
import LoginForm from './components/LoginForm';
import './App.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableGroupItem from './components/SortableGroupItem';
// Material UI 导入
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  createTheme,
  ThemeProvider,
  CssBaseline,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Snackbar,
  InputAdornment,
  Slider,
  List,
  ListItem,
  ListItemButton,
  InputBase,
  Chip,
  Fab,
  Zoom,
  useScrollTrigger,
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import GitHubIcon from '@mui/icons-material/GitHub';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';

// 根据环境选择使用真实API还是模拟API
const isDevEnvironment = import.meta.env.DEV;
const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';

const api =
  isDevEnvironment && !useRealApi
    ? new MockNavigationClient()
    : new NavigationClient(isDevEnvironment ? 'http://localhost:8788/api' : '/api');

// 排序模式枚举
enum SortMode {
  None, // 不排序
  GroupSort, // 分组排序
  SiteSort, // 站点排序
}

// 搜索引擎配置
const SEARCH_ENGINES = [
  { key: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
  { key: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=' },
  { key: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { key: 'github', name: 'Github', url: 'https://github.com/search?q=' },
  { key: 'site', name: '站内', url: '' },
];

// 辅助函数：提取域名
function extractDomain(url: string): string | null {
  if (!url) return null;

  try {
    // 尝试自动添加协议头，如果缺少的话
    let fullUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      fullUrl = 'http://' + url;
    }
    const parsedUrl = new URL(fullUrl);
    return parsedUrl.hostname;
  } catch {
    // 尝试备用方法
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im);
    return match && match[1] ? match[1] : url;
  }
}

// 默认配置
const DEFAULT_CONFIGS = {
  'site.title': '导航站',
  'site.name': '导航站',
  'site.customCss': '',
  'site.backgroundImage': '', // 背景图片URL
  'site.backgroundOpacity': '0.15', // 背景蒙版透明度
  'site.iconApi': 'https://www.faviconextractor.com/favicon/{domain}?larger=true', // 默认使用的API接口
};

// 网站开始运行的时间 (请在这里修改为你的建站日期)
const SITE_START_DATE = '2024-01-01';

function App() {
  // 主题模式状态
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 创建Material UI主题
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode]
  );

  // 切换主题的回调函数
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
  };

  const [groups, setGroups] = useState<GroupWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(SortMode.None);
  const [currentSortingGroupId, setCurrentSortingGroupId] = useState<number | null>(null);

  // 搜索相关状态
  const [searchEngine, setSearchEngine] = useState('google');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 仪表盘信息状态 (日期、一言、天气)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hitokoto, setHitokoto] = useState('生活明朗，万物可爱');
  const [weather, setWeather] = useState('');
  
  // 运行天数状态
  const [runDays, setRunDays] = useState(0);

  // 新增认证状态
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // 配置状态
  const [configs, setConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);
  const [openConfig, setOpenConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);

  // 配置传感器，支持鼠标、触摸和键盘操作
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // 降低激活阈值，使拖拽更敏感
        delay: 0, // 移除延迟
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100, // 降低触摸延迟
        tolerance: 3, // 降低容忍值
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 新增状态管理
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [openAddSite, setOpenAddSite] = useState(false);
  const [newGroup, setNewGroup] = useState<Partial<Group>>({ name: '', order_num: 0 });
  const [newSite, setNewSite] = useState<Partial<Site>>({
    name: '',
    url: '',
    icon: '',
    description: '',
    notes: '',
    order_num: 0,
    group_id: 0,
  });

  // 新增菜单状态
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(menuAnchorEl);

  // 新增导入对话框状态
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // 错误提示框状态
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // 导入结果提示框状态
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');

  // 滚动触发器
  const scrollTrigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  const handleScrollTop = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (
      (event.target as HTMLDivElement).ownerDocument || document
    ).querySelector('#back-to-top-anchor');

    if (anchor) {
      anchor.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  };

  // 初始化加载：日期、一言、天气、统计脚本
  useEffect(() => {
    // 1. 启动时钟
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 2. 计算运行天数
    const start = new Date(SITE_START_DATE).getTime();
    const now = new Date().getTime();
    const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    setRunDays(days > 0 ? days : 1);

    // 3. 加载不蒜子统计脚本 (动态加载)
    const script = document.createElement('script');
    script.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
    script.async = true;
    script.referrerPolicy = 'unsafe-url'; // 解决部分referrer问题
    document.body.appendChild(script);

    // 4. 获取一言
    fetch('https://v1.hitokoto.cn/?c=i&c=d&c=k')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.hitokoto) {
          setHitokoto(data.hitokoto);
        }
      })
      .catch((e) => console.error('Hitokoto fetch failed', e));

    // 5. 获取简单天气
    fetch('https://wttr.in/?format=3')
      .then((res) => {
        if (res.ok) return res.text();
        throw new Error('Weather request failed');
      })
      .then((text) => setWeather(text.trim()))
      .catch((e) => console.error('Weather fetch failed', e));

    return () => {
      clearInterval(timer);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // 格式化日期显示
  const formattedDate = useMemo(() => {
    const date = currentTime;
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }, [currentTime]);

  // 计算过滤后的分组（用于站内搜索）
  const filteredGroups = useMemo(() => {
    if (searchEngine === 'site' && searchKeyword.trim()) {
      const lowerKeyword = searchKeyword.toLowerCase().trim();
      return groups
        .map((group) => {
          const matchingSites = group.sites.filter(
            (site) =>
              site.name.toLowerCase().includes(lowerKeyword) ||
              site.url.toLowerCase().includes(lowerKeyword) ||
              (site.description && site.description.toLowerCase().includes(lowerKeyword))
          );
          if (group.name.toLowerCase().includes(lowerKeyword) || matchingSites.length > 0) {
            return {
              ...group,
              sites: matchingSites,
            };
          }
          return null;
        })
        .filter((group): group is GroupWithSites => group !== null);
    }
    return groups;
  }, [groups, searchEngine, searchKeyword]);

  // 处理搜索提交
  const handleSearch = () => {
    if (!searchKeyword.trim()) return;

    const engine = SEARCH_ENGINES.find((e) => e.key === searchEngine);
    if (engine && engine.key !== 'site') {
      window.open(engine.url + encodeURIComponent(searchKeyword), '_blank');
    }
  };

  // 菜单打开关闭
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      setIsAuthChecking(true);
      const result = await api.checkAuthStatus();
      if (!result) {
        if (api.isLoggedIn()) api.logout();
        setIsAuthenticated(false);
        setIsAuthRequired(true);
      } else {
        setIsAuthenticated(true);
        setIsAuthRequired(false);
        await fetchData();
        await fetchConfigs();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('认证')) {
        setIsAuthenticated(false);
        setIsAuthRequired(true);
      }
    } finally {
      setIsAuthChecking(false);
    }
  };

  // 登录功能
  const handleLogin = async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoginLoading(true);
      setLoginError(null);
      const success = await api.login(username, password, rememberMe);
      if (success) {
        setIsAuthenticated(true);
        setIsAuthRequired(false);
        await fetchData();
        await fetchConfigs();
      } else {
        handleError('用户名或密码错误');
        setIsAuthenticated(false);
      }
    } catch (error) {
      handleError('登录失败: ' + (error instanceof Error ? error.message : '未知错误'));
      setIsAuthenticated(false);
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出功能
  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setIsAuthRequired(true);
    setGroups([]);
    handleMenuClose();
    setError('已退出登录，请重新登录');
  };

  // 加载配置
  const fetchConfigs = async () => {
    try {
      const configsData = await api.getConfigs();
      setConfigs({ ...DEFAULT_CONFIGS, ...configsData });
      setTempConfigs({ ...DEFAULT_CONFIGS, ...configsData });
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  }, []);

  useEffect(() => {
    document.title = configs['site.title'] || '导航站';
  }, [configs]);

  useEffect(() => {
    const customCss = configs['site.customCss'];
    let styleElement = document.getElementById('custom-style');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style';
      document.head.appendChild(styleElement);
    }
    const sanitizedCss = sanitizeCSS(customCss || '');
    styleElement.textContent = sanitizedCss;
  }, [configs]);

  const sanitizeCSS = (css: string): string => {
    if (!css) return '';
    return css
      .replace(/url\s*\(\s*(['"]?)javascript:/gi, 'url($1invalid:')
      .replace(/expression\s*\(/gi, 'invalid(')
      .replace(/@import/gi, '/* @import */')
      .replace(/behavior\s*:/gi, '/* behavior: */')
      .replace(/content\s*:\s*(['"]?).*?url\s*\(\s*(['"]?)javascript:/gi, 'content: $1');
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleError = (errorMessage: string) => {
    setSnackbarMessage(errorMessage);
    setSnackbarOpen(true);
    console.error(errorMessage);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const groupsData = await api.getGroups();
      const groupsWithSites = await Promise.all(
        groupsData
          .filter((group) => group.id !== undefined)
          .map(async (group) => {
            const sites = await api.getSites(group.id);
            return { ...group, id: group.id as number, sites } as GroupWithSites;
          })
      );
      setGroups(groupsWithSites);
    } catch (error) {
      handleError('加载数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
      if (error instanceof Error && error.message.includes('认证')) {
        setIsAuthRequired(true);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSiteUpdate = async (updatedSite: Site) => {
    try {
      if (updatedSite.id) {
        await api.updateSite(updatedSite.id, updatedSite);
        await fetchData();
      }
    } catch (error) {
      handleError('更新站点失败: ' + (error as Error).message);
    }
  };

  const handleSiteDelete = async (siteId: number) => {
    try {
      await api.deleteSite(siteId);
      await fetchData();
    } catch (error) {
      handleError('删除站点失败: ' + (error as Error).message);
    }
  };

  const handleSaveGroupOrder = async () => {
    try {
      const groupOrders = groups.map((group, index) => ({
        id: group.id as number,
        order_num: index,
      }));
      await api.updateGroupOrder(groupOrders);
      await fetchData();
      setSortMode(SortMode.None);
      setCurrentSortingGroupId(null);
    } catch (error) {
      handleError('更新分组排序失败: ' + (error as Error).message);
    }
  };

  const handleSaveSiteOrder = async (groupId: number, sites: Site[]) => {
    try {
      console.log('保存站点排序，分组ID:', groupId);
      const siteOrders = sites.map((site, index) => ({
        id: site.id as number,
        order_num: index,
      }));
      await api.updateSiteOrder(siteOrders);
      await fetchData();
      setSortMode(SortMode.None);
      setCurrentSortingGroupId(null);
    } catch (error) {
      handleError('更新站点排序失败: ' + (error as Error).message);
    }
  };

  const startGroupSort = () => {
    setSortMode(SortMode.GroupSort);
    setCurrentSortingGroupId(null);
  };

  const startSiteSort = (groupId: number) => {
    setSortMode(SortMode.SiteSort);
    setCurrentSortingGroupId(groupId);
  };

  const cancelSort = () => {
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = groups.findIndex((group) => group.id.toString() === active.id);
      const newIndex = groups.findIndex((group) => group.id.toString() === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setGroups(arrayMove(groups, oldIndex, newIndex));
      }
    }
  };

  const handleOpenAddGroup = () => {
    setNewGroup({ name: '', order_num: groups.length });
    setOpenAddGroup(true);
  };

  const handleCloseAddGroup = () => {
    setOpenAddGroup(false);
  };

  const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroup({ ...newGroup, [e.target.name]: e.target.value });
  };

  const handleCreateGroup = async () => {
    try {
      if (!newGroup.name) {
        handleError('分组名称不能为空');
        return;
      }
      await api.createGroup(newGroup as Group);
      await fetchData();
      handleCloseAddGroup();
      setNewGroup({ name: '', order_num: 0 });
    } catch (error) {
      handleError('创建分组失败: ' + (error as Error).message);
    }
  };

  const handleOpenAddSite = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const maxOrderNum = group?.sites.length
      ? Math.max(...group.sites.map((s) => s.order_num)) + 1
      : 0;
    setNewSite({
      name: '',
      url: '',
      icon: '',
      description: '',
      notes: '',
      group_id: groupId,
      order_num: maxOrderNum,
    });
    setOpenAddSite(true);
  };

  const handleCloseAddSite = () => {
    setOpenAddSite(false);
  };

  const handleSiteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSite({ ...newSite, [e.target.name]: e.target.value });
  };

  const handleCreateSite = async () => {
    try {
      if (!newSite.name || !newSite.url) {
        handleError('站点名称和URL不能为空');
        return;
      }
      await api.createSite(newSite as Site);
      await fetchData();
      handleCloseAddSite();
    } catch (error) {
      handleError('创建站点失败: ' + (error as Error).message);
    }
  };

  const handleOpenConfig = () => {
    setTempConfigs({ ...configs });
    setOpenConfig(true);
  };

  const handleCloseConfig = () => {
    setOpenConfig(false);
  };

  const handleConfigInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempConfigs({ ...tempConfigs, [e.target.name]: e.target.value });
  };

  const handleSaveConfig = async () => {
    try {
      for (const [key, value] of Object.entries(tempConfigs)) {
        if (configs[key] !== value) {
          await api.setConfig(key, value);
        }
      }
      setConfigs({ ...tempConfigs });
      handleCloseConfig();
    } catch (error) {
      handleError('保存配置失败: ' + (error as Error).message);
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const allSites: Site[] = [];
      groups.forEach((group) => {
        if (group.sites && group.sites.length > 0) {
          allSites.push(...group.sites);
        }
      });
      const exportData = {
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          order_num: group.order_num,
        })),
        sites: allSites,
        configs: configs,
        version: '1.0',
        exportDate: new Date().toISOString(),
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileName = `导航站备份_${new Date().toISOString().slice(0, 10)}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
    } catch (error) {
      handleError('导出数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImport = () => {
    setImportFile(null);
    setImportError(null);
    setOpenImport(true);
    handleMenuClose();
  };

  const handleCloseImport = () => {
    setOpenImport(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError(null);
    }
  };

  const handleImportData = async () => {
    if (!importFile) {
      handleError('请选择要导入的文件');
      return;
    }
    try {
      setImportLoading(true);
      setImportError(null);
      const fileReader = new FileReader();
      fileReader.readAsText(importFile, 'UTF-8');
      fileReader.onload = async (e) => {
        try {
          if (!e.target?.result) throw new Error('读取文件失败');
          const importData = JSON.parse(e.target.result as string);
          if (!importData.groups || !Array.isArray(importData.groups)) throw new Error('导入文件格式错误：缺少分组数据');
          if (!importData.sites || !Array.isArray(importData.sites)) throw new Error('导入文件格式错误：缺少站点数据');
          if (!importData.configs || typeof importData.configs !== 'object') throw new Error('导入文件格式错误：缺少配置数据');
          const result = await api.importData(importData);
          if (!result.success) throw new Error(result.error || '导入失败');
          const stats = result.stats;
          if (stats) {
            const summary = [
              `导入成功！`,
              `分组：发现${stats.groups.total}个，新建${stats.groups.created}个，合并${stats.groups.merged}个`,
              `卡片：发现${stats.sites.total}个，新建${stats.sites.created}个，更新${stats.sites.updated}个，跳过${stats.sites.skipped}个`,
            ].join('\n');
            setImportResultMessage(summary);
            setImportResultOpen(true);
          }
          await fetchData();
          await fetchConfigs();
          handleCloseImport();
        } catch (error) {
          handleError('解析导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
        } finally {
          setImportLoading(false);
        }
      };
      fileReader.onerror = () => {
        handleError('读取文件失败');
        setImportLoading(false);
      };
    } catch (error) {
      handleError('导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setImportLoading(false);
    }
  };

  const handleGroupUpdate = async (updatedGroup: Group) => {
    try {
      if (updatedGroup.id) {
        await api.updateGroup(updatedGroup.id, updatedGroup);
        await fetchData();
      }
    } catch (error) {
      handleError('更新分组失败: ' + (error as Error).message);
    }
  };

  const handleGroupDelete = async (groupId: number) => {
    try {
      await api.deleteGroup(groupId);
      await fetchData();
    } catch (error) {
      handleError('删除分组失败: ' + (error as Error).message);
    }
  };

  const renderLoginForm = () => {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <LoginForm onLogin={handleLogin} loading={loginLoading} error={loginError} />
      </Box>
    );
  };

  if (isAuthChecking) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      </ThemeProvider>
    );
  }

  if (isAuthRequired && !isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {renderLoginForm()}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div id="back-to-top-anchor" />
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity='error' variant='filled' sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
      <Snackbar open={importResultOpen} autoHideDuration={6000} onClose={() => setImportResultOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setImportResultOpen(false)} severity='success' variant='filled' sx={{ width: '100%', whiteSpace: 'pre-line', backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2e7d32' : undefined), color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined), '& .MuiAlert-icon': { color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined) } }}>{importResultMessage}</Alert>
      </Snackbar>

      {/* Root Box: 去掉 overflow: hidden，确保可以正常滚动 */}
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', transition: 'all 0.3s ease-in-out', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {configs['site.backgroundImage'] && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${configs['site.backgroundImage']})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: 0, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')' : 'rgba(255, 255, 255, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')', zIndex: 1 } }} />
        )}

        <Container maxWidth='lg' sx={{ pb: 4, px: { xs: 2, sm: 3, md: 4 }, position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Header: 固定在顶部，增加毛玻璃效果 */}
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 5, 
              flexDirection: { xs: 'column', sm: 'row' }, 
              gap: { xs: 2, sm: 0 },
              position: 'sticky', 
              top: 0,
              zIndex: 1000, 
              py: 2,
              mx: -2, px: 2,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(18, 18, 18, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              borderBottom: 1, 
              borderColor: 'divider',
            }}
          >
            <Stack spacing={1} sx={{ mb: { xs: 2, sm: 0 }, textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography variant='h3' component='h1' fontWeight='bold' color='text.primary' sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem', md: '3rem' } }}>{configs['site.name']}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AccessTimeIcon sx={{ fontSize: 16 }} /><span>{formattedDate}</span></Box>
                  {weather && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><WbSunnyIcon sx={{ fontSize: 16 }} /><span>{weather}</span></Box>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: { xs: 'center', sm: 'flex-start' } }}><FormatQuoteIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} /><span style={{ fontStyle: 'italic', opacity: 0.8 }}>{hitokoto}</span></Box>
              </Box>
            </Stack>

            <Box sx={{ flex: 1, maxWidth: 600, width: '100%', mx: { xs: 0, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 1, mb: { xs: 2, sm: 0 } }}>
              <Stack direction='row' spacing={2} sx={{ pl: 1, overflowX: 'auto' }}>
                {SEARCH_ENGINES.map((engine) => (
                  <Typography key={engine.key} variant='body2' onClick={() => setSearchEngine(engine.key)} sx={{ cursor: 'pointer', fontWeight: searchEngine === engine.key ? 'bold' : 'normal', color: searchEngine === engine.key ? 'primary.main' : 'text.secondary', borderBottom: searchEngine === engine.key ? '2px solid' : 'none', borderColor: 'primary.main', pb: 0.5, whiteSpace: 'nowrap' }}>{engine.name}</Typography>
                ))}
              </Stack>
              <Paper component='form' elevation={1} onSubmit={(e) => { e.preventDefault(); handleSearch(); }} sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 3 } }}>
                <InputBase sx={{ ml: 2, flex: 1 }} placeholder={`在 ${SEARCH_ENGINES.find((e) => e.key === searchEngine)?.name} 中搜索...`} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
                <IconButton type='submit' sx={{ p: '10px' }} aria-label='search'><SearchIcon /></IconButton>
              </Paper>
            </Box>

            <Stack direction={{ xs: 'row', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} alignItems='center' width={{ xs: '100%', sm: 'auto' }} justifyContent={{ xs: 'center', sm: 'flex-end' }} flexWrap='wrap' sx={{ gap: { xs: 1, sm: 2 }, py: { xs: 1, sm: 0 } }}>
              {sortMode !== SortMode.None ? (
                <>
                  {sortMode === SortMode.GroupSort && <Button variant='contained' color='primary' startIcon={<SaveIcon />} onClick={handleSaveGroupOrder} size='small' sx={{ minWidth: 'auto', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>保存分组顺序</Button>}
                  <Button variant='outlined' color='inherit' startIcon={<CancelIcon />} onClick={cancelSort} size='small' sx={{ minWidth: 'auto', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>取消编辑</Button>
                </>
              ) : (
                <>
                  <Button variant='contained' color='primary' startIcon={<AddIcon />} onClick={handleOpenAddGroup} size='small' sx={{ minWidth: 'auto', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>新增分组</Button>
                  <Button variant='outlined' color='primary' startIcon={<MenuIcon />} onClick={handleMenuOpen} aria-controls={openMenu ? 'navigation-menu' : undefined} aria-haspopup='true' aria-expanded={openMenu ? 'true' : undefined} size='small' sx={{ minWidth: 'auto', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>更多选项</Button>
                  <Menu id='navigation-menu' anchorEl={menuAnchorEl} open={openMenu} onClose={handleMenuClose} MenuListProps={{ 'aria-labelledby': 'navigation-button' }}>
                    <MenuItem onClick={startGroupSort}><ListItemIcon><SortIcon fontSize='small' /></ListItemIcon><ListItemText>编辑排序</ListItemText></MenuItem>
                    <MenuItem onClick={handleOpenConfig}><ListItemIcon><SettingsIcon fontSize='small' /></ListItemIcon><ListItemText>网站设置</ListItemText></MenuItem>
                    <Divider />
                    <MenuItem onClick={handleExportData}><ListItemIcon><FileDownloadIcon fontSize='small' /></ListItemIcon><ListItemText>导出数据</ListItemText></MenuItem>
                    <MenuItem onClick={handleOpenImport}><ListItemIcon><FileUploadIcon fontSize='small' /></ListItemIcon><ListItemText>导入数据</ListItemText></MenuItem>
                    {isAuthenticated && <><Divider /><MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><LogoutIcon fontSize='small' /></ListItemIcon><ListItemText>退出登录</ListItemText></MenuItem></>}
                  </Menu>
                </>
              )}
              <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
            </Stack>
          </Box>

          {!loading && !error && (
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', minHeight: '100px', flexDirection: { xs: 'column', md: 'row' }, flex: 1 }}>
              
              {/* Sidebar: 固定在左侧，内部独立滚动 */}
              {sortMode === SortMode.None && (
                <Box component='aside' sx={{ 
                  width: 180, 
                  flexShrink: 0, 
                  position: 'sticky', 
                  top: 130, // 距离顶部 130px，留给 Header
                  alignSelf: 'flex-start', // 关键：确保侧边栏不会被拉伸
                  maxHeight: 'calc(100vh - 150px)', // 限制高度，确保底部不被遮挡
                  overflowY: 'auto', // 开启垂直滚动
                  display: { xs: 'none', md: 'block' },
                  // 滚动条样式美化
                  '&::-webkit-scrollbar': { width: '5px' },
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                  '&::-webkit-scrollbar-thumb': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: '10px' },
                  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }
                }}>
                  <Paper elevation={0} sx={{ 
                    bgcolor: 'background.paper', 
                    borderRadius: 2, 
                    border: 1, 
                    borderColor: 'divider',
                    overflow: 'hidden'
                  }}>
                    <List disablePadding>
                      {filteredGroups.map((group) => (
                        <ListItem key={group.id} disablePadding>
                          <ListItemButton component='a' href={`#group-${group.id}`} sx={{ py: 1.5, '&:hover': { bgcolor: 'action.hover' } }}><ListItemText primary={group.name} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500, noWrap: true }} /></ListItemButton>
                        </ListItem>
                      ))}
                      {searchEngine === 'site' && searchKeyword && filteredGroups.length === 0 && <ListItem><ListItemText primary='无匹配结果' primaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary', align: 'center' }} /></ListItem>}
                    </List>
                  </Paper>
                </Box>
              )}

              <Box component='main' sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                {sortMode === SortMode.None && (
                  <Box sx={{ display: { xs: 'flex', md: 'none' }, overflowX: 'auto', gap: 1, py: 1, mb: 2, position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default', '::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', borderBottom: 1, borderColor: 'divider' }}>
                    {filteredGroups.map((group) => <Chip key={group.id} label={group.name} component='a' href={`#group-${group.id}`} clickable color='default' variant='outlined' />)}
                  </Box>
                )}

                {sortMode === SortMode.GroupSort ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={groups.map((group) => group.id.toString())} strategy={verticalListSortingStrategy}>
                      <Stack spacing={2} sx={{ '& > *': { transition: 'none' } }}>{groups.map((group) => <SortableGroupItem key={group.id} id={group.id.toString()} group={group} />)}</Stack>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <Stack spacing={5}>
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => (
                        <Box key={`group-${group.id}`} id={`group-${group.id}`} sx={{ scrollMarginTop: '130px' }}> {/* 增加滚动偏移量，防止标题遮挡内容 */}
                          <GroupCard group={group} sortMode={sortMode === SortMode.None ? 'None' : 'SiteSort'} currentSortingGroupId={currentSortingGroupId} onUpdate={handleSiteUpdate} onDelete={handleSiteDelete} onSaveSiteOrder={handleSaveSiteOrder} onStartSiteSort={startSiteSort} onAddSite={handleOpenAddSite} onUpdateGroup={handleGroupUpdate} onDeleteGroup={handleGroupDelete} configs={configs} />
                        </Box>
                      ))
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}><Typography variant='h6'>没有找到匹配的内容</Typography>{searchEngine === 'site' && <Typography variant='body2'>请尝试使用其他关键词</Typography>}</Box>
                    )}
                  </Stack>
                )}
              </Box>
            </Box>
          )}

          <Box component="footer" sx={{ mt: 8, py: 3, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: { xs: 'center', sm: 'flex-start' } }}>
              <Typography variant="body2">© {new Date().getFullYear()} {configs['site.name']}</Typography>
              <Typography variant="caption">本站已稳定运行 {runDays} 天</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} title="总访问量">
                <VisibilityIcon sx={{ fontSize: 16 }} />
                <span id="busuanzi_container_site_pv" style={{ display: 'none' }}>
                  <span id="busuanzi_value_site_pv">--</span>
                </span>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ height: 12, my: 'auto' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} title="总访客数">
                <PersonIcon sx={{ fontSize: 16 }} />
                <span id="busuanzi_container_site_uv" style={{ display: 'none' }}>
                  <span id="busuanzi_value_site_uv">--</span>
                </span>
              </Box>
            </Box>
          </Box>

          <Dialog open={openAddGroup} onClose={handleCloseAddGroup} maxWidth='md' fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3, md: 4 }, width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' }, maxWidth: { sm: '600px' } } }}>
            <DialogTitle>新增分组<IconButton aria-label='close' onClick={handleCloseAddGroup} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent><DialogContentText sx={{ mb: 2 }}>请输入新分组的信息</DialogContentText><TextField autoFocus margin='dense' id='group-name' name='name' label='分组名称' type='text' fullWidth variant='outlined' value={newGroup.name} onChange={handleGroupInputChange} sx={{ mb: 2 }} /></DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={handleCloseAddGroup} variant='outlined'>取消</Button><Button onClick={handleCreateGroup} variant='contained' color='primary'>创建</Button></DialogActions>
          </Dialog>

          <Dialog open={openAddSite} onClose={handleCloseAddSite} maxWidth='md' fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 'auto' }, width: { xs: 'calc(100% - 32px)', sm: 'auto' } } }}>
            <DialogTitle>新增站点<IconButton aria-label='close' onClick={handleCloseAddSite} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent><DialogContentText sx={{ mb: 2 }}>请输入新站点的信息</DialogContentText><Stack spacing={2}><Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}><Box sx={{ flex: 1 }}><TextField autoFocus margin='dense' id='site-name' name='name' label='站点名称' type='text' fullWidth variant='outlined' value={newSite.name} onChange={handleSiteInputChange} /></Box><Box sx={{ flex: 1 }}><TextField margin='dense' id='site-url' name='url' label='站点URL' type='url' fullWidth variant='outlined' value={newSite.url} onChange={handleSiteInputChange} /></Box></Box><TextField margin='dense' id='site-icon' name='icon' label='图标URL' type='url' fullWidth variant='outlined' value={newSite.icon} onChange={handleSiteInputChange} InputProps={{ endAdornment: (<InputAdornment position='end'><IconButton onClick={() => { if (!newSite.url) { handleError('请先输入站点URL'); return; } const domain = extractDomain(newSite.url); if (domain) { const actualIconApi = configs['site.iconApi'] || 'https://www.faviconextractor.com/favicon/{domain}?larger=true'; const iconUrl = actualIconApi.replace('{domain}', domain); setNewSite({ ...newSite, icon: iconUrl }); } else { handleError('无法从URL中获取域名'); } }} edge='end' title='自动获取图标'><AutoFixHighIcon /></IconButton></InputAdornment>) }} /><TextField margin='dense' id='site-description' name='description' label='站点描述' type='text' fullWidth variant='outlined' value={newSite.description} onChange={handleSiteInputChange} /><TextField margin='dense' id='site-notes' name='notes' label='备注' type='text' fullWidth multiline rows={2} variant='outlined' value={newSite.notes} onChange={handleSiteInputChange} /></Stack></DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={handleCloseAddSite} variant='outlined'>取消</Button><Button onClick={handleCreateSite} variant='contained' color='primary'>创建</Button></DialogActions>
          </Dialog>

          <Dialog open={openConfig} onClose={handleCloseConfig} maxWidth='sm' fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3, md: 4 }, width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' }, maxWidth: { sm: '600px' } } }}>
            <DialogTitle>网站设置<IconButton aria-label='close' onClick={handleCloseConfig} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent><DialogContentText sx={{ mb: 2 }}>配置网站的基本信息和外观</DialogContentText><Stack spacing={2}><TextField margin='dense' id='site-title' name='site.title' label='网站标题 (浏览器标签)' type='text' fullWidth variant='outlined' value={tempConfigs['site.title']} onChange={handleConfigInputChange} /><TextField margin='dense' id='site-name' name='site.name' label='网站名称 (显示在页面中)' type='text' fullWidth variant='outlined' value={tempConfigs['site.name']} onChange={handleConfigInputChange} /><Box sx={{ mb: 1 }}><Typography variant='subtitle1' gutterBottom>获取图标API设置</Typography><TextField margin='dense' id='site-icon-api' name='site.iconApi' label='获取图标API URL' type='text' fullWidth variant='outlined' value={tempConfigs['site.iconApi']} onChange={handleConfigInputChange} placeholder='https://example.com/favicon/{domain}' helperText='输入获取图标API的地址，使用 {domain} 作为域名占位符' /></Box><Box sx={{ mb: 1 }}><Typography variant='subtitle1' gutterBottom>背景图片设置</Typography><TextField margin='dense' id='site-background-image' name='site.backgroundImage' label='背景图片URL' type='url' fullWidth variant='outlined' value={tempConfigs['site.backgroundImage']} onChange={handleConfigInputChange} placeholder='https://example.com/background.jpg' helperText='输入图片URL，留空则不使用背景图片' /><Box sx={{ mt: 2, mb: 1 }}><Typography variant='body2' color='text.secondary' id='background-opacity-slider' gutterBottom>背景蒙版透明度: {Number(tempConfigs['site.backgroundOpacity']).toFixed(2)}</Typography><Slider aria-labelledby='background-opacity-slider' name='site.backgroundOpacity' min={0} max={1} step={0.01} valueLabelDisplay='auto' value={Number(tempConfigs['site.backgroundOpacity'])} onChange={(_, value) => { setTempConfigs({ ...tempConfigs, 'site.backgroundOpacity': String(value) }); }} /><Typography variant='caption' color='text.secondary'>值越大，背景图片越清晰，内容可能越难看清</Typography></Box></Box><TextField margin='dense' id='site-custom-css' name='site.customCss' label='自定义CSS' type='text' fullWidth multiline rows={6} variant='outlined' value={tempConfigs['site.customCss']} onChange={handleConfigInputChange} placeholder='/* 自定义样式 */\nbody { }' /></Stack></DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={handleCloseConfig} variant='outlined'>取消</Button><Button onClick={handleSaveConfig} variant='contained' color='primary'>保存设置</Button></DialogActions>
          </Dialog>

          <Dialog open={openImport} onClose={handleCloseImport} maxWidth='sm' fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 'auto' }, width: { xs: 'calc(100% - 32px)', sm: 'auto' } } }}>
            <DialogTitle>导入数据<IconButton aria-label='close' onClick={handleCloseImport} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent><DialogContentText sx={{ mb: 2 }}>请选择要导入的JSON文件，导入将覆盖现有数据。</DialogContentText><Box sx={{ mb: 2 }}><Button variant='outlined' component='label' startIcon={<FileUploadIcon />} sx={{ mb: 2 }}>选择文件<input type='file' hidden accept='.json' onChange={handleFileSelect} /></Button>{importFile && <Typography variant='body2' sx={{ mt: 1 }}>已选择: {importFile.name}</Typography>}</Box>{importError && <Alert severity='error' sx={{ mb: 2 }}>{importError}</Alert>}</DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={handleCloseImport} variant='outlined'>取消</Button><Button onClick={handleImportData} variant='contained' color='primary' disabled={!importFile || importLoading} startIcon={importLoading ? <CircularProgress size={20} /> : <FileUploadIcon />}>{importLoading ? '导入中...' : '导入'}</Button></DialogActions>
          </Dialog>

          <Zoom in={scrollTrigger}><Box onClick={handleScrollTop} role="presentation" sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 11 }}><Fab color="primary" size="small" aria-label="scroll back to top"><KeyboardArrowUpIcon /></Fab></Box></Zoom>
          <Box sx={{ position: 'fixed', bottom: { xs: 8, sm: 16 }, right: { xs: 8, sm: 16 }, zIndex: 10 }}><Paper component='a' href='https://github.com/zqq-nuli/Navihive' target='_blank' rel='noopener noreferrer' elevation={2} sx={{ display: 'flex', alignItems: 'center', p: 1, borderRadius: 10, bgcolor: 'background.paper', color: 'text.secondary', transition: 'all 0.3s ease-in-out', '&:hover': { bgcolor: 'action.hover', color: 'text.primary', boxShadow: 4 }, textDecoration: 'none' }}><GitHubIcon /></Paper></Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
