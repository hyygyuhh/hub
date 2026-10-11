function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    ''
  );
}

function parseAllowlist(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchCidr(ip, rule) {
  if (!rule.includes('/')) return ip === rule;
  const [base, bitsStr] = rule.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt == null || baseInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isIpAllowed(request, env) {
  const allow = parseAllowlist(env.ADMIN_ALLOWED_IPS);
  if (!allow.length) return true;
  const ip = clientIp(request);
  if (!ip) return false;
  return allow.some(rule => {
    if (rule.includes(':')) return ip === rule; // basic IPv6 exact match
    return matchCidr(ip, rule);
  });
}

function requiresAdminIpGate(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin');
}

export { clientIp, parseAllowlist, isIpAllowed, requiresAdminIpGate };
