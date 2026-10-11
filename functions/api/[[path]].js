import {
  json,
  error,
  createSession,
  destroySession,
  requireAdmin,
  sessionCookie,
  clearSessionCookie,
  parseCookies,
  timingSafeEqual,
  COOKIE_NAME,
  SESSION_DAYS
} from '../_lib/auth.js';

import {
  listApps,
  getApp,
  normalizeAppPayload,
  createApp,
  updateApp,
  deleteApp,
  recordEvent,
  getStats
} from '../_lib/apps.js';

import { clientIp, parseAllowlist, isIpAllowed } from '../_lib/ip.js';

const MAX_ICON_BYTES = 400 * 1024;
const ALLOWED_ICON_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const sameOrigin = !origin || origin === url.origin;
  if (!sameOrigin) {
    return null;
  }
  return {
    'Access-Control-Allow-Origin': origin || url.origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function withCors(request, response) {
  const headers = corsHeaders(request);
  if (!headers) {
    return error('CORS denied', 403);
  }
  const next = new Response(response.body, response);
  Object.entries(headers).forEach(([k, v]) => next.headers.set(k, v));
  return next;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}

function partsFromContext(context) {
  const raw = context.params.path;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split('/').filter(Boolean);
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request);
  if (!cors) return error('CORS denied', 403);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!env.DB) {
    return withCors(request, error('数据库未绑定（DB）', 500));
  }

  const parts = partsFromContext(context);
  const method = request.method.toUpperCase();

  try {
    // GET /api/apps
    if (parts[0] === 'apps' && parts.length === 1 && method === 'GET') {
      const apps = await listApps(env.DB);
      return withCors(request, json({ apps }, 200, {
        'Cache-Control': 'public, max-age=30'
      }));
    }

    // GET /api/apps/:id
    if (parts[0] === 'apps' && parts.length === 2 && method === 'GET') {
      const app = await getApp(env.DB, parts[1]);
      if (!app) return withCors(request, error('未找到应用', 404));
      return withCors(request, json({ app }, 200, {
        'Cache-Control': 'public, max-age=30'
      }));
    }

    // POST /api/events
    if (parts[0] === 'events' && parts.length === 1 && method === 'POST') {
      const body = await readJson(request);
      if (!body) return withCors(request, error('无效 JSON'));
      const type = body.type;
      const appId = body.appId || body.app_id;
      await recordEvent(env.DB, type, appId, body.meta || {});
      return withCors(request, json({ ok: true }));
    }

    // Admin routes
    if (parts[0] === 'admin') {
      if (!isIpAllowed(request, env)) {
        return withCors(request, error('当前 IP 无权访问管理后台', 403));
      }

      // POST /api/admin/login
      if (parts[1] === 'login' && parts.length === 2 && method === 'POST') {
        const body = await readJson(request);
        const username = body && body.username;
        const password = body && body.password;
        if (!env.ADMIN_PASSWORD) {
          return withCors(request, error('服务器未配置 ADMIN_PASSWORD', 500));
        }
        // ADMIN_USERNAME 未配置时默认 admin，便于平滑升级
        const expectedUser = String(env.ADMIN_USERNAME || 'admin').trim();
        const userOk = await timingSafeEqual(username, expectedUser);
        const passOk = await timingSafeEqual(password, env.ADMIN_PASSWORD);
        if (!userOk || !passOk) {
          return withCors(request, error('账号或密码错误', 401));
        }
        const { token } = await createSession(env);
        return withCors(request, json({
          ok: true,
          username: expectedUser
        }, 200, {
          'Set-Cookie': sessionCookie(request, token, SESSION_DAYS * 86400)
        }));
      }

      // POST /api/admin/logout
      if (parts[1] === 'logout' && parts.length === 2 && method === 'POST') {
        const cookies = parseCookies(request.headers.get('Cookie') || '');
        await destroySession(env, cookies[COOKIE_NAME]);
        return withCors(request, json({ ok: true }, 200, {
          'Set-Cookie': clearSessionCookie(request)
        }));
      }

      const session = await requireAdmin(request, env);
      if (!session) {
        return withCors(request, error('未登录', 401));
      }

      // GET /api/admin/me
      if (parts[1] === 'me' && parts.length === 2 && method === 'GET') {
        const allow = parseAllowlist(env.ADMIN_ALLOWED_IPS);
        return withCors(request, json({
          ok: true,
          role: 'admin',
          username: String(env.ADMIN_USERNAME || 'admin').trim(),
          ip: clientIp(request),
          ipAllowlistEnabled: allow.length > 0,
          ipAllowlistCount: allow.length
        }));
      }

      // POST /api/admin/upload-icon  { dataUrl or base64 + contentType }
      if (parts[1] === 'upload-icon' && parts.length === 2 && method === 'POST') {
        const body = await readJson(request);
        if (!body) return withCors(request, error('无效 JSON'));

        let dataUrl = String(body.dataUrl || '').trim();
        if (!dataUrl && body.base64) {
          const type = String(body.contentType || 'image/png').toLowerCase();
          if (!ALLOWED_ICON_TYPES.has(type) && type !== 'image/jpg') {
            return withCors(request, error('仅支持 PNG / JPG / WebP / GIF / SVG'));
          }
          const mime = type === 'image/jpg' ? 'image/jpeg' : type;
          dataUrl = 'data:' + mime + ';base64,' + String(body.base64).replace(/\s+/g, '');
        }

        const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
        if (!match) {
          return withCors(request, error('请上传有效的图片（PNG / JPG / WebP / GIF / SVG）'));
        }
        const mime = match[1].toLowerCase();
        if (!ALLOWED_ICON_TYPES.has(mime) && mime !== 'image/jpg') {
          return withCors(request, error('不支持的图片类型'));
        }
        const b64 = match[2].replace(/\s+/g, '');
        const bytes = Math.floor(b64.length * 0.75);
        if (bytes > MAX_ICON_BYTES) {
          return withCors(request, error('图标过大，请压缩到 400KB 以内'));
        }

        const normalized = 'data:' + (mime === 'image/jpg' ? 'image/jpeg' : mime) + ';base64,' + b64;
        return withCors(request, json({ ok: true, icon: normalized, bytes }));
      }

      // GET /api/admin/stats
      if (parts[1] === 'stats' && parts.length === 2 && method === 'GET') {
        const stats = await getStats(env.DB, env);
        return withCors(request, json(stats));
      }

      // GET|POST /api/admin/apps
      if (parts[1] === 'apps' && parts.length === 2) {
        if (method === 'GET') {
          const apps = await listApps(env.DB);
          return withCors(request, json({ apps }));
        }
        if (method === 'POST') {
          const body = await readJson(request);
          try {
            const payload = normalizeAppPayload(body);
            const app = await createApp(env.DB, payload);
            return withCors(request, json({ app }, 201));
          } catch (e) {
            return withCors(request, error(e.message || '创建失败'));
          }
        }
      }

      // PUT|DELETE /api/admin/apps/:id
      if (parts[1] === 'apps' && parts.length === 3) {
        const id = parts[2];
        if (method === 'PUT') {
          const body = await readJson(request);
          try {
            const app = await updateApp(env.DB, id, body || {});
            if (!app) return withCors(request, error('未找到应用', 404));
            return withCors(request, json({ app }));
          } catch (e) {
            return withCors(request, error(e.message || '更新失败'));
          }
        }
        if (method === 'DELETE') {
          const deleted = await deleteApp(env.DB, id);
          if (!deleted) return withCors(request, error('未找到应用', 404));
          return withCors(request, json({ ok: true }));
        }
      }
    }

    return withCors(request, error('Not found', 404));
  } catch (e) {
    console.error('[api]', e);
    return withCors(request, error(e.message || '服务器错误', 500));
  }
}
