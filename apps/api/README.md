# @piccolo/api

The one Worker per customer: Hono on `/api/*`, and the static builds of `apps/web` (at `/`) and
`apps/admin` (at `/admin/*`) from the same origin (docs/STACK.md §1).

| File | What |
|---|---|
| `src/index.ts` | The Worker `fetch`: routes to Hono or the assets, `/admin` SPA fallback, `withSentry` |
| `src/app.ts` | The Hono app (`basePath('/api')`), health routes, `notFound`, `handleError`, `AppType` |
| `src/middleware.ts` | `withConfig` → `c.get('config')`, `withDb` → `c.get('db')` |
| `src/validation.ts` | `validate(target, schema)`: `@hono/zod-validator` with the API's 400 shape |
| `src/errors.ts` | `HttpError(status, code, message)` |
| `src/env.ts` | The bindings type (`Bindings`) and the Hono env (`AppEnv`) |
| `scripts/copy-assets.mjs` | Copies `apps/web/dist` → `public/` and `apps/admin/dist` → `public/admin/` |

## Run it locally

1. Create `apps/api/.dev.vars` (git-ignored; never commit it). Wrangler reads local secrets from it:

   ```ini
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require"
   SENTRY_DSN="https://…@….ingest.sentry.io/…"
   ```

   `DATABASE_URL` is your Neon development branch's pooled URL, the same one as in the repo-root
   `.env` (see packages/db/README.md). Quote it: it contains `&`. `SENTRY_DSN` is optional; without
   it Sentry is disabled. `ENVIRONMENT` and `RESTAURANT` come from `[vars]` in `wrangler.toml`.

2. Build once, so `public/` holds both frontends, then start the Worker:

   ```bash
   pnpm build
   pnpm --filter @piccolo/api dev
   ```

   <http://localhost:8787> serves everything: `/megrendeles/`, `/admin/`, `/api/health`. For
   frontend work `pnpm dev` is faster: it also runs Astro on :4321 and Vite on :5173 with hot
   reload. Rebuild before checking the Worker's own static serving.

| Path | Response |
|---|---|
| `GET /api/health` | `{ ok: true, version }`. Touches no binding, never the database: safe for uptime pings (docs/STACK.md rule 3). |
| `GET /api/health/db` | `{ ok: true }` after `select 1`, or 500. Wakes the Neon compute, so call it rarely. |

## Static files and the `/admin` fallback

`pnpm build` builds both frontends, then `scripts/copy-assets.mjs` fills `public/` (git-ignored,
except `.assetsignore`), and `[assets]` in `wrangler.toml` serves it. For each request:

1. A path under `/api` goes to Hono (`run_worker_first = ["/api/*"]`, so a file in `public/` can
   never shadow it).
2. An existing file is served as is. Cloudflare's default HTML handling applies:
   `/megrendeles` and `/admin` redirect (307) to their trailing-slash form.
3. A miss under `/admin` gets `/admin/` (the SPA's `index.html`) with 200, so client-side routes
   such as `/admin/orders/123` survive a reload.
4. Any other miss returns the assets' own 404.

Step 3 is in `src/index.ts`, not `not_found_handling = "single-page-application"`, because that
setting is global: it would also answer every public 404 with the admin shell.

## Adding a route

Keep the handler thin: parse, call `packages/core`, query, respond. Domain rules never live here
(docs/STACK.md rule 6).

```ts
// src/routes/menu.ts
import { z } from 'zod';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { HttpError } from '../errors';
import { withConfig, withDb } from '../middleware';
import { validate } from '../validation';

export const menu = new Hono<AppEnv>()
  .use(withConfig, withDb)
  .get('/:year/:week', validate('param', z.object({ year: z.coerce.number().int(), week: z.coerce.number().int() })), async (c) => {
    const { year, week } = c.req.valid('param');
    const db = c.get('db');
    // …
    if (!found) throw new HttpError(404, 'week_not_found', `No menu for ${year}/${week}`);
    return c.json({ /* … */ });
  });
```

Mount it in `src/app.ts` by chaining `.route('/menu', menu)` onto `app`. Chaining keeps `AppType`
complete for the RPC client (`packages/api-client`).

- `withConfig` and `withDb` are attached where they are needed, never globally, so `/api/health`
  and unknown paths touch no binding. `withDb` opens one client per request (Hyperdrive pools in
  deployed environments; locally `DATABASE_URL`) and releases it after the response.
- `db.execute(sql\`…\`)` returns a node-postgres `QueryResult`: read `.rows`.

### Error bodies

Every response is JSON. The `error` code is machine-readable; the frontends map it to Hungarian copy
in their own `strings.ts`. `message` is for developers and never shown to users.

| Cause | Status | Body |
|---|---|---|
| `validate()` fails | 400 | `{ error: 'validation', fields: { 'items.0.qty': 'too_small' } }` (path → zod issue code) |
| Malformed request (e.g. invalid JSON) | 400 | `{ error: 'bad_request', message }` |
| `throw new HttpError(status, code, message)` | `status` | `{ error: code, message }` |
| No such `/api` route | 404 | `{ error: 'not_found', message }` |
| Anything else | 500 | `{ error: 'internal', eventId }`: reported to Sentry, `eventId` finds it there |

## Environments and secrets

`wrangler.toml` defines the top level (local development), `staging` (`piccolo-staging`) and
`production` (`piccolo-production`). Each deployed environment sets `ENVIRONMENT` and binds
`HYPERDRIVE`. The Hyperdrive ids are **placeholders** until manual issue #40 creates the configs
(`wrangler hyperdrive create …`) and replaces them.

Secrets are never written into `wrangler.toml`. Set them per environment:

```bash
wrangler secret put SENTRY_DSN --env staging
```

| Name | Kind | Where |
|---|---|---|
| `SENTRY_DSN` | secret | `wrangler secret put` per environment; `.dev.vars` locally |
| `DATABASE_URL` | secret | `.dev.vars` only. Deployed environments use the `HYPERDRIVE` binding instead |
| `ENVIRONMENT` | var | `wrangler.toml`: `development`, `staging` or `production`, also the Sentry environment |
| `RESTAURANT` | var | `wrangler.toml`: the `RestaurantConfig` instance (`loadConfig`) |
