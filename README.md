# 架集 ShelfHub

收录 **GitHub 优质开源软件**，提供夸克 / 百度网盘镜像下载。

- 前台：静态编辑型发现站  
- 数据：Cloudflare D1  
- 管理：`/admin/` 密码后台（增删改应用、仪表盘、热门统计）  
- 源码：GitHub；部署：Cloudflare Pages + Pages Functions  

## 项目结构

```
shelfhub/
├── index.html              # 前台
├── admin/                  # 管理后台
├── css/ / js/ / assets/    # 前台资源
├── functions/              # Cloudflare Pages Functions（/api/*）
│   ├── api/[[path]].js
│   └── _lib/
├── worker/
│   └── schema.sql          # D1 建表脚本
├── wrangler.toml
└── js/apps-data.js         # 本地兜底（API 不可用时）
```

## 本地开发

```bash
npm install
copy .dev.vars.example .dev.vars   # Windows；填入 ADMIN_PASSWORD
npm run db:local                  # 初始化本地 D1 表
npm run dev                       # http://localhost:8788 左右
```

- 前台：`/`  
- 后台：`/admin/`（使用 `.dev.vars` 里的密码登录）  

## 部署到 Cloudflare（连接 GitHub）

### 1. 推送仓库到 GitHub

创建空仓库并 push 本项目。

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create shelfhub
```

把输出的 `database_id` 写入根目录 [`wrangler.toml`](wrangler.toml) 的 `database_id` 字段，然后：

```bash
npm run db:remote
```

### 3. 创建 Pages 项目

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create → Pages → Connect to Git  
2. 选择本仓库；构建命令留空；输出目录填 `.`（或按 Wrangler 的 `pages_build_output_dir`）  
3. 在项目设置中绑定 D1：变量名 `DB` → 选择 `shelfhub` 库  
4. 设置 Secrets / 环境变量：  
   - `ADMIN_PASSWORD`（必填，管理员密码；改本地 `.dev.vars` **不会**同步线上）  
   - `ADMIN_ALLOWED_IPS`（可选，管理后台 IP 白名单，逗号分隔；留空不限制）  
   - `ANALYTICS_DASHBOARD_URL`（可选，Web Analytics 控制台链接）  

或用 CLI：

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name=shelfhub
npx wrangler pages deploy . --project-name=shelfhub
```

### 4. 开启 Web Analytics

Cloudflare → Analytics & Logs → Web Analytics → 添加站点。  
把仪表盘 URL 填到 `ANALYTICS_DASHBOARD_URL`，后台「访问分析」即可跳转。

### 5. 使用管理后台

打开 `https://你的域名/admin/` → 密码登录 → **新增应用**。  
前台会通过 `GET /api/apps` 读取 D1 数据；详情浏览与镜像点击会写入事件，用于仪表盘热门榜。

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps` | 公开应用列表 |
| GET | `/api/apps/:id` | 公开应用详情 |
| POST | `/api/events` | 匿名埋点 `app_view` / `download_click` |
| POST | `/api/admin/login` | 登录 |
| POST | `/api/admin/logout` | 退出 |
| GET | `/api/admin/me` | 会话检查 |
| GET | `/api/admin/stats` | 目录概况 + 热门 |
| GET/POST | `/api/admin/apps` | 列表 / 创建 |
| PUT/DELETE | `/api/admin/apps/:id` | 更新 / 删除 |

## 应用字段

后台表单与 API 字段一致：`id`、`name`、`platform`（windows/android）、`category`、`categoryName`、`description`、`features`（字符串数组）、`githubUrl`、`githubStars`、`icon`、`size`、`version`、`updatedDate`、`downloadSources`（仅 `quark` / `baidu`）。

## 许可

站点代码按仓库声明使用；所收录软件版权归各自作者与开源协议所有。
