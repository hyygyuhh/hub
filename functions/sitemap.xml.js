import { listApps } from './_lib/apps.js';
import { siteOrigin, appSeoPath } from './_lib/seo.js';

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

export async function onRequestGet(context) {
  const { request, env } = context;
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
