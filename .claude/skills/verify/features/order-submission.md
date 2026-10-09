# Order submission

A guest's checkout sends one submission covering one or more delivery days in one ISO week. The
API decides from the database, never from the menu cache. It stores one order per day (status
`received`), upserts the customer by e-mail and answers with the totals. Otherwise it rejects with
field codes and stores nothing. There is no UI yet: the form arrives with O6 (#34) and checkout
with O7. Until then the real user path is the HTTP contract the form will use.

## Sub-features

- `order-201`: a valid submission returns 201
  `{ submissionId, orders: [{ id, deliveryDate, total }], grandTotal }`, and stores rows in
  `orders`, `order_menus`, `order_items`, `order_extras` and `customers`.
- `order-honeypot`: a filled `website` returns 200 with no orders. Nothing is stored.
- `order-400`: bad shape or field values return 400 `{ error: 'validation', fields }`, with codes
  from `packages/core/src/order/types.ts`.
- `order-409`: only `cutoff_passed` / `sold_out` failures return 409 `validation`. A staff-closed
  date returns 409 `date_closed` with `dates`.
- `order-limits`: over 64 KB returns 413, and more than 10 submissions in 10 minutes from one IP
  return 429. Loopback is never limited.

## How to get to it (user POV)

- Today: `POST $API_URL/api/orders` with the public site's Origin, through `api.sh`.
- After O6/O7: the order form on `$WEB_URL/megrendeles`. From then on, drive the form, and keep
  `api.sh` only for the cases the form cannot produce. Rewrite this section when it lands.

## Driving it with the browser pane and api.sh

Preconditions:

- **For `order-201`:** the menu state is `open`. Take the date from `orderableDates` and the item
  ids from `menu`.
- **E-mail:** every submission uses an address matching `verify+$RUN_ID…@example.com`. Use
  `$ORDER_EMAIL`, or `verify+$RUN_ID-2@example.com` for a second customer. `down.sh` deletes
  exactly those.

- **Write the body.** Fill `$EVIDENCE/order.json` from a fresh `api.sh GET /api/menu`. For one
  day, with one menu (that day's soup and main) and one box, it looks like this, with real ids:
  `{"name":"Teszt Elek","phone":"06301234567","email":"<ORDER_EMAIL>","address":"9700 Szombathely, Fő tér 1.","note":"","website":"","days":[{"deliveryDate":"<orderable date>","fulfilment":"delivery","menus":[{"soupId":"<day soup id>","mainId":"<day main id>"}],"extras":[{"key":"doboz","quantity":1}]}]}`.
  A main with `variations` needs `variation`. A main with `requiresSide` needs `sideId`.
- **Submit.** Run `api.sh --save order-201.response POST /api/orders @"$EVIDENCE/order.json"`.
  Expect 201 and `X-Db-Queries: 5`.
- **Side effect.** Run `sql.mjs 'select id, delivery_date, status, total, phone from orders where email = $1' "$ORDER_EMAIL"`
  and save it as `order-201.rows.json`. Expect one row per day, `received`, the phone as `+36…`,
  and totals equal to the response. Join `order_menus` / `order_items` on `order_id` when the
  issue is about pricing.
- **Rejection without writing.** Use a past date or a week that is not published, for example a
  day of 2026-W40. Expect 409 `fields: { "days.0.deliveryDate": "cutoff_passed" }`. This works
  in any menu state and proves the validation path. For example, Monday 2026-09-28 of the
  published 2026-W40 with its seeded soup `…0201` and main `…0203` gave exactly that on
  2026-10-09, with `X-Db-Queries: 4`. Check that `sql.mjs` finds no rows for the
  e-mail.
- **Honeypot.** Submit the same body with `"website":"x"`. Expect 200 with `orders: []` and no
  new rows.
- **Proof.** The `.http` responses, the row snapshots, and after `down.sh` the
  `$EVIDENCE/cleanup.txt` listing the deleted ids.

## Gotchas

- Orders land in the shared database. Never use an e-mail outside the `verify+$RUN_ID` pattern,
  or `down.sh` will not remove it. If a run died before `down.sh`, delete its rows with the
  same two statements `down.sh` uses, and give that run's id.
- `sold_out` and `date_closed` are read inside the transaction. To prove them, change the item or
  the date through the admin first (snapshot and restore). Do not use SQL for that.
- The confirmation e-mail (#32) will hang off `OrderEvents.orderSubmitted`. Once it exists,
  confirm `EMAIL_DRY_RUN` is on before submitting, because `example.com` must still never be
  mailed for real.
- Loopback is exempt from the rate limit. `order-limits` 429 cannot be produced locally. Prove it
  with the unit tests, and say so.
- `website` is optional: leaving it out is the same as empty (checked 2026-10-09). Only a
  non-empty value triggers the honeypot.
