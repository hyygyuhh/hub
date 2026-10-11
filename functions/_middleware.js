import { isIpAllowed, requiresAdminIpGate, clientIp } from './_lib/ip.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (requiresAdminIpGate(url.pathname) && !isIpAllowed(request, env)) {
    const ip = clientIp(request) || 'unknown';
    const body = url.pathname.startsWith('/api/')
      ? JSON.stringify({ error: '当前 IP 无权访问管理后台', ip })
      : `<!doctype html><meta charset="utf-8"><title>403</title><body style="font-family:sans-serif;padding:2rem"><h1>403</h1><p>当前 IP（${ip}）不在管理后台白名单中。</p><p>请在 Cloudflare Pages 环境变量 <code>ADMIN_ALLOWED_IPS</code> 中加入该 IP。</p></body>`;
    return new Response(body, {
      status: 403,
      headers: {
        'Content-Type': url.pathname.startsWith('/api/')
          ? 'application/json; charset=utf-8'
          : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  return next();
}
