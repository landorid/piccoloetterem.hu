# Weekly menu

At `/heti-menu` staff plan one ISO week as a grid. Monday to Saturday each have soups and mains,
and the week has up to five featured items. They save the week as a whole and publish it once,
after which guests can order from it. They can mark a day "Nincs rendelés" (closed), and mark
items sold out. The week is in the URL, so a reload keeps it.

## Sub-features

- `week-nav`: "Előző hét" / "Következő hét", the date picker between them (a button named by the
  week's Monday, such as "2090. március 6., hétfő"), and `?week=YYYY-Www`. Without the parameter
  the editor opens on `GET /default-week`. The week shows "Piszkozat" (draft) or "Publikálva: …".
- `week-edit`: the days are stacked one below the other, each a `region` with its name and date,
  "Levesek" above "Főételek". The region "Kiemelt ajánlat" comes after Saturday. Each dish is a
  fieldset named like "Hétfő, 1. leves", "Hétfő, 2. főétel" or "Kiemelt ajánlat, 1. kiemelt
  ajánlat" (`read_page` prints it as `generic`). It holds the textboxes "Név" and
  "Leírás", the buttons "Variációk: …" and "Allergének: …", the checkbox "Levessel" (not on
  soups), the switch "Elfogyott" and the trash button "Sor törlése". Soups have no price. A
  weekday main has "Ár". Saturday's mains and the featured items have "Hétköznapi ár" and
  "Hétvégi ár".
  - A week with no items opens as blank slots: three soups and five mains a day, and four
    featured rows. The mains are priced 1020, 1020, 1120, 1120 and 1170 (Saturday's weekend
    price is 100 more). The featured rows have no price.
  - A stored week shows its saved rows. Each day's soups are padded to three blank slots and the
    featured to four. Mains are not padded: a day without a saved main shows only "Főétel
    hozzáadása".
  - A row with no name, description, variation or allergen is a blank slot. "Mentés" leaves it
    out, and removing it is not an unsaved change.
  - A day with three soups has no "Leves hozzáadása". The button appears when you remove a soup
    row. "Főétel hozzáadása" and "Ajánlat hozzáadása" add a row at the end of their list.
- `week-save`: "Mentés" is in the bar fixed to the bottom of the page. It is disabled until there
  is an unsaved change. The bar's `status` reads "Nem mentett módosítások" or "Minden változás
  elmentve." "Mentés" sends `PUT /weeks/<y>/<w>` and shows the toast "A heti menü elmentve."
  Field errors show under their fields. A price that is missing or not a number is caught before
  the request, with "Kötelező." or "Egész forintot adj meg." under it and the toast "Néhány mező
  hibás. Javítsd, majd próbáld újra." A named featured row needs a "Hétköznapi ár", because it
  starts empty.
- `week-publish`: "Publikálás" sits beside "Mentés" while the week is a draft, and is gone once
  it is published. It opens "Publikálod a heti menüt?" (it lists days without a main) and
  confirms with "A heti menü publikálva: a vendégek már látják." It is irreversible in the app.
  It is disabled with the title "Publikálás előtt mentsd a módosításokat." when there are unsaved
  edits, and "Üres hetet nem lehet publikálni." when the week is empty. The browser pane names
  the disabled button by that title, so `find "Publikálás"` does not return it then.
- `week-closed`: the per-day toggle "<Nap>: Nincs rendelés" posts or deletes a closed date, with
  the toasts "Erre a napra nem lehet rendelni." / "Erre a napra újra lehet rendelni." A closed
  day shrinks to its header. Its rows stay in the draft, and `find` still returns them.
- `week-sold-out`: a saved row's "Elfogyott" switch, with the toasts "Elfogyottnak jelölve." /
  "Újra rendelhető." On a row that has never been saved it is disabled, titled "Mentés után
  állítható".
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

- **Open.** Navigate to `$ADMIN_URL/heti-menu?week=2090-W10`. The editor shows "Piszkozat", the
  days "Hétfő"…"Szombat" one below the other, and "Kiemelt ajánlat". The bottom bar's `status`
  reads "Minden változás elmentve.", and "Mentés" and "Publikálás" are disabled.
- **Edit and save.** The empty week already has blank slots, so you add no rows. `find` "Hétfő,
  1. leves", click its "Név" and type a name. Do the same in "Hétfő, 1. főétel", whose "Ár" is
  already 1020. The `status` changes to "Nem mentett módosítások". Click "Mentés" in the bottom
  bar. Use `find 'button "Mentés"'`, because a plain "Mentés" first matches the "Mentés után
  állítható" title of every unsaved row. Wait for "A heti menü elmentve."
  - Reload. Monday shows your soup above two blank soup slots, and your main alone. The other
    days show three blank soups and only "Főétel hozzáadása" under "Főételek".
  - `api.sh --save week-save.api GET /api/admin/menu/weeks/2090/10` returns your two items and
    nothing from the blank slots.
- **Publish.** Click "Publikálás" in the bottom bar. The dialog has its own "Publikálás": `find
  'button "Publikálás"'` returns the bar's first and the dialog's second, so click the second.
  The toast reads "A heti menü publikálva…", the header reads "Publikálva: …", and the bar no
  longer has "Publikálás". The guest view `api.sh --save week-publish.public GET '/api/menu?week=2090-W10'`
  returns 200 `open` with your dishes.
- **Closed day.** Toggle "Hétfő: Nincs rendelés". `api.sh GET '/api/admin/menu/closed-dates?from=2090-03-06&to=2090-03-11'`
  lists the date. Toggle it back, and the list is empty again.
- **Restore.** `down.sh` does not delete menu weeks. Delete the week you created, children first:
  `delete from menu_schedule where iso_year=2090 and iso_week=10`, then the `menu_items` your
  rows created (their ids are in the save response), then `menu_weeks` and any `closed_dates`
  you left. Save the empty `select`s as `week-*.restored.json`.
- **Proof.** The `.http` files, a `shot.sh "$ADMIN_URL/heti-menu?week=2090-W10" week-publish.page`
  PNG, and the restored snapshots.

## Gotchas

- Publishing is permanent in the app ("Visszavonni nem lehet"). Publishing the current order
  window's week changes what every guest of the development site sees. Do it only with Dávid's
  yes, and never to "make the public page open" quietly.
- A far-future week is never `open` for ordering: `orderableDates` is empty. It proves
  publishing and the guest view, not checkout.
- Every saved weekly row creates a `menu_items` row. Restoring means deleting those rows too, not
  only the schedule.
- Closed dates are global per date, not per week row, and affect the guest menu and
  `POST /api/orders` (`date_closed`).
- `useBlocker` holds navigation while there are unsaved edits. A browser-pane `navigate` can get
  stuck on "Elveted a módosításokat?". Answer the dialog, or save first.
