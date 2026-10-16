# Order confirmation e-mail

Right after a submission is stored, the guest gets one Hungarian e-mail from
`rendeles@piccoloetterem.hu` (reply-to `info@`). It lists every day with its menus (`1. menü`), each
item with its unit price, the soup adjustment (`Leves felár` / `Leves nélkül`), the extras, the
food subtotal, the delivery fee and the day's total, then the address or `Személyes átvétel`, the
note, the grand total and the restaurant's contact. The guest's 201 never waits for it, and a
failed send never reaches the guest. Every environment sends through SES.

A run sends for real, but only to the test inbox. When the root `.env` has the `SES_*` keys,
`up.sh` copies them into the run with `EMAIL_ALLOWED_RECIPIENT_DOMAINS=inbox.piccoloetterem.hu`,
and `$ORDER_EMAIL` is `verify+<RUN_ID>@inbox.piccoloetterem.hu`. Every address on that subdomain
lands in the test inbox (`apps/test-inbox`, kept for a day), and `scripts/inbox.mjs` reads it back.

## Sub-features

- `email-delivered`: a stored submission's e-mail reaches the inbox, from
  `rendeles@piccoloetterem.hu`, with `Subject: Rendelését rögzítettük – <week label>`, a passing
  DKIM signature for `piccoloetterem.hu`, and SPF and DMARC passing.
- `email-allowlist`: with the allowlist set, a recipient on any other domain is skipped:
  `Confirmation for submission … not sent: <domain> is not in EMAIL_ALLOWED_RECIPIENT_DOMAINS` in
  the API log, and the orders stay unmarked.
- `email-once`: the submission's orders get `confirmation_sent_at` after SES accepts the e-mail,
  never after a failure or a skip. A submission already marked is skipped (`… already sent; skipped`).
- `email-totals`: every amount in the e-mail equals what the 201 returned and what the rows hold.
- `email-preview`: `pnpm email:preview` renders the fixture e-mail (two days, three menus, both
  adjustments, extras) to `apps/api/.preview/order-confirmation.html` and `.txt`.

## How to get to it (user POV)

- The guest submits an order from checkout on `/megrendeles` (see
  [order-submission.md](./order-submission.md)).
- The guest reads the e-mail in their inbox. In a run, that inbox is the test inbox.

## Driving it with the browser pane and api.sh

Preconditions: the `order-201` preconditions of [order-submission.md](./order-submission.md)
(menu state `open`, `$ORDER_EMAIL`). `up.sh` printed `e-mail: SES keys copied; the API sends only
to @inbox.piccoloetterem.hu`. If it printed `no SES keys`, every send fails before leaving the
machine (`SES is not configured` in the log), and `email-delivered` cannot be shown: say so.

- **Submit.** Note the time (`SINCE=$(date -u +%FT%TZ)`), then follow `order-201` with
  `$ORDER_EMAIL`, from checkout or with
  `api.sh --save email.order POST /api/orders @"$EVIDENCE/order.json"`. Expect 201.
- **Read it back.** `node .claude/skills/verify/scripts/inbox.mjs "$ORDER_EMAIL" --since "$SINCE"`.
  It waits up to 120 s (usually about 2 s), saves `email.eml`, `email.json` (headers, verdicts,
  plain text) and `email.html` to `$EVIDENCE`, prints the verdicts, and exits 3 when no DKIM
  signature for the From domain passes.
- **Content.** In `email.json`'s `text`, check that there is one date heading per day of the
  submission, the items and the note, and that `Fizetendő összesen` equals the response's
  `grandTotal`.
- **Marked once.** `sql.mjs 'select delivery_date, confirmation_sent_at from orders where email = $1' "$ORDER_EMAIL"`
  → every row has a timestamp. Save it as `email.rows.json`.
- **Allowlist.** Submit the same body as `verify+$RUN_ID-2@example.com`. The API log has the
  `not sent: example.com` line and no SES message id, and that order's `confirmation_sent_at` is
  `null`. Save the line with `grep 'not sent' "$VERIFY_RUN/logs/api.log" > "$EVIDENCE/email.log.txt"`.
- **Looks.** Serve `$EVIDENCE` with a local static server and open `email.html` in the browser
  pane (the pane does not open `file://` pages), at desktop and at `resize_window` mobile.
  `pnpm email:preview`'s fixture works the same way when no real e-mail could be sent.
- **Proof.** `email.order.http`, `email.eml`, `email.json`, `email.log.txt`, `email.rows.json`,
  the screenshots, and the `cleanup.txt` from `down.sh`.

## Gotchas

- **Only the inbox, ever.** A run's `api.dev.vars` holds the SES keys only together with the
  allowlist. Never remove the allowlist line, and never copy `SES_*` into a run some other way.
  `example.com` and real people's addresses must never be mailed.
- **The inbox is shared and keeps mail for a day.** Pass `--since` so that an earlier run's message
  to a reused address does not count. Without `--since`, `inbox.mjs` takes the newest message.
- **Its URL and token** are `TEST_INBOX_URL` and `TEST_INBOX_TOKEN` in the root `.env` (of this
  checkout or of the main one). If they are missing, `inbox.mjs` exits 2. Ask Dávid; never print
  the token.
- **The first message to a brand-new route can be lost.** Right after Email Routing was enabled
  (2026-10-16), the first SES send never arrived and the second arrived in 2 s. If nothing comes
  in 120 s, send once more before you report it.
- **The column comes with the migration.** The listener needs `orders.confirmation_sent_at`
  (migration `0002_order_confirmation_sent_at`). Against a database without it, the listener fails
  with `column "confirmation_sent_at" does not exist`; the 201 is unaffected.
- The e-mail lines are logged with `console.log` / `console.error`, so wrangler prints them without
  a `[wrangler:info]` prefix. Search for the text, not for the request line.
