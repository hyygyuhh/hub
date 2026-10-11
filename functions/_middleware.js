import { isIpAllowed, requiresAdminIpGate, clientIp } from './_lib/ip.js';
import { requireAdmin } from './_lib/auth.js';
import { handleSitemap, handleRobots, handleAppSeoPage } from './_lib/seo-pages.js';

function isAdminConsolePath(pathname) {
  if (pathname === '/admin' || pathname === '/admin/') return true;
  if (pathname === '/admin/index.html') return true;
  // Keep console script private; login uses login.js only.
  if (pathname === '/admin/admin.js') return true;
  return false;
}

function isAdminLoginPath(pathname) {
  return pathname === '/admin/login.html' || pathname === '/admin/login';
}

function loginRedirect(request) {
  const url = new URL('/admin/login', request.url);
  return Response.redirect(url.toString(), 302);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  // Dynamic SEO endpoints (must run before static SPA fallback).
  if (pathname === '/sitemap.xml' && request.method === 'GET') {
    return handleSitemap(request, env);
  }
  if (pathname === '/robots.txt' && request.method === 'GET') {
    return handleRobots(request);
  }
  if (pathname.startsWith('/a/') && request.method === 'GET') {
    const id = pathname.slice(3).replace(/\/$/, '');
    if (id) return handleAppSeoPage(request, env, id);
  }

  if (requiresAdminIpGate(pathname) && !isIpAllowed(request, env)) {
    const ip = clientIp(request) || 'unknown';
    const body = pathname.startsWith('/api/')
      ? JSON.stringify({ error: '当前 IP 无权访问管理后台', ip })
      : `<!doctype html><meta charset="utf-8"><title>403</title><body style="font-family:sans-serif;padding:2rem"><h1>403</h1><p>当前 IP（${ip}）不在管理后台白名单中。</p><p>请在 Cloudflare Pages 环境变量 <code>ADMIN_ALLOWED_IPS</code> 中加入该 IP。</p></body>`;
    return new Response(body, {
      status: 403,
      headers: {
        'Content-Type': pathname.startsWith('/api/')
          ? 'application/json; charset=utf-8'
          : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  // Unauthenticated users must not receive the console HTML/JS.
  if (isAdminConsolePath(pathname)) {
    if (!env.DB) {
      return new Response('数据库未绑定', { status: 500 });
    }
    const session = await requireAdmin(request, env);
    if (!session) {
      if (pathname === '/admin/admin.js') {
        return new Response('// unauthorized\n', {
          status: 401,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        });
      }
      return loginRedirect(request);
    }
  }

  // Logged-in users hitting login page → console
  if (isAdminLoginPath(pathname) && env.DB) {
    const session = await requireAdmin(request, env);
    if (session) {
      return Response.redirect(new URL('/admin/', request.url).toString(), 302);
    }
  }

  const response = await next();
  // Prevent caching of admin documents
  if (pathname.startsWith('/admin')) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  return response;
}
