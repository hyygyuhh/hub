import { listApps, getApp } from './apps.js';
import {
  escapeHtml,
  siteOrigin,
  absoluteUrl,
  appSeoPath,
  buildAppDescription,
  buildAppTitle
} from './seo.js';

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toW3CDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function notFoundHtml(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>未找到应用 - 架集 ShelfHub</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${escapeHtml(origin + '/')}">
</head>
<body>
  <h1>未找到该应用</h1>
  <p><a href="/">返回架集首页</a></p>
</body>
</html>`;
}

async function handleSitemap(request, env) {
  const origin = siteOrigin(request);
  let apps = [];
  if (env.DB) {
    try {
      apps = await listApps(env.DB);
    } catch (_) {
      apps = [];
    }
  }

  const urls = [
    {
      loc: origin + '/',
      lastmod: toW3CDate(apps[0] && (apps[0].updatedAt || apps[0].updatedDate)),
      changefreq: 'daily',
      priority: '1.0'
    }
  ];

  apps.forEach(app => {
    urls.push({
      loc: origin + appSeoPath(app.id),
      lastmod: toW3CDate(app.updatedAt || app.updatedDate),
      changefreq: 'weekly',
      priority: '0.8'
    });
  });

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        u =>
          `  <url>\n` +
          `    <loc>${xmlEscape(u.loc)}</loc>\n` +
          `    <lastmod>${xmlEscape(u.lastmod)}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600'
    }
  });
}

function handleRobots(request) {
  const origin = siteOrigin(request);
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    'Sitemap: ' + origin + '/sitemap.xml',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function handleAppSeoPage(request, env, id) {
  const origin = siteOrigin(request);
  id = decodeURIComponent(id || '').trim();

  if (!id || !env.DB) {
    return new Response(notFoundHtml(origin), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  let app;
  try {
    app = await getApp(env.DB, id);
  } catch (_) {
    app = null;
  }

  if (!app) {
    return new Response(notFoundHtml(origin), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  const title = buildAppTitle(app);
  const description = buildAppDescription(app);
  const pageUrl = absoluteUrl(origin, appSeoPath(app.id));
  const spaUrl = origin + '/#app/' + encodeURIComponent(app.id);
  const platform = app.platform === 'windows' ? 'Windows' : 'Android';
  const iconUrl = app.icon && !String(app.icon).startsWith('data:')
    ? absoluteUrl(origin, app.icon)
    : '';

  const keywords = Array.from(
    new Set(
      [
        app.name,
        app.name + '下载',
        app.name + ' GitHub',
        platform + '软件',
        app.categoryName,
        'GitHub镜像',
        '夸克网盘',
        '百度网盘',
        '架集',
        'ShelfHub'
      ].filter(Boolean)
    )
  ).join(',');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: app.description || description,
    applicationCategory: app.categoryName || 'UtilitiesApplication',
    operatingSystem: platform,
    softwareVersion: app.version || undefined,
    url: pageUrl,
    downloadUrl: spaUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY'
    }
  };
  if (app.githubUrl) ld.codeRepository = app.githubUrl;
  if (iconUrl) ld.image = iconUrl;
  if (app.githubStars > 0) {
    ld.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: app.githubStars
    };
  }

  const features = (app.features || [])
    .slice(0, 8)
    .map(f => `<li>${escapeHtml(f)}</li>`)
    .join('');

  const mirrors = (app.downloadSources || [])
    .map(s => `<li>${escapeHtml(s.name || s.type)} 镜像已收录</li>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="架集 ShelfHub">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:locale" content="zh_CN">
  ${iconUrl ? `<meta property="og:image" content="${escapeHtml(iconUrl)}">` : ''}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}">
  <style>
    body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a}
    a{color:#0f6e64}
    .meta{color:#555;font-size:.9rem}
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(app.name)}</h1>
    <p class="meta">${escapeHtml(platform)} · ${escapeHtml(app.categoryName || '')}${app.version ? ' · v' + escapeHtml(app.version) : ''}${app.size ? ' · ' + escapeHtml(app.size) : ''}</p>
    <p>${escapeHtml(app.description || description)}</p>
    ${features ? `<h2>亮点</h2><ul>${features}</ul>` : ''}
    ${mirrors ? `<h2>下载镜像</h2><ul>${mirrors}</ul>` : ''}
    <p><a href="${escapeHtml(spaUrl)}">在架集打开并下载</a> · <a href="/">返回首页</a></p>
    ${app.githubUrl ? `<p><a href="${escapeHtml(app.githubUrl)}" rel="noopener noreferrer">GitHub 仓库</a></p>` : ''}
  </article>
  <script>location.replace(${JSON.stringify(spaUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

export { handleSitemap, handleRobots, handleAppSeoPage };
