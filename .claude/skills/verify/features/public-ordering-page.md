# Public ordering page

A guest opens `/megrendeles` without an account. The restaurant's name, contact details and
delivery terms come with the page. The browser then loads the week the guest can order from. On
an open week the page is the order form (O6, #34): a week bar and day strip, then for the
selected day a form for the next menu, the day's order beside it (below it on a phone) and a
summary with the grand total. Every price is computed by `@piccolo/core` in the browser. The cart
lives in the tab's `sessionStorage`. Otherwise the page shows why ordering is unavailable, with
the phone number. "Tovább a rendeléshez" opens checkout (O7, #35), a screen of the same island.

## Sub-features

- `week-bar`: "Heti menü", the week pill ("37. hét"), the date range, the cutoff sentence ("A mai
  napra 9:30-ig adhatsz le rendelést." when the first orderable day is today, "A mai
  rendelésfelvétel 9:30-kor lezárult…" when it is tomorrow, nothing otherwise) and the terms line
  with the delivery fee and the minimum.
- `day-rail`: a tab per menu day ("Szerda, szept. 9."). Past days are disabled, titled "Erre a
  napra már lezárult a rendelésfelvétel". A day staff closed (#60) shows "ZÁRVA", stays
  selectable and shows "Erre a napra nem lehet rendelni." instead of the form. A day with menus
  carries a count badge; its tab name ends with "N menü a kosárban erre a napra". Arrow keys,
  Home and End move focus; Enter, Space or a click selects and moves focus to the form heading.
- `composer`: "N. menü összeállítása" with the soup block ("LEVES · VÁLASSZ" until answered), the
  main row ("Főétel: Válassz", opens the "Főétel választása" dialog), the variation and side
  blocks when the main needs them ("· KÖTELEZŐ"), pickle and dessert (start on "Nem kérek"), the
  Extra steppers ("Több: Doboz" / "Kevesebb: Doboz"), the price box, the live price, "Ürítés" and
  "Hozzáadás" (disabled until the menu can be added; the reason shows above it).
- `allergens`: chips under every dish, a bubble naming "7 · Tej és tejtermék (laktóz)" on hover,
  focus or tap. More than three collapse into "+N".
- `day-cart`: "A rendelésed erre a napra", numbered menus with their lines, "Módosítás" (back into
  the form, with the day's extras), "Törlés", the day's extras as "Doboz × 2" lines, "Ételek
  összesen", "Még egy menü ehhez a naphoz".
- `summary`: on a phone a sticky bar ("3 menü · 2 nap", the total, "Részletek"); on desktop a
  card in the rail. Per day "Ételek" and "Kiszállítás", then "Fizetendő összesen". No minimum
  warning anywhere.
- `checkout`: "Rendelés véglegesítése": "Vissza a menühöz", the minimum notice ("Nem éred el a
  napi minimumot", one "<nap>: N Ft különbözet" line per day under it; it never blocks), the
  contact card (Név, Telefonszám, E-mail cím, Szállítási cím, Megjegyzés), "Rendelés elküldése";
  the whole order in the rail ("Kosár értéke"). Fields are checked on blur and on submit with
  core's `validateContact`; a failed submit shows "Nézd át a pirossal jelölt mezőket." and focuses
  the first marked field. While sending, the button reads "Küldés folyamatban…" and is disabled.
- `checkout-prefill`: after a stored order, `localStorage['piccolo.customer']` keeps name, phone,
  e-mail and address (never the note); the next checkout is filled from it, with "Az adataidat a
  legutóbbi rendelésedből töltöttük ki. Törlés". "Törlés" forgets and empties them.
- `checkout-success`: "Köszönjük, megkaptuk a rendelésed!", the e-mail address, one card per day
  with "Azonosító: <order id>", "Fizetendő összesen" (the API's `grandTotal`), "Új rendelés
  indítása". The cart is emptied.
- `checkout-refused`: 409 `sold_out` → "Időközben elfogyott" listing "<nap> · N. menü · <étel>",
  "Vissza a kosárhoz" opens the day with that menu marked "Elfogyott" and focused; 409
  `cutoff_passed` / `date_closed` → the day leaves the cart with "Lejárt a rendelési határidő" /
  "Erre a napra időközben nem lehet rendelni"; 400 on a field → the field is marked; no answer
  or 5xx → "Nem sikerült elküldeni a rendelést" with "Újraküldés"; 429 → "Most túl sok rendelés
  érkezett".
- `refetch`: the menu is fetched again when the tab becomes visible. A day that left
  `orderableDates` leaves the cart with a "Lejárt a rendelési határidő" banner ("Értem" closes it).
- `menu-next-week`: after the Friday cutoff with next week unpublished, the page shows "A jövő
  heti menü még nem érhető el".
- `menu-closed`: this week is unpublished, or every remaining day is closed. The page shows
  "Erre a hétre még nincs feltöltve menü".
- `menu-load-failed`: the API is unreachable. The page shows "Nem sikerült betölteni a menüt"
  with an "Újrapróbálom" button.
- `chrome`: the masthead (logo `aria-label` = restaurant name, "Rendelésfelvétel …" intake
  window, phone) and the footer ("Nyitvatartás", "Kiszállítás", "Elérhetőség"). Both come from
  `GET /api/config/public` when the page is rendered.
- `root-redirect`: `/` redirects to `/megrendeles` (302).

## How to get to it (user POV)

- Open `$WEB_URL/megrendeles` directly.
- Open `$WEB_URL/`, which redirects.

## Driving it with the browser pane and api.sh

Preconditions:

- `doctor.sh` exits 0. Note the `menu` line: it decides which sub-feature you can see.
- To see the order form when the state is not `open`, the order window's week must be published.
  That is a shared-DB write visible on the deployed development site. Ask Dávid first. With his
  yes, publish it the staff way (`admin-weekly-menu.md`), and say so in your report.

- **Load.** Navigate the browser pane to `$WEB_URL/megrendeles`. Before the menu arrives, the
  heading "Heti menü" shows with a status "A heti menü betöltése…". Then one of the states above
  replaces it. The API log shows `GET /api/menu 200`.
- **Compose and add.** `find` the radio by the dish name in the "Leves" group (or "Nem kérek"),
  click "Főétel: Válassz" and pick a dish in the dialog, answer "Változat" and "Köret" if they
  appear, then "Hozzáadás". The live price above it, the price box and the day's order show the
  same menu price. Compare with core: O1's worked examples are 650 (a soup alone), 920 (a 1020
  daily main without its soup) and 2100 (a 1450 all-week main with a soup).
- **Badges, edit, remove.** After adding, the day's tab name gains "1 menü a kosárban erre a
  napra". "Módosítás" empties that menu back into the form; "Törlés" on the last menu drops the
  day, its extras and its badge.
- **Reload keeps the cart.** Reload the tab; the day's order and the badges are unchanged. A new
  tab starts empty (`sessionStorage`).
- **Closed and past days.** Compare the tabs with `api.sh GET /api/menu`: days in
  `closedDates` are closed by staff; the other days missing from `orderableDates` are disabled.
- **Refetch.** Switch to another tab and back after an admin change (or after 09:30). The API log
  shows a second `GET /api/menu` (200, or 304 when nothing changed, with no `OPTIONS` preflight).
- **Any week as a guest sees it.** `api.sh GET '/api/menu?week=2026-W40'` returns a published
  week as `open`, with no orderable dates, or 404 `week_not_published`. Use it to read sold-out
  flags and prices after an admin change, as a second view.
- **Not-open states.** `shot.sh "$WEB_URL/megrendeles" menu-next-week.page` (or
  `menu-closed.page`). The PNG shows the message card with the phone number and the address.
- **Load failure.** Not drivable without stopping this run's API: `kill -TERM -- -$API_PID`, then
  reload. The page shows "Nem sikerült betölteni a menüt". Stopping the API ends the run, so do
  this last and then `down.sh`.
- **Proof.** Browser-pane screenshots of the form, the day's order and the summary with their
  totals, the matching `api.sh --save` menu response, and the `GET /api/menu` lines from
  `$VERIFY_RUN/logs/api.log`.

## Gotchas

- The clock decides. On Friday after 09:30, and all weekend, the window is next week:
  `lastSameWeekOrderDay` is Friday, so Saturday cannot be ordered from Friday's window. On
  2026-10-09 the only published week was 2026-W40, so the live state was
  `next_week_not_published`.
- `pnpm db:seed:dev` publishes the *current* ISO week only, and it writes the shared DB. It does
  not help after the Friday cutoff. Do not run it without asking.
- The cart is `sessionStorage` key `piccolo:order` (version 1). Clear it between scenarios
  (`sessionStorage.clear()` in the page, then reload), or the previous run's cart reappears.
- A day is `closed` (staff closed it, #60) when it is in the API's `closedDates`: closed days
  from the first orderable day on, so today before 09:30 too. A day staff closed whose intake is
  over anyway is not in it and looks like any past day. A selected closed day stays selected
  across a refetch and a reload.
- The dev database's 2026/40 daily soups carry an item price of 650 Ft (the seed and core say 0),
  so beside a daily main the soup row says 0 Ft but the price box adds 650 Ft. Plain sides are
  priced there too (600/500 Ft). The page shows what core prices; it is data, not the page.
- The main-course dialog is a native modal `<dialog>`; Escape or "Bezár" closes it and focus
  returns to the main row. The allergen bubble is a popover, so it shows above the dialog too.
- The minimum (2200 Ft per day) is never warned about on the order form; checkout names each day
  under it (#57).
- Checkout submits for real: use `$ORDER_EMAIL` so `down.sh` deletes the orders. Toggling an item
  sold out in the admin (`admin-weekly-menu.md`) after it is in the cart reaches the 409 path.
- A click on "Rendelés elküldése" keeps focus in the field being typed in (mousedown is
  prevented), so a blur error cannot move the button away mid-click.
- The menu cache is this run's private Miniflare KV, empty at launch. `X-Db-Queries: 4` on the
  first read of a week is a load, not a missed purge. After an admin write, 0 means the purge
  did not happen. A run's cache is never shared with the deployed site's KV.
- The config is fetched per request under `astro dev`, but baked in at build time in production.
  A config change needs a rebuild there.
- Headless screenshots cannot go below about 500 px wide. Check phone layout with
  `resize_window` `preset: "mobile"` in the browser pane. Reset it to `desktop` afterwards.
- The dark bar at the bottom in dev is Astro's dev toolbar.
