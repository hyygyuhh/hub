/**
 * Seed popular GitHub open-source apps into D1 (no mirror links).
 * Usage: node scripts/seed-popular-apps.mjs [--local]
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const remote = !process.argv.includes('--local');
const flag = remote ? '--remote' : '--local';

const apps = [
  {
    id: 'PowerToys',
    name: 'PowerToys',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '微软官方 Windows 实用工具集合，包含窗口布局、批量重命名、颜色选取等 30+ 生产力增强工具。',
    features: ['窗口布局 FancyZones', '批量重命名', '颜色选取器', '键盘管理'],
    github_url: 'https://github.com/microsoft/PowerToys',
    github_stars: 139100,
    version: '0.102.0',
    size: '',
    updated_date: '2026-10-10'
  },
  {
    id: 'scrcpy',
    name: 'scrcpy',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '轻量高性能的 Android 投屏与控制工具，支持 USB / Wi-Fi，无需 root，延迟极低。',
    features: ['无线投屏', '键鼠控制', '高帧率', '无需 root'],
    github_url: 'https://github.com/Genymobile/scrcpy',
    github_stars: 151700,
    version: '3.3.1',
    size: '',
    updated_date: '2026-10-09'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    platform: 'windows',
    category: 'ai',
    category_name: 'AI 工具',
    description: '开源 AI 编码代理，提供 CLI 与桌面端，支持一键安装脚本、npm、Homebrew 等多种部署方式。',
    features: ['AI 编码代理', 'CLI / 桌面', '多模型支持', '一键安装'],
    github_url: 'https://github.com/anomalyco/opencode',
    github_stars: 212700,
    version: '1.19.0',
    size: '',
    updated_date: '2026-10-12'
  },
  {
    id: 'cc-switch',
    name: 'CC Switch',
    platform: 'windows',
    category: 'ai',
    category_name: 'AI 工具',
    description: '跨平台桌面端 AI 编程助手统一管理工具，支持 Claude Code、Codex、Gemini CLI 等多种 Agent。',
    features: ['多 Agent 管理', '跨平台', '一键切换配置', '桌面端'],
    github_url: 'https://github.com/farion1231/cc-switch',
    github_stars: 142700,
    version: '4.0.8',
    size: '',
    updated_date: '2026-10-11'
  },
  {
    id: 'ComfyUI',
    name: 'ComfyUI',
    platform: 'windows',
    category: 'ai',
    category_name: 'AI 工具',
    description: '模块化扩散模型 GUI / API，通过节点界面进行图像、视频、3D 与音频生成，支持最新开源模型。',
    features: ['节点式工作流', '图像 / 视频生成', '可扩展插件', '本地运行'],
    github_url: 'https://github.com/Comfy-Org/ComfyUI',
    github_stars: 136300,
    version: '0.39.0',
    size: '',
    updated_date: '2026-10-07'
  },
  {
    id: 'llama-cpp',
    name: 'llama.cpp',
    platform: 'windows',
    category: 'ai',
    category_name: 'AI 工具',
    description: '用 C/C++ 实现的大语言模型推理引擎，支持多种模型格式，可在本地运行 LLM / VLM。',
    features: ['本地 LLM 推理', '多模型格式', 'CLI / Server', '内置 Web UI'],
    github_url: 'https://github.com/ggml-org/llama.cpp',
    github_stars: 130800,
    version: 'b11556',
    size: '',
    updated_date: '2026-10-12'
  },
  {
    id: 'VSCode',
    name: 'Visual Studio Code',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '微软开源的跨平台代码编辑器，插件生态丰富，适合日常开发与远程协作。',
    features: ['智能补全', '调试集成', 'Git 支持', '海量扩展'],
    github_url: 'https://github.com/microsoft/vscode',
    github_stars: 178000,
    version: '1.95.0',
    size: '',
    updated_date: '2026-10-08'
  },
  {
    id: 'ShareX',
    name: 'ShareX',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: '功能强大的截图、录屏与分享工具，支持自动上传、OCR、工作流自定义。',
    features: ['截图 / 录屏', 'OCR', '自动上传', '工作流'],
    github_url: 'https://github.com/ShareX/ShareX',
    github_stars: 35000,
    version: '17.0.0',
    size: '',
    updated_date: '2026-09-20'
  },
  {
    id: 'FlowLauncher',
    name: 'Flow Launcher',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '开源 Windows 快速启动器，用快捷键秒搜应用、文件与插件能力。',
    features: ['快速启动', '插件扩展', '文件搜索', '主题定制'],
    github_url: 'https://github.com/Flow-Launcher/Flow.Launcher',
    github_stars: 12000,
    version: '1.19.0',
    size: '',
    updated_date: '2026-09-15'
  },
  {
    id: 'Ventoy',
    name: 'Ventoy',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '开源多系统启动 U 盘解决方案，直接拷贝 ISO 即可启动，无需反复格式化写入。',
    features: ['多 ISO 共存', '免反复写入', '安全启动', '跨平台'],
    github_url: 'https://github.com/ventoy/Ventoy',
    github_stars: 72000,
    version: '1.0.99',
    size: '',
    updated_date: '2026-08-01'
  },
  {
    id: 'Rufus',
    name: 'Rufus',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '小巧高效的 USB 启动盘制作工具，支持 Windows / Linux 镜像写入与 Windows To Go。',
    features: ['启动盘制作', 'ISO 模式', 'DD 模式', '体积小巧'],
    github_url: 'https://github.com/pbatard/rufus',
    github_stars: 34000,
    version: '4.6',
    size: '',
    updated_date: '2026-07-20'
  },
  {
    id: 'LocalSend',
    name: 'LocalSend',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '跨平台局域网文件传输工具，无需账号，类似 AirDrop 的开源替代方案。',
    features: ['局域网互传', '跨平台', '无需账号', '端到端加密'],
    github_url: 'https://github.com/localsend/localsend',
    github_stars: 68000,
    version: '1.16.0',
    size: '',
    updated_date: '2026-09-01'
  },
  {
    id: 'RustDesk',
    name: 'RustDesk',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '开源远程桌面软件，可自建中继服务器，替代 TeamViewer / ToDesk 的自托管方案。',
    features: ['远程桌面', '可自建服务', '跨平台', '文件传输'],
    github_url: 'https://github.com/rustdesk/rustdesk',
    github_stars: 100000,
    version: '1.3.0',
    size: '',
    updated_date: '2026-09-10'
  },
  {
    id: 'Syncthing',
    name: 'Syncthing',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '去中心化连续文件同步工具，设备之间直接同步，无需把文件交给第三方云盘。',
    features: ['P2P 同步', '版本控制', '加密传输', '跨平台'],
    github_url: 'https://github.com/syncthing/syncthing',
    github_stars: 76000,
    version: '1.28.0',
    size: '',
    updated_date: '2026-08-15'
  },
  {
    id: 'MarkText',
    name: 'MarkText',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '简洁的实时预览 Markdown 编辑器，专注写作体验，支持导出 PDF / HTML。',
    features: ['实时预览', '专注模式', '导出多格式', '开源免费'],
    github_url: 'https://github.com/marktext/marktext',
    github_stars: 51000,
    version: '0.17.1',
    size: '',
    updated_date: '2026-06-01'
  },
  {
    id: 'SumatraPDF',
    name: 'Sumatra PDF',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '轻量快速的 Windows PDF / Comic / eBook 阅读器，启动快、占用低。',
    features: ['轻量快速', '多格式', '便携版', '标签浏览'],
    github_url: 'https://github.com/sumatrapdfreader/sumatrapdf',
    github_stars: 16000,
    version: '3.5.2',
    size: '',
    updated_date: '2026-05-01'
  },
  {
    id: 'Krita',
    name: 'Krita',
    platform: 'windows',
    category: 'design',
    category_name: '设计创意',
    description: '专业开源数字绘画软件，适合插画、漫画与概念设计，笔刷与色彩管理强大。',
    features: ['数字绘画', '动画时间轴', '丰富笔刷', '色彩管理'],
    github_url: 'https://github.com/KDE/krita',
    github_stars: 9200,
    version: '5.2.9',
    size: '',
    updated_date: '2026-07-01'
  },
  {
    id: 'HandBrake',
    name: 'HandBrake',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '开源视频转码工具，支持批量压制、字幕烧录与多种预设，适合归档与设备适配。',
    features: ['视频转码', '批量队列', '字幕处理', '硬件加速'],
    github_url: 'https://github.com/HandBrake/HandBrake',
    github_stars: 21000,
    version: '1.9.0',
    size: '',
    updated_date: '2026-08-20'
  },
  {
    id: 'mpv',
    name: 'mpv',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '极简可脚本化的媒体播放器，画质出色，支持几乎所有音视频格式与 GPU 渲染。',
    features: ['高画质渲染', '脚本扩展', '广泛格式', '轻量无广告'],
    github_url: 'https://github.com/mpv-player/mpv',
    github_stars: 33000,
    version: '0.39.0',
    size: '',
    updated_date: '2026-09-05'
  },
  {
    id: 'reader',
    name: 'Reader',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '「阅读 3.0」（Legado）跨平台桌面移植版，基于 Rust / Tauri，支持书源、本地书籍与 RSS。',
    features: ['书源管理', '本地阅读', 'RSS 订阅', '跨平台'],
    github_url: 'https://github.com/hadc188/reader',
    github_stars: 67,
    version: '1.5.3',
    size: '',
    updated_date: '2026-10-12'
  },
  {
    id: 'DBeaver',
    name: 'DBeaver',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '通用数据库管理客户端，支持 MySQL、PostgreSQL、SQLite 等主流数据库。',
    features: ['多数据库', 'SQL 编辑器', '数据导出', 'ER 图'],
    github_url: 'https://github.com/dbeaver/dbeaver',
    github_stars: 48000,
    version: '25.0.0',
    size: '',
    updated_date: '2026-09-25'
  },
  {
    id: 'Bruno',
    name: 'Bruno',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '开源 API 客户端，集合存储在本地 Git 友好文件夹中，注重离线与隐私。',
    features: ['API 调试', '本地集合', 'Git 友好', '离线优先'],
    github_url: 'https://github.com/usebruno/bruno',
    github_stars: 39000,
    version: '2.0.0',
    size: '',
    updated_date: '2026-09-18'
  },
  {
    id: 'UniGetUI',
    name: 'UniGetUI',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: 'Windows 包管理器图形界面，统一管理 winget / Scoop / Chocolatey 等软件源。',
    features: ['多源管理', '一键更新', '图形界面', '批量操作'],
    github_url: 'https://github.com/marticliment/UniGetUI',
    github_stars: 19000,
    version: '3.1.0',
    size: '',
    updated_date: '2026-09-12'
  },
  {
    id: 'PeaZip',
    name: 'PeaZip',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: '开源压缩解压工具，支持 7z、RAR、ZIP 等海量格式，并提供加密与分卷。',
    features: ['多格式压缩', '加密分卷', '文件管理', '跨平台'],
    github_url: 'https://github.com/peazip/PeaZip',
    github_stars: 5500,
    version: '10.0.0',
    size: '',
    updated_date: '2026-08-28'
  },
  {
    id: 'NewPipe',
    name: 'NewPipe',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '轻量隐私友好的 Android YouTube 前端，支持后台播放、下载与无账号订阅。',
    features: ['后台播放', '视频下载', '无广告', '隐私友好'],
    github_url: 'https://github.com/TeamNewPipe/NewPipe',
    github_stars: 36000,
    version: '0.27.0',
    size: '',
    updated_date: '2026-09-01'
  },
  {
    id: 'Termux',
    name: 'Termux',
    platform: 'android',
    category: 'development',
    category_name: '开发工具',
    description: 'Android 终端模拟器与 Linux 环境，可在手机上运行脚本、编译与常用开发工具。',
    features: ['完整终端', 'pkg 包管理', 'SSH 客户端', '开发环境'],
    github_url: 'https://github.com/termux/termux-app',
    github_stars: 45000,
    version: '0.118.0',
    size: '',
    updated_date: '2026-07-15'
  },
  {
    id: 'AntennaPod',
    name: 'AntennaPod',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '开源播客客户端，支持订阅管理、变速播放、自动下载，无追踪无广告。',
    features: ['播客订阅', '变速播放', '自动下载', '无广告'],
    github_url: 'https://github.com/AntennaPod/AntennaPod',
    github_stars: 7500,
    version: '3.5.0',
    size: '',
    updated_date: '2026-08-10'
  },
  {
    id: 'OrganicMaps',
    name: 'Organic Maps',
    platform: 'android',
    category: 'tools',
    category_name: '实用工具',
    description: '注重线优先的开源地图导航，基于 OpenStreetMap，无追踪、无广告。',
    features: ['离线地图', '步行 / 骑行导航', '无追踪', '省电'],
    github_url: 'https://github.com/organicmaps/organicmaps',
    github_stars: 13000,
    version: '2025.10.0',
    size: '',
    updated_date: '2026-10-01'
  },
  {
    id: 'LocalSend-Android',
    name: 'LocalSend',
    platform: 'android',
    category: 'network',
    category_name: '网络通讯',
    description: 'LocalSend Android 端：局域网互传文件与文本，无需账号，跨平台互通。',
    features: ['局域网互传', '跨平台', '无需账号', '端到端加密'],
    github_url: 'https://github.com/localsend/localsend',
    github_stars: 68000,
    version: '1.16.0',
    size: '',
    updated_date: '2026-09-01'
  },
  {
    id: 'KeePassDX',
    name: 'KeePassDX',
    platform: 'android',
    category: 'security',
    category_name: '安全防护',
    description: '开源 Android 密码管理器，兼容 KeePass 数据库格式，支持指纹解锁与自动填充。',
    features: ['KeePass 兼容', '指纹解锁', '自动填充', '离线安全'],
    github_url: 'https://github.com/Kunzisoft/KeePassDX',
    github_stars: 5600,
    version: '4.1.0',
    size: '',
    updated_date: '2026-08-05'
  }
];

function sqlString(value) {
  return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'";
}

const lines = [
  '-- Popular GitHub apps seed (no download_sources; fill mirrors in admin)'
];

for (const app of apps) {
  const features = JSON.stringify(app.features || []);
  const owner = (app.github_url.match(/github\.com\/([^/]+)/) || [])[1] || '';
  const iconUrl = owner ? `https://avatars.githubusercontent.com/${owner}?s=128` : '';

  lines.push(`INSERT OR IGNORE INTO apps (
  id, name, platform, category, category_name, description, features,
  github_url, github_stars, icon, size, version, updated_date, popularity
) VALUES (
  ${sqlString(app.id)},
  ${sqlString(app.name)},
  ${sqlString(app.platform)},
  ${sqlString(app.category)},
  ${sqlString(app.category_name)},
  ${sqlString(app.description)},
  ${sqlString(features)},
  ${sqlString(app.github_url)},
  ${Number(app.github_stars) || 0},
  ${sqlString(iconUrl)},
  ${sqlString(app.size || '')},
  ${sqlString(app.version || '')},
  ${sqlString(app.updated_date || '')},
  ${Number(app.github_stars) || 0}
);`);
}

const sqlPath = join(tmpdir(), `shelfhub-seed-${Date.now()}.sql`);
writeFileSync(sqlPath, lines.join('\n'), 'utf8');

console.log(`Seeding ${apps.length} apps (${flag})…`);
try {
  execSync(`npx wrangler d1 execute shelfhub ${flag} --file="${sqlPath}"`, {
    stdio: 'inherit',
    cwd: root
  });
  console.log('Done. Add 夸克/百度 mirrors in /admin when ready.');
} finally {
  try { unlinkSync(sqlPath); } catch (_) {}
}
