/**
 * 本地兜底数据。生产环境前台优先请求 GET /api/apps（Cloudflare D1）。
 * 仅在 API 不可用时使用本数组；日常请在 /admin/ 后台维护应用。
 */
const APPS_DATA = [];
