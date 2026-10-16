import { siteOrigin } from '../lib/site';

// Every crawler may read the public site, AI crawlers included: the pages are the restaurant's
// own advertising. The ordering API lives on its own host and is not linked from here.
export function GET() {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteOrigin}/sitemap.xml`, ''].join(
    '\n',
  );
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
