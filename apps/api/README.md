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
| `src/config/public.ts` | `publicConfig()`: the part of `RestaurantConfig` that `GET /api/config/public` returns |
| `src/menu/admin.routes.ts` | `/api/admin/menu/*`: permanent items, weeks, closed dates (see below) |
| `src/menu/public.routes.ts` | `GET /api/menu`: the published menu guests order from (see below) |
| `src/menu/public.ts` | `publicWeek()`: one week from the cache, or from the database and cached |
| `src/menu/schemas.ts` | The zod schemas of those routes, kept in step with the `packages/core` types |
| `src/menu/repo.ts` | Their Drizzle queries |
| `src/menu/cache.ts` | The menu cache on Workers KV: `purgeWeek`, `purgeAll`, `week`; `menuCacheFor(env)` |
| `src/menu/memoryKv.ts` | An in-memory `KvStore` for tests |
| `src/orders/public.routes.ts` | `POST /api/orders`: a guest's submission (see below) |
| `src/orders/submit.ts` | `submitOrder()`: the transaction that decides and stores a submission |
| `src/orders/submission.ts` | Its steps without HTTP or database: the week, the rejection, the snapshot rows |
| `src/orders/repo.ts` | Its Drizzle queries |
| `src/orders/schemas.ts` | The zod schema of the submission and its size caps |
| `src/orders/rateLimit.ts` | The per-IP submission limit on Workers KV |
| `src/orders/events.ts` | `OrderEvents`, told after a submission commits; `orderEventsFor(env)` |
| `src/orders/admin.routes.ts` | `/api/admin/orders/*`: the staff's order list, detail, status changes, kitchen summary, delivery list (see below) |
| `src/orders/admin.repo.ts` | Their queries, one statement each |
| `src/orders/admin.schemas.ts` | Their zod schemas and the page size |

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
   <http://localhost:4321> and the admin on <http://localhost:5173>. The top-level `CORS_ORIGINS`
   allows those two dev servers and the deployed development web and admin (see
   [Environments and secrets](#environments-and-secrets)). Run the API alone with
   `pnpm --filter @piccolo/api dev`.

   The top level binds `HYPERDRIVE`, because CI deploys it as the development Worker, and
   `wrangler dev` will not start a Hyperdrive binding without a local connection string in
   `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Wrangler reads that variable from
   the shell only, not from `.dev.vars`. The package's `dev` script (`scripts/dev.mjs`) sets it
   from `DATABASE_URL` in `.dev.vars`, so the Worker talks to the same Neon branch either way. If
   you start `wrangler dev` yourself, export the variable in the shell first.

To try a frontend exactly as its Worker serves it, build it and run `pnpm --filter @piccolo/web preview`
(<http://localhost:8788>) or `pnpm --filter @piccolo/admin preview` (<http://localhost:8789>).
The preview origin is not in `CORS_ORIGINS` or `CLERK_AUTHORIZED_PARTIES`. Sign-in against the
API uses `pnpm dev`, where the admin is <http://localhost:5173>.

| Path | Response |
|---|---|
| `GET /api/health` | `{ ok: true, version }`. Never touches the database, so it is safe for uptime pings (docs/STACK.md rule 3). |
| `GET /api/health/db` | `{ ok: true }` after `select 1`, or 500. Wakes the Neon compute, so call it rarely. |
| `GET /api/menu` | The published menu and the dates a guest can order for now, below. Anonymous. |
| `GET /api/config/public` | `{ name, contact, pickupEnabled, pricing, extras }` from `RestaurantConfig`, for the public site's masthead, footer and copy. Anonymous; no database. `apps/web` fetches it when it builds `/megrendeles`. |
| `POST /api/orders` | A guest's submission: one order per delivery day, below. Anonymous. |
| `GET /api/admin/config` | `{ name }`: the restaurant name from `RestaurantConfig`, for the admin's top bar. No database. Same 401 / 403 as `/api/admin/ping`. |
| `GET /api/admin/ping` | `{ userId }` for a signed-in member of `CLERK_ORG_ID`. 401 `{ error: 'unauthenticated' }` with no session, 403 `{ error: 'forbidden' }` for anyone else. |
| `/api/admin/menu/*` | Staff menu management, below. Same 401 / 403 as `/api/admin/ping`. |
| `/api/admin/orders/*` | Staff order work, below. Same 401 / 403 as `/api/admin/ping`. |
| anything else | 404 `{ error: 'not_found', message }` |

## Admin menu

Under `/api/admin/menu`. Items are `MenuItem` from `packages/core`. The permanent menu and each
week are saved as a whole, in one request: `planPermanentItems` and `planWeek` check them, and
`validateMenuItem` every item. A failure rejects the whole save with 400
`{ error: 'validation', fields }`, keyed by path with core's codes (`sides.2.priceWeekday:
'negative'`, `days.1.soups.0.id: 'not_weekly'`).

| Route | Body → response |
|---|---|
| `GET /items` | `{ allWeek, desserts, pickles, sides, sideExtras }` (the keys of `PublicMenu.permanent`): every permanent item, active and inactive, each section by `sortOrder` |
| `PUT /items` | The same shape (server-owned fields are ignored) → the permanent menu as `GET` returns it |
| `POST /items/:id/sold-out` | `{ soldOut }` → `{ item }`. Weekly and permanent items; 404 `item_not_found` for an unknown id |
| `GET /default-week` | `{ isoYear, isoWeek }`: the week of `firstOrderableDay` now, so next week after this week's last cutoff. The weekly menu editor opens on it. No database query |
| `GET /weeks/:year/:week` | `{ week: { isoYear, isoWeek, publishedAt }, days: { 1…6: { soups, mains } }, featured }`; an empty draft if the week has no row |
| `PUT /weeks/:year/:week` | The same shape (server-owned fields are ignored) → the week as `GET` returns it |
| `POST /weeks/:year/:week/publish` | → `{ week }`. Sets `publishedAt` once; 404 `week_not_found` before the first `PUT`. There is no unpublish |
| `GET /closed-dates?from=&to=` | `{ dates }`, ISO dates, ascending, both ends included |
| `POST /closed-dates` | `{ date }` → `{ date, created }`; `created: false` when it was already closed |
| `DELETE /closed-dates/:date` | → `{ date, deleted }`; `deleted: false` when it was not closed |

**Permanent menu save.** One transaction, holding an advisory lock so two saves in flight cannot
interleave. A section fixes its items' category and an item's position in it is its `sortOrder`.
An item with `id` updates that permanent item, written only if something changed; one without
`id` is inserted. `active` is optional and defaults to `true`. Every permanent item missing from
the payload is set inactive, never deleted. Each `id` must be a stored permanent item, listed
once: otherwise `unknown_item`, `weekly_item` or `duplicate`. `soldOut` is not part of the save; it
has its own route. This replaced the per-item routes of the issue's first scope (decided by Dávid
on 2026-10-08), matching the old `/etlap` page.

**Week upsert.** One transaction, holding the week's row lock so two saves in flight cannot
interleave. A list fixes its items' category (soups `daily_soup`, mains `daily_main`, featured
`featured`). An item with `id` updates that weekly item, written only if something changed; one
without `id` is inserted. The same `id` may sit on several days, with the same content, once per
list. The schedule is rewritten to match. An item that was on the week and is missing from the
payload is detached and set inactive, never deleted, so orders keep their reference; if it is
still scheduled on another week it stays active. Weekly items' `sortOrder` is always 0: their order
is the list order.

**Cache purges**, after the write commits, through `MenuCache`:

| Change | Purges |
|---|---|
| `PUT` a week | that week, and every week an edited item is also scheduled on |
| publish a week | that week |
| add or remove a closed date | the week of that date |
| sold-out of a weekly item | every week it is scheduled on |
| `PUT /items`, or sold-out of a permanent item | everything (`purgeAll`, once per request): permanent items are on every week's menu |

Purges are idempotent and run on every such request, also when it changed nothing (publishing
again, closing a date twice), so a retry after a failed purge heals the cache.

Integration tests (`src/menu/admin.integration.test.ts`, `src/menu/public.integration.test.ts`)
run when `DATABASE_URL` is set in the shell, and are skipped otherwise (as in CI). They pick random
unused weeks of the 2090s and delete what they create; the permanent items that existed before the
run are restored column for column. From the repo root:

```bash
set -a; source .env; set +a
pnpm exec vitest run --project=@piccolo/api
```

## Public menu

`GET /api/menu` is anonymous and the same for every guest at a given moment. The clock is the
request time. `orderWindow` (`packages/core`) decides the state from the week of the first
orderable day (this week, or next week after the Friday cutoff):

| Body | When |
|---|---|
| `{ state: 'open', menu, orderableDates, closedDates, weekLabel }` | That week is published and has a day left to order. `menu` is core's `PublicMenu` (sold-out items included, flagged); `orderableDates` are `YYYY-MM-DD`, ascending, without closed dates; `closedDates` are the days staff closed (#60) that could otherwise still be ordered (core's `orderWindow`), `YYYY-MM-DD`, ascending, so the page can tell a closed day from a past one |
| `{ state: 'next_week_not_published' }` | Ordering has rolled over to next week, which is not published. No `message`: the text is the web app's (`apps/web/src/strings.ts`, #60) |
| `{ state: 'closed' }` | This week is not published, or every remaining day of it is closed |

`?week=2026-W42` returns that week as `state: 'open'` if it is published, with the dates of it a
guest can order for now and the closed ones among them (none, for a week other than the order
window's). Otherwise 404 `{ error: 'week_not_published' }`; a malformed week is 400 `validation`.

**Headers.** `Cache-Control: no-cache` and an `ETag` (SHA-1 of the body, so of the menu and the
orderable dates): the browser may keep the response but asks every time, because
`orderableDates` changes at the cutoff. A matching `If-None-Match` (weak or strong) is 304. Outside
production `X-Db-Queries` says how many database queries the request sent: 0 from the cache, 1 for
an unpublished week, 4 for a published one.

**The cache** (`src/menu/cache.ts`, docs/STACK.md rule 4) is the `MENU_CACHE` KV namespace. Each
week is stored under `menu:<isoYear>-<isoWeek>` without expiry: whether it is published, its
closed dates and its `PublicMenu`, so a cached request sends no query. An unpublished week is
cached too. The admin routes purge it (the table above).

- A purge writes a new random value to `menu-version:<isoYear>-<isoWeek>` (`purgeWeek`) or
  `menu-version:all` (`purgeAll`) instead of deleting entries. An entry is used only while it
  carries both current versions, read *before* its database read. So a guest whose read ran
  just before a write committed cannot leave the old week cached forever, and `purgeAll` does not
  depend on KV's eventually consistent `list`. A request reads three keys, in parallel.
- KV is eventually consistent: a purge is visible at once in the Cloudflare location that made
  it, and within about a minute in the others.
- KV allows about one write per second per key. A guest's store that KV rejects is skipped (the
  next request stores it); a purge is retried twice, a second and two seconds apart.
- **Bump `CACHE_FORMAT`** in `cache.ts` whenever `PublicMenu` or the cached week changes shape or
  meaning: entries never expire, so a deploy would otherwise keep serving the old ones.
  `cache.test.ts` fails on a shape change as a reminder.

Locally `wrangler dev` uses Miniflare's KV, kept under `.wrangler/state`. Delete that folder to
start with an empty cache.

## Orders

`POST /api/orders` is anonymous. The body is core's `SubmissionDraft` (`name`, `phone`, `email`,
`address`, `note`, `days: [{ deliveryDate, fulfilment, menus, extras }]`) plus the honeypot
`website`, which must be empty. The clock is the request time.

| Status | Body | When |
|---|---|---|
| 201 | `{ submissionId, orders: [{ id, deliveryDate, total }], grandTotal }` | Stored: one order per day, in the order of `days` |
| 200 | The same shape, a random `submissionId`, no orders | `website` was filled. Nothing is validated, counted or stored |
| 400 | `{ error: 'validation', fields }` | The shape is wrong or over a cap (zod codes), the days are in different ISO weeks (`other_week`), or core rejects a field |
| 409 | `{ error: 'validation', fields }` | Every failure is `cutoff_passed` or `sold_out`: the client drops the day or the item and sends again |
| 409 | `{ error: 'date_closed', dates, fields }` | Staff closed one of the dates (#60). `fields` marks the same days (`days.1.deliveryDate: 'date_closed'`), so the typed client's `ApiError.fields` carries them |
| 413 | `{ error: 'payload_too_large', message }` | The body is over 64 KB |
| 429 | `{ error: 'rate_limited', message }`, `Retry-After` | Over 10 submissions in 10 minutes from one IP |

`fields` maps a path to a code, as everywhere else. When a 409 and a 400 code come back together,
the status is 400 and every field is listed. A delivery day under the minimum order is accepted;
its difference (`missingToMinimum`) is not stored (#57).

**Caps.** 7 days, 30 menus per day, 20 extras per day, bounded string lengths, item ids that are
UUIDs (or `''` for an empty slot); extra quantities are core's (1–20, `invalid_quantity`).

**Decided from the database, never from the cache.** The menu cache can lag about a minute behind
a sold-out switch at another Cloudflare location, so `submitOrder` reads everything that decides
the outcome inside its transaction: the week's publication and closed dates, and each submitted
item's schedule entries, `active`, `sold_out`, name and prices. The items are locked `FOR SHARE`
until the commit, so a sold-out switch or a menu save that touches them waits for the submission.
Core's `validateSubmission` and `priceSubmission` then run against a `PublicMenu` built from those
rows. Core reports a closed date as `cutoff_passed`; `rejectionOf` recognises it with core's
`isClosedDate` and answers `date_closed` instead.

**One transaction, five round trips** (`X-Db-Queries: 5` outside production; 4 for a rejection):
`begin`, the items, the week, one `INSERT` whose data-modifying CTEs upsert the customer and insert
the orders, menus, items and extras, and `commit`. Ids are generated in the Worker, so nothing
waits for `RETURNING` except the customer's id inside the statement. A rejection writes nothing.

**What is stored.**
- `customers`, upserted on `email_key` (trimmed, lowercased e-mail): e-mail, name, phone, address
  and `last_order_at` are the submission's. An empty address (pickup only) keeps the stored one.
- `orders`: status `received`, the submission's name, e-mail, address (`''` for pickup) and note
  (`null` when empty), trimmed; the phone normalised to `+36…`; core's food subtotal, delivery fee
  and total. Every order of a submission shares `submission_id`.
- `order_menus`: `position` from 1 within the day (`1. menü`, #56), `price` as core priced the
  menu, adjustments included.
- `order_items`: slot, `menu_item_id`, name, variation (`null` when none) and `unit_price`, each
  item's own price (daily soups 0). `order_menus.price` minus the sum of its items' `unit_price`
  is the menu's adjustment: negative is `no_soup_discount`, positive is `soup_charge`.
- `order_extras`: key, name, quantity and unit price from the config.

**After the commit** the route calls `OrderEvents.orderSubmitted(submissionId, orderIds)` inside
`executionCtx.waitUntil` (`src/orders/events.ts`). The response does not wait for it, and a
listener that throws is reported to Sentry, never to the guest. The request's database client is
released by then, so a listener that reads opens its own. The Worker entry (`src/index.ts`)
installs the only listener, the confirmation e-mail (see "E-mail"); `app.ts` alone listens to
nothing.

**The per-IP limit** (`src/orders/rateLimit.ts`) keeps the times of a client's recent submissions
in `MENU_CACHE` under `order-rate:<ip>` (an IPv6 address by its /64), a sliding window that
expires 10 minutes after the last one. Only requests that pass validation are counted.
- Workers KV, not the Workers Rate Limiting binding: the binding's period can only be 10 or 60
  seconds, so it cannot say 10 per 10 minutes. No new resource: the menu cache's namespace,
  another prefix.
- It is an abuse brake, not an exact count. KV is eventually consistent, read-then-write is not
  atomic, and KV takes about one write per second per key, so a burst from one client can get a
  few requests past the limit. A failed write is logged and the request goes through.
- `wrangler dev` reports the developer's own machine as `CF-Connecting-IP` (`127.0.0.1` / `::1`),
  which Cloudflare never does; loopback is not limited, so local checkout testing is not stopped
  after ten submissions.

Integration tests: `src/orders/public.integration.test.ts`, with `DATABASE_URL` set as above. They
work in a random unused week of the 2090s with e-mail addresses of their own, and delete every row
they create.

## Admin orders

Under `/api/admin/orders`, for staff working a delivery date. Orders are never edited or deleted:
the only write is a status change, and it sends no e-mail. Names, variations and prices are the
snapshots stored at submission; nothing joins `menu_items`. Each request is one statement (two
for a refused status change), and every count and sum is computed in Postgres.

| Route | Response |
|---|---|
| `GET /?date=&status=&q=&cursor=` | `{ orders, nextCursor }`: the date's orders, newest first, 200 a page. `status` is `received`, `processed`, `cancelled` or `all` (the default). A row is `{ id, name, phone, address, fulfilment, status, total, menuCount, notePreview, createdAt, processedAt, cancelledAt }`; `address` is `''` for pickup, `notePreview` the note, its first 99 characters and `…` when it is longer than 100, or `null` |
| `GET /:id` | The order's columns (with `submissionId` and `customerId`), `menus: [{ position, price, items: [{ slot, name, variation, unitPrice }], adjustments }]` by position and slot, `extras: [{ key, name, quantity, unitPrice }]`, and `siblings: [{ id, deliveryDate, status }]`, the other days of the same submission. 404 `order_not_found` |
| `POST /:id/status` | `{ status: 'processed' \| 'cancelled' }` → `{ order }`, the list's row. 409 `{ error: 'invalid_transition', status, message }` with the current status when the change is not allowed; 404 `order_not_found` |
| `GET /summary?date=` | `{ date, orderCount, menuCount, revenue, deliveryCount, pickupCount, dishes: { soup, main, side, pickle, dessert }, extras }` over the orders not cancelled. Each slot lists `{ name, variation, count }`, most first; `extras` are `{ key, name, quantity }`. `revenue` is the sum of `total`, delivery fees included |
| `GET /delivery-list?date=` | `{ date, orders }`: the delivery orders not cancelled, by address, each `{ id, name, phone, address, menuCount, total, note, status }` |

**Search.** `q` (trimmed, at most 200 characters) matches the name or the e-mail with `ILIKE`, and
`%` and `_` in it are literal. When `q` looks like a phone number, its partial number also matches
the phone, which O3 stores as `+36…`: core's `phoneSearchFragment` drops the separators and turns a
leading `06` or `0036` into `+36`, so `06 30 123`, `30/123` and `+36 30 123` all find
`+36301234567`.

**Pages.** `nextCursor` is the id of the page's last order, `null` on the last page. The next page
starts below that order by `(created_at, id)`, so orders that arrive meanwhile do not shift it;
they appear on the first page. A cursor that names no order gives an empty page.

**Status changes.** `received → processed` sets `processed_at`; `received → cancelled` and
`processed → cancelled` set `cancelled_at` and keep `processed_at`. Anything else, including setting
the status an order already has, is 409. The rules are core's (`statusesBefore`). The change is one
conditional `UPDATE`, checked against the status the order has when it runs: two changes at once
apply one after the other, and the second gets the 409 only if the first made it invalid (two
`processed`, or `processed` after `cancelled`; `cancelled` after `processed` succeeds).

**Adjustments** are not stored: `adjustments` is `order_menus.price` minus its items' `unit_price`,
read back by core's `adjustmentsOf` in the shape `priceMenu` returns (`no_soup_discount` negative,
`soup_charge` positive). Neither the detail nor the delivery list shows a difference to the minimum
order: that is a checkout notice only (Dávid, 2026-10-09, #57).

**Address order.** The delivery list sorts by `address` under the `natural_sort` collation
(packages/db migration 0001): an ICU root-locale collation with numbers by value and case and
accents ignored, so `fo ter 2.` comes before `Fő tér 10.`. The summary sorts names the same way.

Integration tests: `src/orders/admin.integration.test.ts`, with `DATABASE_URL` set as above, after
`pnpm db:migrate` (they need `natural_sort`). They write their own orders into an empty week of
the 2070s under a customer of their own, and delete all of it afterwards.

## E-mail

Exactly one e-mail exists: the confirmation a guest gets right after a submission is stored
(`src/email/`). It lists every day of the submission with its menus (`1. menü`), each item and
its unit price, the soup adjustment, the extras, the food subtotal, the delivery fee and the day's
total, then the address (or `Személyes átvétel`), the note, the grand total, the restaurant's
contact details and a line saying that replies go to `info@`. It does not mention the shortfall to
the daily minimum (#57). The sender is `config.email.from`, the reply-to `config.email.replyTo`.
Every Hungarian word is in `src/strings.ts`.

- **When.** `OrderEvents.orderSubmitted`, after the commit and after the response
  (`src/email/confirmation.ts`). The listener opens its own database client, reads the
  submission's snapshots (`loadSubmissionForEmail`; never `menu_items`), renders the React Email
  template (`src/email/templates/OrderConfirmation.tsx`) to HTML and plain text, and sends it. A
  failure rejects, and the route reports it to Sentry with the `submissionId`; the guest's response
  is never affected.
- **Once.** `orders.confirmation_sent_at` is set on the submission's orders after SES accepts the
  e-mail. A submission with it already set is skipped; a failed send leaves it empty.
- **Off the frontends' type path.** `src/index.ts` installs the listener with `setOrderEvents`
  instead of `app.ts` importing it. The frontends typecheck everything `app.ts` imports
  (`@piccolo/api/types`), and they have no JSX setting for the template.
- **SES** (`src/email/ses.ts`): SES v2 `SendEmail` over HTTPS, signed with SigV4 by `aws4fetch`.
  No AWS SDK, and SendOps is not in the path (docs/STACK.md rule 7). A 5xx or 429 is retried twice.
- **Dry run.** With `EMAIL_DRY_RUN=1` the e-mail is logged (headers and the plain-text part) and
  nothing is sent; it still counts as sent. The top level of `wrangler.toml` sets it, so
  `wrangler dev` and the development Worker never mail anyone. Staging and production leave it
  unset.

```bash
pnpm email:preview                         # the fixture e-mail → apps/api/.preview/order-confirmation.{html,txt}
pnpm email:test-send you@example.com       # sends the fixture e-mail through SES, with the root .env's SES_*
pnpm email:test-send you@example.com --dry-run
```

The fixture (`src/email/fixture.ts`) is two days and three menus with both soup adjustments and
extras, priced by core and snapshotted by `snapshotOf`, so its totals are core's.
`email:test-send` always sends for real, whatever `EMAIL_DRY_RUN` says. While SES is in the
sandbox, the recipient must be a verified identity too.

**Before the first real send (P1, #39):** a verified SES domain identity for the sender's domain
with DKIM, SPF and DMARC records, production access (out of the sandbox), and an IAM access key
allowed `ses:SendEmail` on that identity. Then `pnpm email:test-send` with the key in the root
`.env`, and `wrangler secret put SES_REGION` / `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` for
each deployed environment that sends.

Integration tests: `src/email/confirmation.integration.test.ts`, with `DATABASE_URL` set. They
store the fixture on dates of a random week in the 2090s, under their own e-mail addresses, and
delete every row afterwards.

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
  request and releases it after the response, through the `HYPERDRIVE` binding: deployed,
  Hyperdrive pools the connections; under `wrangler dev` it connects straight to `DATABASE_URL`.
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
  2190 KiB uncompressed / 410 KiB gzip (zod is ~760 KiB of it since the admin menu routes, #24),
  under the Paid plan's 10 MB limit. Do not pull Clerk into a second bundle.
- **`authorizedParties`.** Clerk puts the admin origin in the token's `azp` claim. Pass that
  origin, exactly, including scheme and port (`http://localhost:5173` in local dev,
  `https://piccolo-admin.honlapvarazslo.workers.dev` for the deployed development admin; not the
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
- the top level, for local development and for the development Worker that CI deploys from
  `develop` as `piccolo-api`
- `staging`, deployed as `piccolo-api-staging`
- `production`, deployed as `piccolo-api-production`

The top level's `CORS_ORIGINS` lists the local dev servers and the deployed development web and
admin, `https://piccolo-web.honlapvarazslo.workers.dev` and
`https://piccolo-admin.honlapvarazslo.workers.dev`. Its `CLERK_AUTHORIZED_PARTIES` lists the two
admin origins only: `http://localhost:5173` and `https://piccolo-admin.honlapvarazslo.workers.dev`.

The top level binds `HYPERDRIVE` to the Hyperdrive config `piccolo-development`, in front of the
Neon development branch. The deployed development Worker has no `DATABASE_URL`: without this
binding its database routes fail with 500.

`staging` and `production` each set `ENVIRONMENT`, `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES`,
and bind `HYPERDRIVE` and `MENU_CACHE`. Their Hyperdrive and KV ids and origin URLs are
**placeholders** until manual issue #40 creates the resources and replaces them.

`MENU_CACHE` is a KV namespace per environment. The top level binds
`piccolo-menu-cache-development`. Create the others with
`wrangler kv namespace create piccolo-menu-cache-<staging|production>` and put the printed id in
`[[env.<staging|production>.kv_namespaces]]`.

Secrets are never written into `wrangler.toml`. Set them per environment:

```bash
wrangler secret put SENTRY_DSN --env staging
```

| Name | Kind | Where |
|---|---|---|
| `SENTRY_DSN` | secret | `wrangler secret put` per environment; `.dev.vars` locally |
| `DATABASE_URL` | secret | `.dev.vars` only; `pnpm dev` passes it to the local `HYPERDRIVE`. Deployed environments use the `HYPERDRIVE` binding instead |
| `HYPERDRIVE` | Hyperdrive binding | `wrangler.toml`: the top level binds `piccolo-development`; staging and production are placeholders (#40). Locally `wrangler dev` connects it straight to `DATABASE_URL` |
| `CLERK_SECRET_KEY` | secret | `wrangler secret put` per environment; `.dev.vars` locally |
| `CLERK_PUBLISHABLE_KEY` | secret | same. Not secret in the cryptographic sense, but it is not written into `wrangler.toml`. The admin build uses `VITE_CLERK_PUBLISHABLE_KEY` |
| `CLERK_JWT_KEY` | secret | same. PEM public key for networkless session JWT verification (`jwtKey`) |
| `CLERK_ORG_ID` | secret | same. Organization id of this restaurant's staff |
| `ENVIRONMENT` | var | `wrangler.toml`: `development`, `staging` or `production`, also the Sentry environment |
| `RESTAURANT` | var | `wrangler.toml`: the `RestaurantConfig` instance (`loadConfig`) |
| `CORS_ORIGINS` | var | `wrangler.toml`: the web and admin origins for that environment |
| `CLERK_AUTHORIZED_PARTIES` | var | `wrangler.toml`: admin origins whose session tokens are accepted (`azp`) |
| `MENU_CACHE` | KV binding | `wrangler.toml`: the public menu cache's namespace for that environment, also holding the per-IP order limit (`order-rate:`). Locally Miniflare's |
| `EMAIL_DRY_RUN` | var | `wrangler.toml`: `1` at the top level (local and development), unset in staging and production. `1` logs the confirmation e-mail instead of sending it |
| `SES_REGION` | secret | `wrangler secret put` per environment that sends (P1, #39); `.dev.vars` locally only to send for real. The region of the SES identity |
| `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY` | secret | same. An IAM access key allowed `ses:SendEmail` |
