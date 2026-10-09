# Weekly menu

At `/heti-menu` staff plan one ISO week as a grid. Monday to Saturday each have soups and mains,
and the week has up to five featured items. They save the week as a whole and publish it once,
after which guests can order from it. They can mark a day "Nincs rendelés" (closed), and mark
items sold out. The week is in the URL, so a reload keeps it.

## Sub-features

- `week-nav`: "Előző hét" / "Következő hét", the date picker "Hét kiválasztása egy napjával",
  and `?week=YYYY-Www`. Without the parameter the editor opens on `GET /default-week`. The week
  shows "Piszkozat" (draft) or "Publikálva: …".
- `week-edit`: "Leves hozzáadása", "Főétel hozzáadása" and "Ajánlat hozzáadása" add cards. Each
  card is a `group` named like "Hétfő, 1. leves", with "Név", "Leírás" and prices. "Sor törlése"
  removes a card.
- `week-save`: "Mentés" sends `PUT /weeks/<y>/<w>`, shows the toast "A heti menü elmentve.", and
  shows field errors from the API.
- `week-publish`: "Publikálás" opens "Publikálod a heti menüt?" (it lists days without a main)
  and confirms with "A heti menü publikálva: a vendégek már látják." It is irreversible in the
  app. It is blocked with "Publikálás előtt mentsd a módosításokat." when there are unsaved
  edits, and with "Üres hetet nem lehet publikálni." when the week is empty.
- `week-closed`: the per-day toggle "<Nap>: Nincs rendelés" posts or deletes a closed date, with
  the toasts "Erre a napra nem lehet rendelni." / "Erre a napra újra lehet rendelni."
- `week-sold-out`: a saved card's "Elfogyott" switch, with the toasts "Elfogyottnak jelölve." /
  "Újra rendelhető."
- `week-leave`: navigating away with unsaved edits asks "Elveted a módosításokat?", with
  "Elvetés" or "Maradok".

## How to get to it (user POV)

- Click the "Heti menü" link in the sidebar.
- Open `$ADMIN_URL/heti-menu?week=2090-W10` (any week) directly.
- Move with the week arrows or the date picker from any week.

## Driving it with the browser pane and api.sh

Preconditions:

- `doctor.sh` exits 0.
- Work in a far-future week nobody uses, such as `2090-W10`, unless the issue is about the
  current window. First check it is empty:
  `sql.mjs 'select * from menu_weeks where iso_year = 2090 and iso_week = 10'` must return `[]`.
  The integration tests use random weeks of the 2090s, so pick another week if it is taken.

- **Open.** Navigate to `$ADMIN_URL/heti-menu?week=2090-W10`. The editor shows "Piszkozat" and
  six day columns, "Hétfő"…"Szombat".
- **Edit and save.** Click "Leves hozzáadása" and "Főétel hozzáadása" under "Hétfő". Fill "Név"
  (and the main's price) in the new `group`s. Click "Mentés" and wait for "A heti menü elmentve."
  Reload: the cards persist. `api.sh --save week-save.api GET /api/admin/menu/weeks/2090/10`
  returns them.
- **Publish.** Click "Publikálás" and confirm. The toast reads "A heti menü publikálva…" and the
  header reads "Publikálva: …". The guest view `api.sh --save week-publish.public GET '/api/menu?week=2090-W10'`
  returns 200 `open` with your dishes.
- **Closed day.** Toggle "Hétfő: Nincs rendelés". `api.sh GET '/api/admin/menu/closed-dates?from=2090-03-06&to=2090-03-11'`
  lists the date. Toggle it back, and the list is empty again.
- **Restore.** `down.sh` does not delete menu weeks. Delete the week you created, children first:
  `delete from menu_schedule where iso_year=2090 and iso_week=10`, then the `menu_items` your
  cards created (their ids are in the save response), then `menu_weeks` and any `closed_dates`
  you left. Save the empty `select`s as `week-*.restored.json`.
- **Proof.** The `.http` files, a `shot.sh "$ADMIN_URL/heti-menu?week=2090-W10" week-publish.page`
  PNG, and the restored snapshots.

## Gotchas

- Publishing is permanent in the app ("Visszavonni nem lehet"). Publishing the current order
  window's week changes what every guest of the development site sees. Do it only with Dávid's
  yes, and never to "make the public page open" quietly.
- A far-future week is never `open` for ordering: `orderableDates` is empty. It proves
  publishing and the guest view, not checkout.
- Weekly item cards create `menu_items` rows. Restoring means deleting those rows too, not only
  the schedule.
- Closed dates are global per date, not per week row, and affect the guest menu and
  `POST /api/orders` (`date_closed`).
- `useBlocker` holds navigation while there are unsaved edits. A browser-pane `navigate` can get
  stuck on "Elveted a módosításokat?". Answer the dialog, or save first.
