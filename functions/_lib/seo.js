function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function siteOrigin(request) {
  const url = new URL(request.url);
  return url.origin;
}

function absoluteUrl(origin, path) {
  if (!path) return origin + '/';
  if (/^https?:\/\//i.test(path)) return path;
  return origin + (path.startsWith('/') ? path : '/' + path);
}

function appSeoPath(id) {
  return '/a/' + encodeURIComponent(id);
}

function truncate(str, max) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function buildHomeDescription(apps) {
  const count = apps.length;
  if (!count) {
    return '架集 ShelfHub - 收录 GitHub 优质开源软件，提供夸克与百度网盘镜像下载。';
  }
  const win = apps.filter(a => a.platform === 'windows').length;
  const android = apps.filter(a => a.platform === 'android').length;
  const names = apps.slice(0, 8).map(a => a.name).filter(Boolean);
  const namePart = names.length ? '，当前收录：' + names.join('、') : '';
  return truncate(
    `架集 ShelfHub 收录 ${count} 款 GitHub 开源软件（Windows ${win} / Android ${android}），提供夸克与百度网盘镜像下载${namePart}。`,
    160
  );
}

function buildHomeKeywords(apps) {
  const base = [
    'GitHub下载',
    'GitHub镜像',
    '开源软件',
    'Windows软件',
    'Android应用',
    '软件下载',
    '夸克网盘',
    '百度网盘',
    '架集',
    'ShelfHub'
  ];
  const extras = [];
  apps.forEach(app => {
    if (app.name) extras.push(app.name);
    if (app.name) extras.push(app.name + '下载');
    if (app.categoryName) extras.push(app.categoryName);
  });
  return Array.from(new Set(base.concat(extras))).slice(0, 40).join(',');
}

function buildAppDescription(app) {
  const platform = app.platform === 'windows' ? 'Windows' : 'Android';
  const mirrors = (app.downloadSources || []).length;
  const bits = [
    app.description || '',
    `${app.name} ${platform} 版镜像下载`,
    app.version ? `版本 ${app.version}` : '',
    mirrors ? `${mirrors} 个国内网盘镜像` : '国内网盘镜像',
    '架集 ShelfHub'
  ].filter(Boolean);
  return truncate(bits.join(' · '), 160);
}

function buildAppTitle(app) {
  const platform = app.platform === 'windows' ? 'Windows' : 'Android';
  return `${app.name} 下载（${platform}）- 架集 ShelfHub`;
}

export {
  escapeHtml,
  siteOrigin,
  absoluteUrl,
  appSeoPath,
  truncate,
  buildHomeDescription,
  buildHomeKeywords,
  buildAppDescription,
  buildAppTitle
};
