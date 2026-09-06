# Piccolo rewrite — project plan

Online lunch ordering for one restaurant in Szombathely (Piccolo Club Étterem). Guests browse the
weekly menu and order without an account; staff publish the menu and work the incoming orders.
Greenfield replacement of the CodeIgniter app under `ci_piccolo/` — copy the functionality, never
the implementation. Nothing is migrated from the old database.

Companion documents:

- [STACK.md](STACK.md) — the technology choices and the rules that must not be broken (Hungarian).
- [LEGACY-INVENTORY.md](LEGACY-INVENTORY.md) — what the old system does, feature by feature.
- [ORCHESTRATION.md](ORCHESTRATION.md) — how issues are launched, babysat and merged.

Language: code, comments, commits, issues and docs are English. All user-facing text (public page
and admin) is Hungarian, kept in one strings file per app.

---

## 1. Release 1 scope

Release 1 is the ordering platform end to end, built and tested but **not published**. It exists
to make the first build small. The old site keeps running untouched.

| In | Out (backlog, see §7) |
|---|---|
| `/megrendeles` — the weekly menu **is** the order page (Astro page + React island) | `/`, `/galeria`, `/elerhetoseg`, `/adatkezeles`, apex cutover |
| Order composition, group ordering, multi-day cart, extras, checkout, confirmation email | "My orders" magic link, customer self-cancel |
| Admin: weekly menu grid, permanent items with allergens, draft → publish | "Ordering paused" runtime toggle |
| Admin: orders per day, search, detail, `received → processed`, cancel, kitchen summary, delivery list, print | Order editing in admin, staff notifications |
| Clerk-protected admin, Sentry, SES, SendOps | Analytics, Playwright e2e, Neon consumption monitor |

## 2. Decisions (from the planning interview, 2026-09-06)

Every item below was an explicit decision. Do not reopen them inside an issue; open a new issue.

**Process**

- One agent works one issue at a time, sequentially (concurrency 1). `develop` is the integration
  branch, `main` is production. An agent branches `feat/<key>-<issue>` from `develop` and lands its
  work through a **pull request into `develop`**; it never pushes to `develop` or `main` and never
  merges its own PR. Dávid merges. Revised 2026-09-06: the original decision was direct commits to
  `develop`; PRs replaced it so review, CI and conflict handling have somewhere to happen.
- No Turborepo, no GitHub Project board.
- Issues carry `blocked by` links. Do not start an issue whose blockers are open — a blocker counts
  as done only when its PR is merged into `develop` and the issue is closed.
- An orchestrator session (`docs/ORCHESTRATION.md`) picks the next issue, launches one worker
  session for it, and babysits the open PR hourly.
- GitHub Actions on every push to `develop`: typecheck, lint, unit tests, deploy the staging
  Worker. On push to `main`: the same checks, deploy production.
- Testing: `packages/core` is fully unit-tested (Vitest). Database code is exercised against a
  Neon branch per developer. No e2e in release 1.
- Design: the public ordering UI gets a mockup first, reviewed by Dávid, then the UI issues build
  to it. The admin uses shadcn/ui with no mockup.
- Accounts (Cloudflare, Neon, Clerk, AWS, Sentry) already exist. Issues labelled `manual` are for
  Dávid, not for agents.

**Ordering rules — unchanged from the old system, now configuration**

- Cutoff **09:30** Europe/Budapest, enforced by the server. Before cutoff Mon–Fri the first
  orderable day is today; after cutoff Mon–Thu it is tomorrow; Friday after cutoff, Saturday and
  Sunday roll to next week's Monday — only if next week is published. Orderable days run from the
  first orderable day to Saturday of that week. Sunday is never orderable.
- When the roll-over hits an unpublished next week, the page shows a message: come back Sunday
  evening or Monday morning.
- One submission may cover several days. It creates **one `order` per delivery day**, joined by a
  `submission_id`.
- Group ordering: several composed menus per day, each with an optional `recipient_name`.
- A composed menu has five slots: soup, main (+ required variation if the dish has variations),
  side (only when the main requires one), pickle, dessert. All optional except as stated.
- Pricing: a daily main includes one soup. No soup with such a main → **−100 Ft**. A soup with no
  main, or with a main that does not include soup → the soup costs **650 Ft**. Weekday/weekend
  price chosen by the **delivery date** (Saturday is weekend).
- Extras (box 100, bread 50, ketchup/tartar 400) are orderable per day with a quantity.
- Delivery fee **150 Ft per order (address per day)**, shown as its own line.
- Minimum **2200 Ft per order on the food subtotal** (extras included, fee excluded). Below it the
  submission is rejected, client and server.
- Pickup exists behind a config flag: no fee, no minimum, no address. **Off for Piccolo.**
- No payment method selection, no online payment. Cash on delivery is implied.
- "Sold out" is a manual per-item switch, enforced server-side at submission. No stock counting.
- Required checkout fields: name, phone, email, address (delivery only). Optional note. The
  browser pre-fills them from localStorage.
- Orders are identified by UUID only. Staff match on name / phone / email.

**Menu**

- One `menu_items` model with a category from config: `daily_soup`, `daily_main`, `featured`
  (weekly), and `all_week`, `dessert`, `pickle`, `side`, `side_extra` (permanent).
- Weekly items are scheduled to an ISO week and day (1–6; featured items have no day).
- A week is a draft until published (`published_at`). Publishing invalidates the public menu cache.
- Editing a week upserts; it never deletes and recreates. Orders snapshot item name and price.
- Allergens per item, EU list of 14, multi-select. Shown on the menu.
- No entry helpers (no name parsing, no autocomplete, no copy-week), no images, no edit history.

**Staff**

- Statuses: `received → processed`, and `cancelled` from either. "Processed" means the kitchen has
  copied the order into its own system and must not copy it again.
- No order editing. A phoned-in change is a cancel; the customer orders again.
- No new-order notification. The admin list polls.
- Emails: exactly one, the confirmation to the customer immediately after submission, with the full
  contents, days, totals, address. Sender `rendeles@piccoloetterem.hu`, reply-to `info@`.
- One staff role: membership of the Clerk organization.

**Customers**

- `customers` table keyed by normalised email (`email_key` UNIQUE), upserted on every order with
  the last used name / phone / address. Customers never enter Clerk. No verification in release 1.

## 3. Domain model

```
customers            id, email_key UNIQUE, email, name, phone, address, last_order_at
menu_items           id, category, name, description, price_weekday, price_weekend,
                     variations[], allergens[], soup_included, requires_side, sold_out,
                     active, sort_order
menu_weeks           iso_year, iso_week (PK), published_at
menu_schedule        iso_year, iso_week, day (1–6 | NULL for featured), menu_item_id, sort_order
orders               id, submission_id, customer_id, delivery_date, fulfilment (delivery|pickup),
                     status (received|processed|cancelled), name, phone, email, address, note,
                     food_subtotal, delivery_fee, total, created_at, processed_at, cancelled_at
order_menus          id, order_id, position, recipient_name, price
order_items          id, order_menu_id, slot (soup|main|side|pickle|dessert), menu_item_id,
                     name, variation, unit_price          -- snapshot, never joined for display
order_extras         id, order_id, extra_key, name, quantity, unit_price
```

`RestaurantConfig` (TypeScript, one instance per deployment):

```ts
{
  name, timezone: 'Europe/Budapest',
  cutoff: '09:30', operatingDays: [1,2,3,4,5,6], lastSameWeekOrderDay: 5,
  categories: {...}, allergenNotice: string,
  pricing: { noSoupDiscount: 100, soupPrice: 650, deliveryFee: 150, minimumOrder: 2200 },
  extras: [{ key, name, price }],
  pickupEnabled: false,
  messages: { nextWeekNotPublished: string },
  email: { from: 'rendeles@…', replyTo: 'info@…' },
  holidays: string[]   // ISO dates the restaurant is closed
}
```

Everything time-related is computed in `packages/core` from an injected `now` and the config.
HTTP handlers never contain domain logic (STACK.md rule 6).

## 4. Repository layout

```
apps/web      Astro + React island        → served at /
apps/admin    Vite + React + shadcn/ui    → served at /admin/*
apps/api      Hono on Cloudflare Workers  → /api/*, also serves both static builds
packages/core        domain logic, config type, pure TypeScript, Vitest
packages/api-client  typed client from Hono RPC, used by both apps
packages/db          Drizzle schema, migrations, query helpers
docs/                this plan, STACK.md, LEGACY-INVENTORY.md
```

Tooling: pnpm workspaces, TypeScript strict, Biome, Vitest, Wrangler. Node 22.

## 5. Milestones and issues

Strict order. Each issue is one agent session. `→` marks blockers. Issues live in [landorid/piccoloetterem.hu](https://github.com/landorid/piccoloetterem.hu/issues); agent-ready ones carry `ready-for-agent`, Dávid's carry `manual`.

### M0 Foundation

| # | Issue | Area |
|---|---|---|
| F1 [#16](https://github.com/landorid/piccoloetterem.hu/issues/16) | Scaffold the pnpm monorepo, tooling, and the agent guide (AGENTS.md) | infra |
| F2 [#17](https://github.com/landorid/piccoloetterem.hu/issues/17) | `packages/core`: `RestaurantConfig` type, Piccolo instance, calendar utilities → F1 | core |
| F3 [#18](https://github.com/landorid/piccoloetterem.hu/issues/18) | `packages/db`: Drizzle schema and migrations for the domain model → F1 | db |
| F4 [#19](https://github.com/landorid/piccoloetterem.hu/issues/19) | `apps/api`: Hono on Workers, static assets, `/admin` SPA fallback, Hyperdrive, health, Sentry → F1 F3 | api |
| F5 [#20](https://github.com/landorid/piccoloetterem.hu/issues/20) | `packages/api-client`: Hono RPC typed client → F4 | api |
| F6 [#21](https://github.com/landorid/piccoloetterem.hu/issues/21) | Clerk: admin sign-in and `/api/admin/*` middleware → F4 | admin api |
| F7 [#22](https://github.com/landorid/piccoloetterem.hu/issues/22) | GitHub Actions: checks + staging deploy from `develop`, production from `main` → F4 | infra |

### M1 Menu

| # | Issue | Area |
|---|---|---|
| M1 [#23](https://github.com/landorid/piccoloetterem.hu/issues/23) | `core`: menu domain — categories, allergens, week model, orderable-window rules → F2 | core |
| M2 [#24](https://github.com/landorid/piccoloetterem.hu/issues/24) | Admin menu API: permanent items CRUD, weekly schedule upsert, sold-out, publish → F3 F6 M1 | api |
| M3 [#25](https://github.com/landorid/piccoloetterem.hu/issues/25) | Public menu API with never-expiring cache invalidated on publish → M2 | api |
| M4 [#26](https://github.com/landorid/piccoloetterem.hu/issues/26) | Admin UI shell: layout, navigation, Clerk sign-in, Hungarian strings → F5 F6 | admin |
| M5 [#27](https://github.com/landorid/piccoloetterem.hu/issues/27) | Admin UI: weekly menu grid editor with draft/publish → M2 M4 | admin |
| M6 [#28](https://github.com/landorid/piccoloetterem.hu/issues/28) | Admin UI: permanent items editor with allergens → M2 M4 | admin |

### M2 Ordering

| # | Issue | Area |
|---|---|---|
| O1 [#29](https://github.com/landorid/piccoloetterem.hu/issues/29) | `core`: order composition, validation and pricing rules, fully tested → M1 | core |
| O2 [#30](https://github.com/landorid/piccoloetterem.hu/issues/30) | Design mockup of `/megrendeles` (needs Dávid's review) | web design |
| O3 [#31](https://github.com/landorid/piccoloetterem.hu/issues/31) | `POST /api/orders`: validate, snapshot, upsert customer, one order per day → F3 M3 O1 | api |
| O4 [#32](https://github.com/landorid/piccoloetterem.hu/issues/32) | Confirmation email: SES on Workers, React Email template, sent after commit → O3 | email |
| O5 [#33](https://github.com/landorid/piccoloetterem.hu/issues/33) | `apps/web`: Astro scaffold, `/megrendeles` page shell, menu loading → F5 M3 | web |
| O6 [#34](https://github.com/landorid/piccoloetterem.hu/issues/34) | React island: menu browsing, composing menus, group cart, extras, live price → O1 O2 O5 | web |
| O7 [#35](https://github.com/landorid/piccoloetterem.hu/issues/35) | React island: checkout form, prefill, submit, confirmation and error states → O3 O6 | web |

### M3 Staff operations

| # | Issue | Area |
|---|---|---|
| S1 [#36](https://github.com/landorid/piccoloetterem.hu/issues/36) | Admin orders API: list by date, search, detail, status transitions, kitchen summary, delivery list → O3 F6 | api |
| S2 [#37](https://github.com/landorid/piccoloetterem.hu/issues/37) | Admin UI: orders per day, search, detail, status actions, polling → S1 M4 | admin |
| S3 [#38](https://github.com/landorid/piccoloetterem.hu/issues/38) | Admin UI: kitchen summary, delivery list, print stylesheet → S1 M4 | admin |

### M4 Piccolo instance

| # | Issue | Area |
|---|---|---|
| P1 [#39](https://github.com/landorid/piccoloetterem.hu/issues/39) | SES: verify piccoloetterem.hu, DKIM/SPF/DMARC, `rendeles@` sender, leave sandbox | manual email |
| P2 [#40](https://github.com/landorid/piccoloetterem.hu/issues/40) | Production infrastructure: Neon project at 0.25 CU cap, Hyperdrive, Clerk org, Worker secrets | manual infra |
| P3 [#41](https://github.com/landorid/piccoloetterem.hu/issues/41) | Piccolo `RestaurantConfig` values confirmed with the restaurant | manual core |
| P4 [#42](https://github.com/landorid/piccoloetterem.hu/issues/42) | Enter the permanent items and allergens into the admin | manual |
| P5 [#43](https://github.com/landorid/piccoloetterem.hu/issues/43) | Connect SendOps to the AWS account | manual email |

## 6. How an agent issue is written and closed

Every `ready-for-agent` issue is self-contained for a model with no prior context. It carries the
same sections in the same order, and copies the decisions it needs instead of only linking them:

| Section | Holds |
|---|---|
| Outcome | One paragraph: what exists when the issue is done |
| Context | Project summary, repo layout, stack, the domain model / rules relevant to this issue, what earlier issues already provide |
| Scope | Numbered steps, exact files and routes |
| Non-goals | What must not be built here even if tempting |
| Acceptance criteria | Checkboxes, each verifiable |
| Validation | The commands or manual steps that prove the criteria, and what to paste in the closing note |
| Repo guardrails | Branch, scope, language, where logic lives, secrets, checks, dependencies, closing note |
| Stop conditions | When to stop and report instead of guessing |
| Dependencies | `Blocked by` and `Unblocks` issue numbers |

Guardrails (identical in every issue):

- Branch `feat/<key>-<issue>` from `develop`; never commit to `develop` or `main`. Message
  `<key>: <what>`. Open a draft PR into `develop` at the first commit, body ending `Closes #<issue>`;
  mark it ready when acceptance passes. Never merge your own PR.
- Change only what the issue scopes; keep shared-file diffs minimal and mention them.
- Code, comments, commits in English. User-facing strings in Hungarian, in the app's `strings.ts`, never inline.
- Domain logic in `packages/core` with tests; handlers and components stay thin.
- No secrets in the repo; new env vars go into `.env.example`.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass before committing.
- Do not reopen a decision in §2; if one blocks you, stop.
- No new dependencies without a one-line justification in the closing note.
- Close with a comment: what was built, what was left out on purpose, surprises, recommended follow-ups.

Stop conditions (identical in every issue): a blocker still open or its output missing from
`develop`; a required secret, account or resource absent; the scope would require changing a §2
decision or a STACK.md §6 rule; acceptance cannot be validated with the listed means; the work
exceeds roughly one working day (propose a split instead).

Manual issues (label `manual`) are Dávid's and skip the guardrail and stop sections.

## 7. Backlog (no milestone, label `backlog`, issues #44–#51)

- "My orders" for customers: magic link, `verified_at`, cancel before cutoff.
- "Ordering paused" runtime toggle with message (small `settings` table).
- Remaining public pages (`/`, `/galeria`, `/elerhetoseg`, `/adatkezeles`), SEO/JSON-LD, apex cutover.
- Cookie-free analytics (Cloudflare Web Analytics).
- Playwright smoke test of the ordering flow.
- Neon consumption monitor (STACK.md §2).
- Order editing in admin; staff notifications (daily digest).
