---
name: verify
description: Drive the Piccolo ordering app (public /megrendeles on Astro, the staff admin on Vite + React, the Hono API on wrangler dev) the way a guest or a staff member does, and capture proof. Use it to confirm that a change works in the running app rather than only in tests, to answer the "Validation" section of an issue, to reproduce a bug, or whenever you need signed-in admin access without Clerk.
---

# Verify the Piccolo app

Three servers make one run: the API (`apps/api`, `wrangler dev`), the public site (`apps/web`,
`astro dev`, page `/megrendeles`) and the admin (`apps/admin`, Vite). They are the same three
Workers that ship (AGENTS.md), on random free ports. Several runs can live side by side, in one
checkout or in several worktrees.

The scripts are in `.claude/skills/verify/scripts/`. Run them from anywhere inside the checkout
you want to verify. They act on the checkout they live in (override with `VERIFY_REPO`).

## Read this before you drive anything

- **The database is shared.** Every run talks to the Neon development branch from
  `apps/api/.dev.vars`. The deployed development site and other sessions use it too. Reads are
  free. A write is allowed only when you can undo it: snapshot the rows first with `sql.mjs`,
  restore them afterwards, and prove the restore. Prefer write targets nobody looks at, such as a
  far-future week (`2090-W10`) or the run's own order e-mail. Never reseed or reset the branch.
- **Staff auth is a per-run key, not Clerk.** `up.sh` makes an RSA key pair and passes its public
  key to the API as `CLERK_JWT_KEY`. It then signs a Clerk-shaped session token (org
  `org_verify`) with the private key. The API runs the real `requireStaff`, which verifies that
  token just as it verifies Clerk's: signature, `azp`, organization. The admin runs with
  `@clerk/react` replaced by `scripts/clerk-stub.js`, which is signed in and hands out that token.
  This proves everything behind sign-in. It does not prove Clerk's hosted sign-in, the `/login`
  page, the `UserButton`, or real organization membership. Those need Dávid with a real account:
  give him the steps, never claim them yourself.
- **The menu state depends on the clock.** `GET /api/menu` opens the week of the first orderable
  day. That is this week, or next week once Friday's 09:30 cutoff (Europe/Budapest) has passed.
  The week must also be published. `doctor.sh` prints the state. See
  `features/public-ordering-page.md` before relying on `open`.

## Launch

```bash
.claude/skills/verify/scripts/up.sh
export VERIFY_RUN=<the path it prints>     # or rely on .verify/latest
```

- **Needs:** `pnpm i` done, and `DATABASE_URL` in the environment or in `apps/api/.dev.vars` /
  `.env` of this checkout or of the main checkout. A fresh worktree finds the main checkout's
  files by itself.
- **Ready when** it prints `ready — export VERIFY_RUN=…`. It waits up to 120 s per server
  (`VERIFY_TIMEOUT`). First the API answers `/api/health`, then the web answers `/megrendeles`,
  then the admin answers `/`.
- **Writes `$VERIFY_RUN/run.env`:** `API_URL`, `WEB_URL`, `ADMIN_URL`, the three PIDs (each also
  its process group), `GIT_HEAD`, `STAFF_TOKEN_FILE`, `ORDER_EMAIL` (`verify+<RUN_ID>@example.com`)
  and `EVIDENCE`. Run `source "$VERIFY_RUN/run.env"` in each shell where you need them.
- **Servers log to** `$VERIFY_RUN/logs/{api,web,admin}.log`. The API log has one line per
  request: `[wrangler:info] POST /api/… 200 OK`.
- **No secret is copied except `DATABASE_URL`.** The Clerk keys are generated, and `SENTRY_DSN` is
  left out, so errors from verification never reach Sentry.

Do not use `pnpm dev` for verification. It binds fixed ports (8787, 4321, 5173) that other
sessions often hold, and it needs a real Clerk sign-in for the admin.

## Doctor

```bash
.claude/skills/verify/scripts/doctor.sh          # --db also wakes the database
```

This is read-only. Exit 0 means the run is worth driving. It checks:
- each port is held by the process group this run started;
- the checkout is still at the commit it launched from (uncommitted edits hot-reload, but a new
  commit means relaunch);
- `/api/health` is 200;
- `/api/admin/ping` is 401 without a token and 200 with the run's token;
- CORS answers the web origin;
- both frontends return 200.

It also prints the API version and the menu state. Run it first, and again whenever something
looks off. A `FAIL` line names the broken check. Read that server's log, and if in doubt, run
`down.sh` and launch again.

## Drive

**The browser pane** (`mcp__Claude_Browser__*`) is for anything a person clicks. Open
`$WEB_URL/megrendeles` or `$ADMIN_URL/<route>`. The admin routes are `/rendelesek`, `/osszesito`,
`/heti-menu?week=YYYY-Www` and `/etlap`.
- Locate controls with `find` by accessible name, then click with `ref`.
- Use `read_page` (`filter: "all"`) for structure. The `interactive` filter sometimes leaves out
  the Radix switches.
- Every label is Hungarian, from `apps/{web,admin}/src/strings.ts`. Take names from there, never
  guess them.
- Refs change after every navigation, so run `find` again.
- To read state that has no accessible name (for example which row a switch is in), a read-only
  `javascript_tool` query is fine. Never use it to click or to set values.

**The API, the way the frontends call it:**

```bash
S=.claude/skills/verify/scripts
$S/api.sh GET /api/menu                                   # anonymous, web Origin
$S/api.sh GET /api/admin/menu/items                       # staff token, admin Origin
$S/api.sh --anon GET /api/admin/ping                      # staff route without a token → 401
$S/api.sh --save order-201 POST /api/orders @"$EVIDENCE/order.json"
```

`--save NAME` writes the request and the full response, headers included, to
`$EVIDENCE/NAME.http`. Outside production the `X-Db-Queries` header counts the database round
trips: 0 means served from the menu cache.

**The database, for side effects and for snapshots:**

```bash
node $S/sql.mjs 'select id, sold_out, updated_at from menu_items where id = $1' <uuid>
```

It prints rows as JSON and reports writes on stderr (`UPDATE 1`). Pass values as `$1…`
parameters, never pasted into the SQL. Tables and columns are in `packages/db/src/schema/`.

**Screenshots as files:**

```bash
$S/shot.sh "$ADMIN_URL/etlap" etlap-after 1280x1600      # → $EVIDENCE/etlap-after.png
```

This is headless Chrome with a fresh profile. It cannot click and it renders at least about
500 px wide. For a phone layout, use the browser pane's `resize_window` (`preset: "mobile"`) and
its `screenshot`. In dev, a toolbar at the bottom of `/megrendeles` is Astro's dev toolbar, not
the app.

## Evidence

Every artifact goes in `$EVIDENCE` (`.verify/runs/<RUN_ID>/evidence/`, git-ignored). `down.sh`
never deletes it. Name each file `<feature-id>.<step>.<ext>`.

A proof contains:
- **the action:** the click, or the `api.sh` request;
- **the state that results**, in a second view, not the one that made the change. For example,
  reload the admin page, read the guest API, or query the row;
- **the side effect:** the rows from `sql.mjs`, and the request line in
  `$VERIFY_RUN/logs/api.log`;
- **for every write, before and after snapshots, plus a restore snapshot** that matches before.

Standards:
- **Drive the real user path.** Drive the UI the issue is about. Use `api.sh` for API-only
  features, or to read a second view. Never prove a UI feature by calling its endpoint, and never
  set state through SQL that a user would set through the app. SQL is for snapshots, restores and
  reading side effects.
- **The Clerk stub is the only mock,** and it stands at a real boundary, Clerk. State plainly in
  your report that staff sign-in was simulated.
- **Report what you could not reach.** An entry point you could not drive (no open week, no
  sign-in) is reported with its unmet precondition. It is never covered by a different path.

## Cleanup

```bash
.claude/skills/verify/scripts/down.sh            # the run in $VERIFY_RUN, else .verify/latest
```

`down.sh` does three things:
- **Stops the run's own process groups.** It never kills by name, and never touches a server it
  did not start. That includes the user's `pnpm dev`, and other runs.
- **Deletes this run's orders and customers,** by the e-mail pattern
  `verify+<RUN_ID>%@example.com`, and logs what it deleted to `$EVIDENCE/cleanup.txt`.
- **Removes `state/`:** the keys, the token, the copied `DATABASE_URL` and Miniflare's KV.

It keeps `evidence/` and `logs/`. It does **not** undo other database writes. Restore your
snapshots before you run it, while the run still works, and save the restore proof.

Old runs pile up in `.verify/runs/`. Delete a run directory only once you no longer need its
evidence.

## Helpers

| Script | What |
|---|---|
| `scripts/up.sh` | Launch a run (above) |
| `scripts/doctor.sh [--db]` | Read-only health of the run |
| `scripts/api.sh [--anon] [--save NAME] METHOD PATH [BODY\|@FILE]` | Call the API as the web or the admin |
| `scripts/sql.mjs "<sql>" [param…]` | Query the run's database |
| `scripts/shot.sh URL NAME [WxH]` | PNG of a page into `$EVIDENCE` |
| `scripts/down.sh` | Tear the run down, keep the evidence |
| `scripts/prepare.mjs`, `clerk-stub.js`, `admin-vite.config.mjs`, `lib.sh` | Used by `up.sh` and the others; not called directly |

## Feature map

`features/README.md` lists each user-facing feature, with how to reach it, how to drive it, and
the end state that proves it. When a feature has more than one entry point, a proof covers every
one of them. When you add or change a user-facing feature, update its file in the same PR.
