import { siteOrigin, sitePaths } from '../lib/site';

export function GET() {
  const urls = sitePaths
    .map((path) => `  <url>\n    <loc>${siteOrigin}${path}</loc>\n  </url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
