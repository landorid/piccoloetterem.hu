# Piccolo verification map

The maintained source for proving the app's user-facing behavior. Read `../SKILL.md` first: it
covers launch, doctor, the harness, evidence and cleanup. Then open the feature file you need and
use it as the recipe.

## Baseline preconditions

- A run started with `scripts/up.sh`, `VERIFY_RUN` exported, `source "$VERIFY_RUN/run.env"` done,
  and `scripts/doctor.sh` exiting 0.
- Never drive a server this run did not start: not `pnpm dev`, and not another session's run.
- The database is the shared Neon development branch. Snapshot before you write, restore after,
  and save both.
- Know the menu state `doctor.sh` printed (`open`, `next_week_not_published`, `closed`). Every
  public-ordering recipe depends on it.

## Driving conventions

- **UI:** the browser pane, with controls located by accessible name (`find`, then `ref`). Names
  are the Hungarian strings in `apps/{web,admin}/src/strings.ts`.
- **API:** `scripts/api.sh`, which sends the token and Origin of the frontend the route belongs
  to.
- **Database:** `scripts/sql.mjs`, with parameters, for snapshots, side effects and restores only.
- **Weeks:** `YYYY-Www` in URLs (`?week=2026-W42`); `<isoYear>/<isoWeek>` in admin API paths.
- **Dates:** `YYYY-MM-DD` in Europe/Budapest.

## Proof and skip reporting

- Capture the action and the state that results, in a second view: a reload, the guest API, the
  row.
- Every write has `before`, `after` and `restored` snapshots in `$EVIDENCE`.
- Name artifacts `<feature-id>.<step>.<ext>`.
- Say that staff sign-in was simulated (the Clerk stub). Report the real sign-in as not verified
  unless Dávid ran it.
- Report an entry point you could not reach together with its unmet precondition. Never cover it
  with another path.

## Feature entry contract

Each file has an H1, one paragraph of user-visible behavior, then exactly these H2s, in this
order: `Sub-features`, `How to get to it (user POV)`, `Driving it with the browser pane and
api.sh`, `Gotchas`.

## Features

- [Public ordering page](./public-ordering-page.md): `/megrendeles` is the order form for the
  week guests can order from (day strip, form, day's order, summary), or explains why there is
  none.
- [Order submission](./order-submission.md): `POST /api/orders` stores one order per day, or
  rejects with field codes. The form builds the cart; checkout (O7, #35) is not built yet.
- [Order confirmation e-mail](./order-confirmation-email.md): one e-mail per stored submission,
  logged in dry run (`EMAIL_DRY_RUN`), marked by `orders.confirmation_sent_at`.
- [Staff access](./staff-access.md): the admin shell behind sign-in; 401/403 on `/api/admin/*`.
- [Permanent menu (Étlap)](./admin-etlap.md): editing permanent items and the sold-out switch at
  `/etlap`.
- [Weekly menu](./admin-weekly-menu.md): the week grid at `/heti-menu`, with save, publish and
  closed days.

`/rendelesek` (orders, S2 #37) and `/osszesito` (summary, S3 #38) only show "Ez a képernyő még
készül" for now. Add their files when they are built.
