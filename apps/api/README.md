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
| `src/app.ts` | The Hono app (`basePath('/api')`), CORS, health routes, `/api/admin/*`, `notFound`, `handleError`, `AppType` |
| `src/auth.ts` | `requireStaff` for `/api/admin/*`: Clerk session → `c.get('staff')` |
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
   without it, Sentry is disabled. Copy `apps/api/.dev.vars.example` and fill in `CLERK_SECRET_KEY`,
   `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY` and `CLERK_ORG_ID` (see below). `ENVIRONMENT`,
   `RESTAURANT`, `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` come from `[vars]` in `wrangler.toml`.

2. `pnpm dev` (from the repo root) runs the API on <http://localhost:8787>, the public site on
   <http://localhost:4321> and the admin on <http://localhost:5173>. The local `CORS_ORIGINS`
   allows exactly those two dev servers. Run the API alone with `pnpm --filter @piccolo/api dev`.

To try a frontend exactly as its Worker serves it, build it and run `pnpm --filter @piccolo/web preview`
(<http://localhost:8788>) or `pnpm --filter @piccolo/admin preview` (<http://localhost:8789>).
The preview origin is not in `CORS_ORIGINS` or `CLERK_AUTHORIZED_PARTIES`. Sign-in against the
API uses `pnpm dev`, where the admin is <http://localhost:5173>.

| Path | Response |
|---|---|
| `GET /api/health` | `{ ok: true, version }`. Never touches the database, so it is safe for uptime pings (docs/STACK.md rule 3). |
| `GET /api/health/db` | `{ ok: true }` after `select 1`, or 500. Wakes the Neon compute, so call it rarely. |
| `GET /api/admin/ping` | `{ userId }` for a signed-in member of `CLERK_ORG_ID`. 401 `{ error: 'unauthenticated' }` with no session, 403 `{ error: 'forbidden' }` for anyone else. |
| anything else | 404 `{ error: 'not_found', message }` |

## CORS

The frontends call this API from other origins. `CORS_ORIGINS` lists the exact origins allowed,
comma-separated. A request from any other origin gets no CORS headers, so the browser blocks the
response. Preflights from allowed origins get 204 with `Content-Type` and `Authorization` allowed.

There are no cookies and no credentials mode. The admin sends the Clerk session as
`Authorization: Bearer <token>`. When a frontend moves to a new hostname, update
`CORS_ORIGINS` for that environment. The admin origin also has to be listed in
`CLERK_AUTHORIZED_PARTIES` (see below).

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
| `/api/admin/*` without a Clerk session | 401 | `{ error: 'unauthenticated' }` |
| `/api/admin/*` session, not a member of `CLERK_ORG_ID` | 403 | `{ error: 'forbidden' }` |

Staff routes are mounted under `/api/admin/*`, which is where `requireStaff` runs. A route
outside that prefix is public.

## Clerk on Workers

Staff sign in on the admin SPA (`admin.<domain>`, locally <http://localhost:5173>). Customers
never enter Clerk. The only role is membership of the organization in `CLERK_ORG_ID`.

The admin and the API are different origins (docs/STACK.md §1). CORS does not allow credentials,
and the `__session` cookie is not sent. The admin attaches the session from
`useAuth().getToken()` as `Authorization: Bearer <token>`. That helper is
`adminAuthorizationHeaders` in `apps/admin/src/apiAuth.ts`. Issue #20's
`createApiClient({ headers })` is where it plugs in. `packages/api-client` on this
branch is still the stub; this change does not add the typed client.

`requireStaff` calls `createClerkClient({ secretKey, publishableKey }).authenticateRequest`
when the request carries `Authorization: Bearer <token>`. Clerk then verifies that token and
does not run the cookie handshake. Verification is networkless via `jwtKey` (`CLERK_JWT_KEY`):
the Worker checks the session JWT locally instead of fetching JWKS from Clerk on every request.
No bearer token, or a token Clerk rejects, is 401. The missing-token case does not call Clerk,
so `curl` without a session is 401 even when the publishable key is not configured yet.
`c.get('staff')` is set only when `orgId === CLERK_ORG_ID`.

Gotchas:

- **Bundle size.** Import `createClerkClient` from `@clerk/backend` and nothing else from that
  package. The Worker already has `nodejs_compat`. A dry-run upload of this Worker is about
  1365 KiB uncompressed / 274 KiB gzip, under the Paid plan's 10 MB limit. Do not pull Clerk
  into a second bundle.
- **`authorizedParties`.** Clerk puts the admin origin in the token's `azp` claim. Pass that
  origin, exactly, including scheme and port (`http://localhost:5173` in local dev, not the
  public site and not the API). `CLERK_AUTHORIZED_PARTIES` is a comma-separated var in
  `wrangler.toml`. If the list is empty, Clerk skips the check, so the middleware rejects the
  request instead of calling Clerk.
- **`CLERK_JWT_KEY`.** Dashboard → API keys → Show JWT public key → PEM Public Key. Required.
  Without it the middleware fails closed (500) rather than falling back to a JWKS network call.
  Quote the multi-line PEM in `.dev.vars`.
- **Bearer, not cookie.** Do not expect `__session` to arrive. A request with only that cookie
  is unauthenticated here. The old single-origin model is not how this API is hosted.
- **Organization id in the session token.** `authenticateRequest` does not look up membership.
  It reads `orgId` from the token: v2 tokens use `o.id`, older tokens use `org_id`, and only
  when that organization is the active one. The admin calls `setActive` for `VITE_CLERK_ORG_ID`
  before it calls the API. If you customized the session token in the Clerk Dashboard and
  dropped `o` / `org_id`, put it back, or every member is 403 with no `orgId`.

The admin publishable key is `VITE_CLERK_PUBLISHABLE_KEY`, baked in at build time from the
repo-root `.env` (the admin Worker is assets-only and has no runtime env). The API reads
`CLERK_PUBLISHABLE_KEY` at runtime. They are the same key. `CLERK_SECRET_KEY` and
`CLERK_JWT_KEY` stay on the API.

## Environments and secrets

`wrangler.toml` defines three environments:
- the top level, for local development
- `staging`, deployed as `piccolo-api-staging`
- `production`, deployed as `piccolo-api-production`

Each deployed environment sets `ENVIRONMENT`, `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES`, and
binds `HYPERDRIVE`. The Hyperdrive ids and the origin URLs are **placeholders** until manual
issue #40 creates the resources and replaces them.

Secrets are never written into `wrangler.toml`. Set them per environment:

```bash
wrangler secret put SENTRY_DSN --env staging
```

| Name | Kind | Where |
|---|---|---|
| `SENTRY_DSN` | secret | `wrangler secret put` per environment; `.dev.vars` locally |
| `DATABASE_URL` | secret | `.dev.vars` only. Deployed environments use the `HYPERDRIVE` binding instead |
| `CLERK_SECRET_KEY` | secret | `wrangler secret put` per environment; `.dev.vars` locally |
| `CLERK_PUBLISHABLE_KEY` | secret | same. Not secret in the cryptographic sense, but it is not written into `wrangler.toml`. The admin build uses `VITE_CLERK_PUBLISHABLE_KEY` |
| `CLERK_JWT_KEY` | secret | same. PEM public key for networkless session JWT verification (`jwtKey`) |
| `CLERK_ORG_ID` | secret | same. Organization id of this restaurant's staff |
| `ENVIRONMENT` | var | `wrangler.toml`: `development`, `staging` or `production`, also the Sentry environment |
| `RESTAURANT` | var | `wrangler.toml`: the `RestaurantConfig` instance (`loadConfig`) |
| `CORS_ORIGINS` | var | `wrangler.toml`: the web and admin origins for that environment |
| `CLERK_AUTHORIZED_PARTIES` | var | `wrangler.toml`: admin origins whose session tokens are accepted (`azp`) |
