/**
 * Seed China-friendly open-source apps (inspired by GitHub Store).
 * Skips proxy/VPN clients. Mirrors left empty for admin to fill.
 * Usage: node scripts/seed-cn-apps.mjs [--local]
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
  // —— Windows：国内常用 ——
  {
    id: 'TrafficMonitor',
    name: 'TrafficMonitor',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '国产开源任务栏网速监控工具，可显示 CPU / 内存占用，支持换肤与鼠标穿透，Windows 用户几乎人手一份。',
    features: ['任务栏网速', 'CPU / 内存监控', '换肤', '鼠标穿透'],
    github_url: 'https://github.com/zhongyang219/TrafficMonitor',
    github_stars: 42000,
    version: '1.85.1',
    updated_date: '2026-06-01'
  },
  {
    id: 'Umi-OCR',
    name: 'Umi-OCR',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: '免费开源离线 OCR 软件，支持截图识别、批量图片 / PDF 识别，中文识别效果出色，适合办公扫图。',
    features: ['离线 OCR', '截图识别', '批量 PDF', '多语言'],
    github_url: 'https://github.com/hiroi-sora/Umi-OCR',
    github_stars: 40000,
    version: '2.1.5',
    updated_date: '2026-08-20'
  },
  {
    id: 'LX-Music',
    name: '洛雪音乐助手',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '开源音乐播放器，可聚合多个音源搜索试听，界面简洁，国内用户常用的桌面听歌方案。',
    features: ['多音源', '桌面歌词', '免费开源', '跨平台'],
    github_url: 'https://github.com/lyswhut/lx-music-desktop',
    github_stars: 48000,
    version: '2.10.0',
    updated_date: '2026-09-15'
  },
  {
    id: 'YesPlayMusic',
    name: 'YesPlayMusic',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '高颜值开源网易云第三方客户端，界面现代化，支持本地音乐与歌词显示。',
    features: ['高颜值 UI', '歌词显示', '本地音乐', '跨平台'],
    github_url: 'https://github.com/qier222/YesPlayMusic',
    github_stars: 33000,
    version: '0.4.10',
    updated_date: '2026-05-01'
  },
  {
    id: 'Motrix',
    name: 'Motrix',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '颜值在线的开源下载工具，基于 aria2，支持 HTTP / FTP / BT / 磁力链接，适合国内日常下载。',
    features: ['aria2 引擎', 'BT / 磁力', '限速控制', '简洁界面'],
    github_url: 'https://github.com/agalwood/Motrix',
    github_stars: 51000,
    version: '1.8.19',
    updated_date: '2026-04-10'
  },
  {
    id: 'QuickLook',
    name: 'QuickLook',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '仿 macOS 空格预览的 Windows 文件快速预览工具，支持图片、文档、压缩包等多种格式。',
    features: ['空格预览', '多格式', '插件扩展', '轻量'],
    github_url: 'https://github.com/QL-Win/QuickLook',
    github_stars: 22000,
    version: '3.7.3',
    updated_date: '2026-03-01'
  },
  {
    id: 'ScreenToGif',
    name: 'ScreenToGif',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: '录屏并直接编辑导出 GIF / 视频的开源工具，做教程、演示和表情包非常方便。',
    features: ['屏幕录制', '帧编辑', '导出 GIF', '免费开源'],
    github_url: 'https://github.com/NickeManarin/ScreenToGif',
    github_stars: 28000,
    version: '2.41.0',
    updated_date: '2026-07-01'
  },
  {
    id: 'Magpie',
    name: 'Magpie',
    platform: 'windows',
    category: 'games',
    category_name: '游戏娱乐',
    description: '国产开源窗口缩放 / 超分工具，可为游戏与应用做全屏放大与画质增强，老游戏党常用。',
    features: ['窗口超分', '多种缩放算法', '低延迟', '开源免费'],
    github_url: 'https://github.com/Blinue/Magpie',
    github_stars: 14000,
    version: '0.11.0',
    updated_date: '2026-08-01'
  },
  {
    id: 'Files',
    name: 'Files',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '现代化开源文件管理器，标签页、双栏、现代化设计，可替代部分资源管理器使用场景。',
    features: ['多标签', '双栏浏览', '现代化 UI', '开源'],
    github_url: 'https://github.com/files-community/Files',
    github_stars: 42000,
    version: '3.7.0',
    updated_date: '2026-09-01'
  },
  {
    id: 'OBS-Studio',
    name: 'OBS Studio',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '全球最流行的开源直播与录屏软件，B 站 / 抖音推流、课程录制都常用。',
    features: ['直播推流', '屏幕录制', '场景切换', '插件丰富'],
    github_url: 'https://github.com/obsproject/obs-studio',
    github_stars: 70000,
    version: '31.0.0',
    updated_date: '2026-09-20'
  },
  {
    id: 'drawio',
    name: 'draw.io Desktop',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '开源流程图 / 架构图画图工具桌面版，做方案、PPT 配图和系统设计非常方便。',
    features: ['流程图', '离线可用', '导出多格式', '免费'],
    github_url: 'https://github.com/jgraph/drawio-desktop',
    github_stars: 58000,
    version: '26.0.0',
    updated_date: '2026-09-10'
  },
  {
    id: 'Logseq',
    name: 'Logseq',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '开源本地优先的大纲笔记与知识库，支持双向链接与 Markdown，隐私友好的 Obsidian 替代之一。',
    features: ['本地优先', '双向链接', '大纲笔记', '开源'],
    github_url: 'https://github.com/logseq/logseq',
    github_stars: 41000,
    version: '0.10.0',
    updated_date: '2026-07-15'
  },
  {
    id: 'AppFlowy',
    name: 'AppFlowy',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '开源 Notion 风格协作与笔记工具，可自托管，适合想把数据掌握在自己手里的团队与个人。',
    features: ['类 Notion', '可自托管', '跨平台', '开源'],
    github_url: 'https://github.com/AppFlowy-IO/AppFlowy',
    github_stars: 70000,
    version: '0.8.0',
    updated_date: '2026-09-05'
  },
  {
    id: 'Joplin',
    name: 'Joplin',
    platform: 'windows',
    category: 'office',
    category_name: '办公效率',
    description: '开源 Markdown 笔记软件，支持端到端加密同步，可替代印象笔记做个人知识管理。',
    features: ['Markdown', '加密同步', '待办清单', '多端'],
    github_url: 'https://github.com/laurent22/joplin',
    github_stars: 54000,
    version: '3.2.0',
    updated_date: '2026-08-25'
  },
  {
    id: 'SwitchHosts',
    name: 'SwitchHosts',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '开源 Hosts 快速切换工具，开发调试、屏蔽广告域名时国内程序员常用。',
    features: ['Hosts 切换', '远程规则', '系统托盘', '跨平台'],
    github_url: 'https://github.com/oldj/SwitchHosts',
    github_stars: 28000,
    version: '4.2.0',
    updated_date: '2026-06-20'
  },
  {
    id: 'AnotherRedis',
    name: 'Another Redis Desktop Manager',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '国产开源 Redis 桌面客户端，性能好、界面清爽，国内后端开发高频使用。',
    features: ['Redis 管理', '集群支持', '性能优秀', '免费开源'],
    github_url: 'https://github.com/qishibo/AnotherRedisDesktopManager',
    github_stars: 34000,
    version: '1.7.0',
    updated_date: '2026-08-10'
  },
  {
    id: 'DevToys',
    name: 'DevToys',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '开发者瑞士军刀：编码解码、JSON 格式化、UUID、哈希等日常工具集合，离线即用。',
    features: ['编码解码', 'JSON 工具', '哈希 / UUID', '离线'],
    github_url: 'https://github.com/DevToys-app/DevToys',
    github_stars: 30000,
    version: '2.0.0',
    updated_date: '2026-07-20'
  },
  {
    id: 'Tabby',
    name: 'Tabby',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '现代化开源终端，支持 SSH / Serial，界面美观，可替代部分老旧终端工具。',
    features: ['SSH 终端', '分屏标签', '主题美化', '跨平台'],
    github_url: 'https://github.com/Eugeny/tabby',
    github_stars: 70000,
    version: '1.0.220',
    updated_date: '2026-09-01'
  },
  {
    id: 'GitHubDesktop',
    name: 'GitHub Desktop',
    platform: 'windows',
    category: 'development',
    category_name: '开发工具',
    description: '官方开源 Git 图形客户端，适合不习惯命令行的同学做提交、分支与 PR。',
    features: ['图形化 Git', '分支管理', '中文友好', '开源'],
    github_url: 'https://github.com/desktop/desktop',
    github_stars: 22000,
    version: '3.4.0',
    updated_date: '2026-09-12'
  },
  {
    id: 'qBittorrent',
    name: 'qBittorrent',
    platform: 'windows',
    category: 'network',
    category_name: '网络通讯',
    description: '开源 BitTorrent 客户端，无广告、功能完整，国内下载资源时常用的 BT 客户端。',
    features: ['无广告', '磁力链接', '远程 WebUI', '跨平台'],
    github_url: 'https://github.com/qbittorrent/qBittorrent',
    github_stars: 35000,
    version: '5.0.0',
    updated_date: '2026-08-15'
  },
  {
    id: 'lossless-cut',
    name: 'LosslessCut',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '无损剪辑音视频的开源工具，裁片头片尾、拆分片段不重新编码，速度极快。',
    features: ['无损剪辑', '快速切分', '多格式', '跨平台'],
    github_url: 'https://github.com/mifi/lossless-cut',
    github_stars: 34000,
    version: '3.64.0',
    updated_date: '2026-09-08'
  },
  {
    id: 'BBDown',
    name: 'BBDown',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '命令行 B 站下载工具，支持分 P、弹幕与字幕下载，国内用户下载收藏视频常用。',
    features: ['B 站下载', '多 P 支持', '弹幕字幕', '开源'],
    github_url: 'https://github.com/nilaoda/BBDown',
    github_stars: 25000,
    version: '1.6.3',
    updated_date: '2026-07-30'
  },
  {
    id: 'CrystalDiskInfo',
    name: 'CrystalDiskInfo',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '硬盘健康监测工具，查看 S.M.A.R.T.、温度与寿命，装机与日常排查必备。',
    features: ['硬盘健康', '温度监控', 'S.M.A.R.T.', '免费'],
    github_url: 'https://github.com/hiyohiyo/CrystalDiskInfo',
    github_stars: 8500,
    version: '9.5.0',
    updated_date: '2026-06-15'
  },
  {
    id: 'BulkCrapUninstaller',
    name: 'Bulk Crap Uninstaller',
    platform: 'windows',
    category: 'system',
    category_name: '系统工具',
    description: '强力批量卸载工具，可清理残留与捆绑软件，比系统自带卸载更干净。',
    features: ['批量卸载', '残留清理', '强制删除', '开源'],
    github_url: 'https://github.com/Klocman/Bulk-Crap-Uninstaller',
    github_stars: 6000,
    version: '5.8.0',
    updated_date: '2026-05-20'
  },
  {
    id: 'xiaoli-player',
    name: '小李播放器',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '跨平台媒体播放器，支持在线点播、B 站搜索下载、弹幕与投屏等功能（来自近期热门开源）。',
    features: ['在线点播', 'B 站相关', '弹幕', '投屏'],
    github_url: 'https://github.com/Muzlin/xiaoli-player',
    github_stars: 2000,
    version: '2.66.0',
    updated_date: '2026-10-12'
  },
  {
    id: 'DLSS5Tool',
    name: 'DLSS5Tool',
    platform: 'windows',
    category: 'tools',
    category_name: '实用工具',
    description: 'Windows 本地图像 / 视频增强工具，借助神经渲染做超分与插帧，适合内容创作者（需对应显卡）。',
    features: ['超分增强', '插帧', '本地处理', '开源'],
    github_url: 'https://github.com/banbanzhige/DLSS5Tool',
    github_stars: 135,
    version: '3.0.0',
    updated_date: '2026-10-12'
  },
  {
    id: 'Audacity',
    name: 'Audacity',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '经典开源音频编辑器，剪辑播客、降噪、导出 MP3 等场景国内创作者常用。',
    features: ['音频剪辑', '降噪', '多轨', '免费开源'],
    github_url: 'https://github.com/audacity/audacity',
    github_stars: 16000,
    version: '3.7.0',
    updated_date: '2026-08-01'
  },
  {
    id: 'VLC',
    name: 'VLC media player',
    platform: 'windows',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '万能开源播放器，几乎能播所有格式，无需额外解码器，兼容性极强。',
    features: ['全格式', '流媒体', '字幕', '跨平台'],
    github_url: 'https://github.com/videolan/vlc',
    github_stars: 18000,
    version: '3.0.21',
    updated_date: '2026-06-01'
  },

  // —— Android：国内常用 ——
  {
    id: 'Legado',
    name: '阅读 Legado',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '开源网络小说阅读器「阅读 3.0」，书源生态庞大，是国内 Android 看书用户最常用的开源阅读 App 之一。',
    features: ['自定义书源', '本地书籍', 'RSS', '开源'],
    github_url: 'https://github.com/gedoor/legado',
    github_stars: 42000,
    version: '3.25.0',
    updated_date: '2026-10-01'
  },
  {
    id: 'Mihon',
    name: 'Mihon',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: 'Tachiyomi 继任者，开源漫画阅读器，扩展源丰富，适合追漫画与本地漫画库管理。',
    features: ['漫画扩展', '本地库', '更新追踪', '开源'],
    github_url: 'https://github.com/mihonapp/mihon',
    github_stars: 20000,
    version: '0.17.0',
    updated_date: '2026-09-20'
  },
  {
    id: 'Seal',
    name: 'Seal',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '基于 yt-dlp 的 Android 视频下载器，可下载各平台公开视频到本地，界面简洁。',
    features: ['视频下载', 'yt-dlp', '字幕下载', '开源'],
    github_url: 'https://github.com/JunkFood02/Seal',
    github_stars: 22000,
    version: '1.13.0',
    updated_date: '2026-09-01'
  },
  {
    id: 'MaterialFiles',
    name: 'Material Files',
    platform: 'android',
    category: 'tools',
    category_name: '实用工具',
    description: 'Material Design 风格的开源文件管理器，支持根目录、压缩包与 FTP，替代系统文件应用。',
    features: ['Material Design', '压缩包', 'FTP', '开源'],
    github_url: 'https://github.com/zhanghai/MaterialFiles',
    github_stars: 7500,
    version: '1.7.0',
    updated_date: '2026-07-01'
  },
  {
    id: 'AnkiDroid',
    name: 'AnkiDroid',
    platform: 'android',
    category: 'office',
    category_name: '办公效率',
    description: '开源间隔重复记忆卡片 App，考研、英语背单词与医学记忆国内用户广泛使用。',
    features: ['间隔重复', '牌组同步', '多媒体卡片', '开源'],
    github_url: 'https://github.com/ankidroid/Anki-Android',
    github_stars: 10000,
    version: '2.20.0',
    updated_date: '2026-09-10'
  },
  {
    id: 'Markor',
    name: 'Markor',
    platform: 'android',
    category: 'office',
    category_name: '办公效率',
    description: '轻量 Markdown 笔记与待办应用，纯本地、无追踪，适合快速记笔记与写日记。',
    features: ['Markdown', '待办', '本地优先', '轻量'],
    github_url: 'https://github.com/gsantner/markor',
    github_stars: 5500,
    version: '2.14.0',
    updated_date: '2026-06-01'
  },
  {
    id: 'Aegis',
    name: 'Aegis Authenticator',
    platform: 'android',
    category: 'security',
    category_name: '安全防护',
    description: '开源双因素认证（2FA）应用，支持加密备份与图标自定义，替代 Google Authenticator。',
    features: ['2FA / TOTP', '加密备份', '图标包', '开源'],
    github_url: 'https://github.com/beemdevelopment/Aegis',
    github_stars: 12000,
    version: '3.0.0',
    updated_date: '2026-08-01'
  },
  {
    id: 'Obtainium',
    name: 'Obtainium',
    platform: 'android',
    category: 'tools',
    category_name: '实用工具',
    description: '直接从 GitHub / GitLab 等来源获取并更新 App，减少对应用商店的依赖。',
    features: ['GitHub 更新', '追踪 Release', '跳过商店', '开源'],
    github_url: 'https://github.com/ImranR98/Obtainium',
    github_stars: 14000,
    version: '1.1.0',
    updated_date: '2026-09-25'
  },
  {
    id: 'AppManager',
    name: 'App Manager',
    platform: 'android',
    category: 'system',
    category_name: '系统工具',
    description: '强大的开源应用管理器，可查看权限、组件、备份应用，进阶用户排查软件时常用。',
    features: ['权限管理', '组件控制', '应用备份', '开源'],
    github_url: 'https://github.com/MuntashirAkon/AppManager',
    github_stars: 7000,
    version: '4.0.0',
    updated_date: '2026-08-18'
  },
  {
    id: 'Shizuku',
    name: 'Shizuku',
    platform: 'android',
    category: 'system',
    category_name: '系统工具',
    description: '让普通应用以接近 adb / root 的高权限运行的框架，许多高级工具的前置依赖。',
    features: ['高权限桥接', '无线调试', '开发者工具', '开源'],
    github_url: 'https://github.com/RikkaApps/Shizuku',
    github_stars: 18000,
    version: '13.5.0',
    updated_date: '2026-07-10'
  },
  {
    id: 'Syncthing-Android',
    name: 'Syncthing-Fork',
    platform: 'android',
    category: 'network',
    category_name: '网络通讯',
    description: 'Syncthing 的 Android 增强版，手机与电脑局域网互相同步照片与文档，不经过第三方云。',
    features: ['P2P 同步', '相册备份', '无云厂商', '开源'],
    github_url: 'https://github.com/Catfriend1/syncthing-android',
    github_stars: 5000,
    version: '1.28.0',
    updated_date: '2026-09-01'
  },
  {
    id: 'FairEmail',
    name: 'FairEmail',
    platform: 'android',
    category: 'network',
    category_name: '网络通讯',
    description: '注重注重隐私的开源邮件客户端，功能完整、可高度自定义，适合工作邮箱。',
    features: ['隐私友好', '多账户', '推送可选', '开源'],
    github_url: 'https://github.com/M66B/FairEmail',
    github_stars: 4000,
    version: '1.2250',
    updated_date: '2026-10-01'
  },
  {
    id: 'Auxio',
    name: 'Auxio',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '简洁现代的本地音乐播放器，无广告无联网追踪，适合听本地曲库。',
    features: ['本地音乐', '无广告', 'Material You', '开源'],
    github_url: 'https://github.com/OxygenCobalt/Auxio',
    github_stars: 3500,
    version: '4.0.0',
    updated_date: '2026-08-05'
  },
  {
    id: 'LibreTube',
    name: 'LibreTube',
    platform: 'android',
    category: 'entertainment',
    category_name: '影音娱乐',
    description: '隐私友好的 YouTube 第三方客户端，可后台播放与赞助区块跳过（需可用网络环境）。',
    features: ['后台播放', '无官方追踪', 'SponsorBlock', '开源'],
    github_url: 'https://github.com/libre-tube/LibreTube',
    github_stars: 12000,
    version: '0.26.0',
    updated_date: '2026-09-15'
  }
];

function sqlString(value) {
  return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'";
}

const lines = ['-- China-friendly apps seed (no mirrors)'];

for (const app of apps) {
  const features = JSON.stringify(app.features || []);
  const owner = (app.github_url.match(/github\.com\/([^/]+)/) || [])[1] || '';
  const iconUrl = owner ? `https://github.com/${owner}.png` : '';

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

const sqlPath = join(tmpdir(), `shelfhub-seed-cn-${Date.now()}.sql`);
writeFileSync(sqlPath, lines.join('\n'), 'utf8');

console.log(`Seeding ${apps.length} CN-friendly apps (${flag})…`);
try {
  execSync(`npx wrangler d1 execute shelfhub ${flag} --file="${sqlPath}"`, {
    stdio: 'inherit',
    cwd: root
  });
  console.log('Done. Fill 夸克/百度 mirrors in /admin.');
} finally {
  try { unlinkSync(sqlPath); } catch (_) {}
}
