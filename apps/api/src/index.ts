import { withSentry } from '@sentry/cloudflare';
import { app } from './app';
import type { Bindings } from './env';

export type { AppType } from './app';

const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');
const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

/**
 * `/api/*` goes to Hono. Everything else is a static file from `public/`: the Astro build at `/`
 * and the admin SPA at `/admin/`. An unknown path under `/admin` gets the SPA shell with 200 so
 * the client router can resolve it; any other miss keeps the assets' own 404.
 *
 * The fallback lives here rather than in `[assets] not_found_handling`, because that setting is
 * global and would also turn every public 404 into the admin shell.
 */
export const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isApiPath(url.pathname)) {
      return app.fetch(request, env, ctx);
    }
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404 && isAdminPath(url.pathname)) {
      // `/admin/`, not `/admin/index.html`: the assets' HTML handling redirects the latter.
      return env.ASSETS.fetch(new Request(new URL('/admin/', url), request));
    }
    return asset;
  },
} satisfies ExportedHandler<Bindings>;

export default withSentry<Bindings>(
  (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? 'development',
  }),
  handler,
);
