import { siteOrigin } from './_lib/seo.js';

export async function onRequestGet(context) {
  const origin = siteOrigin(context.request);
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
