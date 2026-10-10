# Order confirmation e-mail

Right after a submission is stored, the guest gets one Hungarian e-mail from
`rendeles@piccoloetterem.hu` (reply-to `info@`). It lists every day with its menus (`1. menü`), each
item with its unit price, the soup adjustment (`Leves felár` / `Leves nélkül`), the extras, the
food subtotal, the delivery fee and the day's total, then the address or `Személyes átvétel`, the
note, the grand total and the restaurant's contact. The guest's 201 never waits for it, and a
failed send never reaches the guest. In every run it is a dry run: `wrangler.toml` sets
`EMAIL_DRY_RUN = "1"`, so the e-mail is written to the API log instead of being sent.

## Sub-features

- `email-dry-run`: a stored submission writes one `[email dry run]` block to the API log: `From`,
  `Reply-To`, `To` (the submission's e-mail), `Subject: Rendelését rögzítettük – <week label>`,
  the HTML's length, and the plain-text part with one `label  amount` line per price.
- `email-once`: the submission's orders get `confirmation_sent_at` after the e-mail is logged or
  sent. A submission already marked is skipped (`… already sent; skipped` in the log).
- `email-totals`: every amount in the e-mail equals what the 201 returned and what the rows hold.
- `email-preview`: `pnpm email:preview` renders the fixture e-mail (two days, three menus, both
  adjustments, extras) to `apps/api/.preview/order-confirmation.html` and `.txt`.

## How to get to it (user POV)

- The guest submits an order. Today that is `POST $API_URL/api/orders` (see
  [order-submission.md](./order-submission.md)); after O7 it is the checkout on `/megrendeles`.
- The guest reads the e-mail in their inbox. A run never sends one, so the API log stands in for
  the inbox, and `email-preview`'s HTML for how it looks.

## Driving it with the browser pane and api.sh

Preconditions: the `order-201` preconditions of [order-submission.md](./order-submission.md)
(menu state `open`, `$ORDER_EMAIL`), and the run's database has `orders.confirmation_sent_at`
(migration `0002_order_confirmation_sent_at`; see Gotchas).

- **Submit.** Follow `order-201`: `api.sh --save email.order POST /api/orders @"$EVIDENCE/order.json"`.
  Expect 201.
- **The e-mail.** Within a second the API log has the block. Save it:
  `sed -n '/\[email dry run\]/,/nekünk írhat/p' "$VERIFY_RUN/logs/api.log" > "$EVIDENCE/email.log.txt"`.
  Check that `To:` is `$ORDER_EMAIL`, that there is one date heading per day of the submission,
  and that `Fizetendő összesen` equals the response's `grandTotal`.
- **Marked once.** `sql.mjs 'select delivery_date, confirmation_sent_at from orders where email = $1' "$ORDER_EMAIL"`
  → every row has a timestamp. Save it as `email.rows.json`.
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
- **Never a real send from a run.** `example.com` must never be mailed. Before you submit, check
  `wrangler dev`'s startup lines in `logs/api.log` show `env.EMAIL_DRY_RUN ("1")`. A run's
  `api.dev.vars` holds only `DATABASE_URL` and the generated Clerk keys, so nothing overrides it.
- **A real send is Dávid's.** `pnpm email:test-send <address>` sends the fixture through SES with
  the root `.env`'s `SES_*`, and needs P1 (#39): a verified identity with DKIM, out of the sandbox.
  An agent reports it as not verified.
- `[email dry run]` is logged with `console.log`, so wrangler prints it without a `[wrangler:info]`
  prefix. Search for the marker, not for the request line.
