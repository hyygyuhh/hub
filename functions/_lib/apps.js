const ALLOWED_MIRROR_TYPES = new Set(['quark', 'baidu']);

function parseFeatures(raw) {
  if (Array.isArray(raw)) {
    return raw.map(String).map(s => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(f => {
          if (typeof f === 'string') return f.trim();
          if (f && f.title) return String(f.title).trim();
          return '';
        }).filter(Boolean);
      }
    } catch (_) {
      return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function rowToApp(row, sources = []) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    category: row.category,
    categoryName: row.category_name,
    description: row.description || '',
    features: parseFeatures(row.features),
    githubUrl: row.github_url || '',
    githubStars: Number(row.github_stars) || 0,
    icon: row.icon || '',
    size: row.size || '',
    version: row.version || '',
    updatedDate: row.updated_date || '',
    popularity: Number(row.popularity) || 0,
    downloadSources: sources.map(s => ({
      name: s.name,
      url: s.url,
      type: s.type
    })),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function loadSourcesMap(db, appIds) {
  const map = new Map();
  if (!appIds.length) return map;
  const placeholders = appIds.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT app_id, name, url, type FROM download_sources
     WHERE app_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`
  ).bind(...appIds).all();
  (results || []).forEach(s => {
    if (!map.has(s.app_id)) map.set(s.app_id, []);
    map.get(s.app_id).push(s);
  });
  return map;
}

async function listApps(db) {
  const { results } = await db.prepare(
    'SELECT * FROM apps ORDER BY github_stars DESC, name ASC'
  ).all();
  const rows = results || [];
  const sourcesMap = await loadSourcesMap(db, rows.map(r => r.id));
  return rows.map(r => rowToApp(r, sourcesMap.get(r.id) || []));
}

async function getApp(db, id) {
  const row = await db.prepare('SELECT * FROM apps WHERE id = ?').bind(id).first();
  if (!row) return null;
  const sourcesMap = await loadSourcesMap(db, [id]);
  return rowToApp(row, sourcesMap.get(id) || []);
}

function normalizeAppPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') throw new Error('无效的请求体');

  const pick = (key, alt) => (body[key] !== undefined ? body[key] : body[alt]);

  const id = String(pick('id') ?? '').trim();
  const name = String(pick('name') ?? '').trim();
  const platform = String(pick('platform') ?? '').trim();
  const category = String(pick('category') ?? '').trim();
  const categoryName = String(pick('categoryName') ?? pick('category_name') ?? '').trim();
  const description = String(pick('description') ?? '').trim();
  const features = parseFeatures(pick('features'));
  const githubUrl = String(pick('githubUrl') ?? pick('github_url') ?? '').trim();
  const githubStars = Number(pick('githubStars') ?? pick('github_stars') ?? 0) || 0;
  const icon = String(pick('icon') ?? '').trim();
  const size = String(pick('size') ?? '').trim();
  const version = String(pick('version') ?? '').trim();
  const updatedDate = String(pick('updatedDate') ?? pick('updated_date') ?? '').trim();
  const popularity = Number(pick('popularity') ?? 0) || 0;

  let downloadSources = pick('downloadSources') ?? pick('download_sources') ?? [];
  if (!Array.isArray(downloadSources)) downloadSources = [];
  downloadSources = downloadSources
    .map(s => ({
      name: String(s.name || '').trim(),
      url: String(s.url || '').trim(),
      type: String(s.type || '').trim()
    }))
    .filter(s => s.url && ALLOWED_MIRROR_TYPES.has(s.type));

  if (!partial) {
    if (!id || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(id)) {
      throw new Error('应用 ID 无效（字母数字、短横线或下划线）');
    }
    if (!name) throw new Error('应用名称必填');
    if (platform !== 'windows' && platform !== 'android') throw new Error('平台必须是 windows 或 android');
    if (!category) throw new Error('分类必填');
    if (!categoryName) throw new Error('分类名称必填');
  }

  return {
    id,
    name,
    platform,
    category,
    categoryName,
    description,
    features,
    githubUrl,
    githubStars,
    icon,
    size,
    version,
    updatedDate,
    popularity,
    downloadSources
  };
}

async function replaceSources(db, appId, sources) {
  await db.prepare('DELETE FROM download_sources WHERE app_id = ?').bind(appId).run();
  let order = 0;
  for (const s of sources) {
    await db.prepare(
      'INSERT INTO download_sources (app_id, name, url, type, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).bind(appId, s.name || (s.type === 'quark' ? '夸克网盘' : '百度网盘'), s.url, s.type, order++).run();
  }
}

async function createApp(db, payload) {
  const existing = await db.prepare('SELECT id FROM apps WHERE id = ?').bind(payload.id).first();
  if (existing) throw new Error('应用 ID 已存在');

  await db.prepare(
    `INSERT INTO apps (
      id, name, platform, category, category_name, description, features,
      github_url, github_stars, icon, size, version, updated_date, popularity,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    payload.id,
    payload.name,
    payload.platform,
    payload.category,
    payload.categoryName,
    payload.description,
    JSON.stringify(payload.features),
    payload.githubUrl,
    payload.githubStars,
    payload.icon,
    payload.size,
    payload.version,
    payload.updatedDate,
    payload.popularity
  ).run();

  await replaceSources(db, payload.id, payload.downloadSources);
  return getApp(db, payload.id);
}

async function updateApp(db, id, body) {
  const current = await getApp(db, id);
  if (!current) return null;

  const merged = normalizeAppPayload({
    ...current,
    ...body,
    id,
    categoryName: body.categoryName ?? body.category_name ?? current.categoryName,
    githubUrl: body.githubUrl ?? body.github_url ?? current.githubUrl,
    githubStars: body.githubStars ?? body.github_stars ?? current.githubStars,
    updatedDate: body.updatedDate ?? body.updated_date ?? current.updatedDate,
    downloadSources: body.downloadSources ?? body.download_sources ?? current.downloadSources
  });

  await db.prepare(
    `UPDATE apps SET
      name = ?, platform = ?, category = ?, category_name = ?, description = ?, features = ?,
      github_url = ?, github_stars = ?, icon = ?, size = ?, version = ?, updated_date = ?,
      popularity = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    merged.name,
    merged.platform,
    merged.category,
    merged.categoryName,
    merged.description,
    JSON.stringify(merged.features),
    merged.githubUrl,
    merged.githubStars,
    merged.icon,
    merged.size,
    merged.version,
    merged.updatedDate,
    merged.popularity,
    id
  ).run();

  await replaceSources(db, id, merged.downloadSources);
  return getApp(db, id);
}

async function deleteApp(db, id) {
  const result = await db.prepare('DELETE FROM apps WHERE id = ?').bind(id).run();
  return (result.meta && result.meta.changes) > 0;
}

async function recordEvent(db, type, appId, meta = {}) {
  if (type !== 'app_view' && type !== 'download_click') {
    throw new Error('无效的事件类型');
  }
  if (!appId || typeof appId !== 'string') throw new Error('缺少 app_id');
  await db.prepare(
    'INSERT INTO events (type, app_id, meta, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).bind(type, appId.slice(0, 80), JSON.stringify(meta || {})).run();
}

async function getStats(db, env) {
  const apps = await listApps(db);
  const byPlatform = { windows: 0, android: 0 };
  const byCategory = {};
  const missingMirrors = [];
  const missingGithub = [];
  let latestUpdated = null;

  apps.forEach(app => {
    if (app.platform === 'windows' || app.platform === 'android') byPlatform[app.platform]++;
    byCategory[app.categoryName || app.category] = (byCategory[app.categoryName || app.category] || 0) + 1;
    if (!app.downloadSources.length) missingMirrors.push({ id: app.id, name: app.name });
    if (!app.githubUrl) missingGithub.push({ id: app.id, name: app.name });
    const ts = app.updatedAt || app.updatedDate;
    if (ts && (!latestUpdated || ts > latestUpdated)) latestUpdated = ts;
  });

  const topViews7 = await topEvents(db, 'app_view', 7, 10);
  const topDownloads7 = await topEvents(db, 'download_click', 7, 10);
  const topViews30 = await topEvents(db, 'app_view', 30, 10);
  const topDownloads30 = await topEvents(db, 'download_click', 30, 10);

  const views7 = await countEvents(db, 'app_view', 7);
  const downloads7 = await countEvents(db, 'download_click', 7);
  const views30 = await countEvents(db, 'app_view', 30);
  const downloads30 = await countEvents(db, 'download_click', 30);

  return {
    totalApps: apps.length,
    byPlatform,
    byCategory,
    missingMirrors,
    missingGithub,
    latestUpdated,
    events: {
      views7,
      downloads7,
      views30,
      downloads30,
      topViews7,
      topDownloads7,
      topViews30,
      topDownloads30
    },
    analyticsDashboardUrl: env.ANALYTICS_DASHBOARD_URL || ''
  };
}

async function countEvents(db, type, days) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS c FROM events WHERE type = ? AND created_at >= datetime('now', ?)`
  ).bind(type, `-${days} days`).first();
  return Number(row && row.c) || 0;
}

async function topEvents(db, type, days, limit) {
  const { results } = await db.prepare(
    `SELECT e.app_id AS id, a.name AS name, COUNT(*) AS count
     FROM events e
     LEFT JOIN apps a ON a.id = e.app_id
     WHERE e.type = ? AND e.created_at >= datetime('now', ?)
     GROUP BY e.app_id
     ORDER BY count DESC
     LIMIT ?`
  ).bind(type, `-${days} days`, limit).all();
  return (results || []).map(r => ({
    id: r.id,
    name: r.name || r.id,
    count: Number(r.count) || 0
  }));
}

export {
  listApps,
  getApp,
  normalizeAppPayload,
  createApp,
  updateApp,
  deleteApp,
  recordEvent,
  getStats,
  ALLOWED_MIRROR_TYPES
};
