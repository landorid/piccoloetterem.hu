# @piccolo/api

The API Worker: Hono on `/api/*`, served at `api.<domain>`. It serves no static files. Each
customer gets three Workers (docs/STACK.md §1):

| Worker | App | Hostname | What |
|---|---|---|---|
| `piccolo-api` | `apps/api` | `api.<domain>` | This API |
| `piccolo-web` | `apps/web` | `<domain>` | Assets-only: the Astro build, `not_found_handling = "404-page"` |
| `piccolo-admin` | `apps/admin` | `admin.<domain>` | Assets-only: the Vite SPA, `not_found_handling = "single-page-application"` |

Staging and production suffix the name: `piccolo-api-staging`, `piccolo-admin-production`, and so on.

| File | What |
|---|---|
| `src/index.ts` | The Worker export: `app.fetch` wrapped in `withSentry` |
| `src/app.ts` | The Hono app (`basePath('/api')`), CORS, health routes, `notFound`, `handleError`, `AppType` |
| `src/middleware.ts` | `withConfig` → `c.get('config')`, `withDb` → `c.get('db')` |
| `src/validation.ts` | `validate(target, schema)`: `@hono/zod-validator` with the API's 400 shape |
| `src/errors.ts` | `HttpError(status, code, message)` |
| `src/env.ts` | The bindings type (`Bindings`) and the Hono env (`AppEnv`) |

## Run it locally

1. Create `apps/api/.dev.vars` (git-ignored; never commit it). Wrangler reads local secrets from it:

   ```ini
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require"
   SENTRY_DSN="https://…@….ingest.sentry.io/…"
   ```

   `DATABASE_URL` is your Neon development branch's pooled URL, the same one as in the repo-root
   `.env` (see packages/db/README.md). Quote it, because it contains `&`. `SENTRY_DSN` is optional;
   without it, Sentry is disabled. `ENVIRONMENT`, `RESTAURANT` and `CORS_ORIGINS` come from
   `[vars]` in `wrangler.toml`.

2. `pnpm dev` (from the repo root) runs the API on <http://localhost:8787>, the public site on
   <http://localhost:4321> and the admin on <http://localhost:5173>. The local `CORS_ORIGINS`
   allows exactly those two dev servers. Run the API alone with `pnpm --filter @piccolo/api dev`.

To try a frontend exactly as its Worker serves it, build it and run `pnpm --filter @piccolo/web preview`
(<http://localhost:8788>) or `pnpm --filter @piccolo/admin preview` (<http://localhost:8789>).

| Path | Response |
|---|---|
| `GET /api/health` | `{ ok: true, version }`. Never touches the database, so it is safe for uptime pings (docs/STACK.md rule 3). |
| `GET /api/health/db` | `{ ok: true }` after `select 1`, or 500. Wakes the Neon compute, so call it rarely. |
| anything else | 404 `{ error: 'not_found', message }` |

## CORS

The frontends call this API from other origins. `CORS_ORIGINS` lists the exact origins allowed,
comma-separated. A request from any other origin gets no CORS headers, so the browser blocks the
response. Preflights from allowed origins get 204 with `Content-Type` and `Authorization` allowed.

There are no cookies and no credentials mode. The admin sends the Clerk session as
`Authorization: Bearer <token>` (issue F6). When a frontend moves to a new hostname, update
`CORS_ORIGINS` for that environment.

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

const week = z.object({ year: z.coerce.number().int(), week: z.coerce.number().int() });

export const menu = new Hono<AppEnv>()
  .use(withConfig, withDb)
  .get('/:year/:week', validate('param', week), async (c) => {
    const { year, week } = c.req.valid('param');
    const db = c.get('db');
    // …
    if (!found) throw new HttpError(404, 'week_not_found', `No menu for ${year}/${week}`);
    return c.json({ /* … */ });
  });
```

Mount it in `src/app.ts` by chaining `.route('/menu', menu)` onto `app`. Chaining keeps `AppType`
complete for the RPC client (`packages/api-client`).

- **Where the middleware goes.** Attach `withConfig` and `withDb` where they are needed, never
  globally, so `/api/health` and unknown paths touch no database. `withDb` opens one client per
  request and releases it after the response. Deployed environments pool through Hyperdrive;
  locally it uses `DATABASE_URL`.
- **Reading query results.** `db.execute(sql\`…\`)` returns a node-postgres `QueryResult`: read `.rows`.

### Error bodies

Every response is JSON. The `error` code is machine-readable; the frontends map it to Hungarian copy
in their own `strings.ts`. `message` is for developers and never shown to users.

| Cause | Status | Body |
|---|---|---|
| `validate()` fails | 400 | `{ error: 'validation', fields: { 'items.0.qty': 'too_small' } }` (path → zod issue code) |
| Malformed request (e.g. invalid JSON) | 400 | `{ error: 'bad_request', message }` |
| `throw new HttpError(status, code, message)` | `status` | `{ error: code, message }` |
| No such route | 404 | `{ error: 'not_found', message }` |
| Anything else | 500 | `{ error: 'internal', eventId }`, reported to Sentry; `eventId` finds it there |

## Environments and secrets

`wrangler.toml` defines three environments:
- the top level, for local development
- `staging`, deployed as `piccolo-api-staging`
- `production`, deployed as `piccolo-api-production`

Each deployed environment sets `ENVIRONMENT` and `CORS_ORIGINS` and binds `HYPERDRIVE`. The
Hyperdrive ids and the `CORS_ORIGINS` URLs are **placeholders** until manual issue #40 creates the
resources and replaces them.

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
| `CORS_ORIGINS` | var | `wrangler.toml`: the web and admin origins for that environment |
