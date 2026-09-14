import { withSentry } from '@sentry/cloudflare';
import { app } from './app';
import type { Bindings } from './env';

export type { AppType } from './app';

/**
 * The API Worker: `/api/*` only. The public site and the admin are separate assets-only Workers
 * (apps/web, apps/admin).
 *
 * `fetch` wraps `app.fetch` in a plain object instead of exporting the Hono app, because
 * `withSentry` would otherwise also hook `onError` and report every error twice: `handleError`
 * already reports to Sentry itself, since the response carries the event id.
 */
const handler = {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Bindings>;

export default withSentry<Bindings>(
  (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? 'development',
  }),
  handler,
);
