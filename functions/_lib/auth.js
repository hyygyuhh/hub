const COOKIE_NAME = 'shelfhub_session';
const SESSION_DAYS = 14;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function isHttps(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch (_) {
    return true;
  }
}

function sessionCookie(request, token, maxAgeSec) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (isHttps(request)) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie(request) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isHttps(request)) parts.push('Secure');
  return parts.join('; ');
}

async function createSession(env) {
  if (!env.DB) throw new Error('DB binding missing');
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)'
  ).bind(tokenHash, expires).run();
  return { token, expires };
}

async function destroySession(env, token) {
  if (!token || !env.DB) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
}

async function requireAdmin(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT token_hash, expires_at FROM admin_sessions WHERE token_hash = ?'
  ).bind(tokenHash).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { token };
}

async function timingSafeEqual(a, b) {
  // Trim to avoid trailing newlines from secret piping / form paste.
  const ah = await sha256Hex(String(a == null ? '' : a).trim());
  const bh = await sha256Hex(String(b == null ? '' : b).trim());
  if (ah.length !== bh.length) return false;
  let out = 0;
  for (let i = 0; i < ah.length; i++) out |= ah.charCodeAt(i) ^ bh.charCodeAt(i);
  return out === 0;
}

export {
  COOKIE_NAME,
  SESSION_DAYS,
  json,
  error,
  sha256Hex,
  createSession,
  destroySession,
  requireAdmin,
  sessionCookie,
  clearSessionCookie,
  parseCookies,
  timingSafeEqual
};
