# Order confirmation e-mail

Right after a submission is stored, the guest gets one Hungarian e-mail from
`rendeles@piccoloetterem.hu` (reply-to `info@`). It lists every day with its menus (`1. menü`), each
item with its unit price, the soup adjustment (`Leves felár` / `Leves nélkül`), the extras, the
food subtotal, the delivery fee and the day's total, then the address or `Személyes átvétel`, the
note, the grand total and the restaurant's contact. The guest's 201 never waits for it, and a
failed send never reaches the guest. Every environment sends through SES; there is no dry run. A
run has no `SES_*` secrets, so in a run the send fails before anything leaves the machine.

## Sub-features

- `email-attempt`: a stored submission tries to send once. In a run it fails with
  `OrderEvents failed for submission …` and `SES is not configured: set SES_REGION, …` in the API
  log; with SES configured it logs `Confirmation for submission … sent through SES, message …`.
- `email-once`: the submission's orders get `confirmation_sent_at` after SES accepts the e-mail,
  never after a failure. A submission already marked is skipped (`… already sent; skipped`).
- `email-totals`: every amount in the e-mail equals what the 201 returned and what the rows hold.
- `email-preview`: `pnpm email:preview` renders the fixture e-mail (two days, three menus, both
  adjustments, extras) to `apps/api/.preview/order-confirmation.html` and `.txt`.

## How to get to it (user POV)

- The guest submits an order from checkout on `/megrendeles` (see
  [order-submission.md](./order-submission.md)).
- The guest reads the e-mail in their inbox. A run never sends one, so `email-preview`'s HTML
  stands in for how it looks; its content is covered by `confirmation.integration.test.ts`.

## Driving it with the browser pane and api.sh

Preconditions: the `order-201` preconditions of [order-submission.md](./order-submission.md)
(menu state `open`, `$ORDER_EMAIL`), and the run's database has `orders.confirmation_sent_at`
(migration `0002_order_confirmation_sent_at`; see Gotchas).

- **Submit.** Follow `order-201`: `api.sh --save email.order POST /api/orders @"$EVIDENCE/order.json"`.
  Expect 201.
- **The attempt.** Within a second the API log has the failure. Save it:
  `grep -A3 'OrderEvents failed' "$VERIFY_RUN/logs/api.log" > "$EVIDENCE/email.log.txt"`. Check it
  names the submission and says `SES is not configured`.
- **Not marked.** `sql.mjs 'select delivery_date, confirmation_sent_at from orders where email = $1' "$ORDER_EMAIL"`
  → every row is `null`, so a later attempt could still send. Save it as `email.rows.json`.
- **Looks.** `pnpm email:preview`, then open the HTML in the browser pane through a local static
  server (the pane will not drive a `file://` page), at desktop and at `resize_window` mobile.
  The live e-mail has the same template; only the data differs.
- **Proof.** `email.order.http`, `email.log.txt`, `email.rows.json`, the preview screenshots, and
  `down.sh`'s `cleanup.txt`.

## Gotchas

- **The column comes with the migration.** CI applies `0002_order_confirmation_sent_at` to the
  shared development database when the PR merges into `develop`, not before. Running this branch
  against that database earlier makes the listener fail with
  `column "confirmation_sent_at" does not exist` (`OrderEvents failed for submission …` in the log;
  the 201 is unaffected). Verify against a database `pnpm db:migrate` has migrated from this
  branch, or after the merge.
- **Never a real send from a run.** `example.com` must never be mailed, and there is no dry run to
  stop it: the missing `SES_*` secrets are what stop it. A run's `api.dev.vars` holds only
  `DATABASE_URL` and the generated Clerk keys. Never add `SES_*` to it, and before you submit check
  that `wrangler dev`'s startup lines in `logs/api.log` list no `SES_` binding.
- **A real send is Dávid's.** `pnpm email:test-send <address>` sends the fixture through SES with
  the root `.env`'s `SES_*`, and needs P1 (#39): a verified identity with DKIM, out of the sandbox.
  An agent reports it as not verified.
- The e-mail lines are logged with `console.log` / `console.error`, so wrangler prints them without
  a `[wrangler:info]` prefix. Search for the text, not for the request line.
