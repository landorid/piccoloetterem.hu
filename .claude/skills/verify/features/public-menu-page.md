# Public menu page

A guest opens `/` without an account and reads the week's menu. The restaurant's contact details,
delivery terms and price rules come with the page. The browser then loads the week the guest can
order from (`GET /api/menu`). When the API has no orderable week, the page loads the guest's
current week with `GET /api/menu?week=YYYY-Www` and shows it to read, with a notice. The page takes
no orders: "Rendeld meg online" links to `/megrendeles`.

## Sub-features

- `week-bar`: "Heti menü", the week pill ("42. hét"), the date range and the terms line. No
  cutoff sentence.
- `day-tabs`: a tab per menu day. Today's tab is selected when today is in the week, else the
  first orderable day, else Monday. Every day can be selected, past days included; a day staff
  closed shows "ZÁRVA" and, in its panel, "Erre a napra nem lehet rendelni." above the dishes.
- `day-panel`: the day's name ("Hétfő, okt. 12."), then "LEVESEK" and "FŐÉTELEK". A soup shows
  "Benne van a menü árában" and "külön 650 Ft" instead of a price. A main shows core's price for
  that day, so Saturday's mains show Saturday's price.
- `dishes`: each row has the name, the description, a note line ("Választható: …", "+ választott
  leves", "+ választott köret"), the allergen chips and the price. A sold-out dish is struck
  through and tagged "Elfogyott".
- `sections`: "Kiemelt ajánlat", "Egész héten rendelhető", "Desszertek", "Savanyúságok",
  "Köretek" (no prices) and "Feláras köretek". A section with no items is left out. A price that
  differs on Saturday adds "szombaton N Ft".
- `prices`: "Árak és extrák": "Csak leves", "Főétel leves nélkül", and every extra as "N Ft / db",
  all from the config, then the VAT sentence.
- `info`: "Rendelj házhoz!": delivery fee, delivery days, minimum, intake window, phone, opening
  hours, address, and "Rendeld meg online". Beside the menu on desktop, below it on a phone.
- `order-bar`: on a phone, a sticky "Rendeld meg online" bar. Hidden when the week cannot be
  ordered.
- `fallback-week`: `next_week_not_published` or `closed` from `GET /api/menu`, and the guest's
  current week is published: that week is shown with "A jövő heti menü még nem érhető el" or
  "Erre a hétre már nem tudsz online rendelni".
- `no-menu`: neither week is published: "A jövő heti menü még nem érhető el" or "Erre a hétre még
  nincs feltöltve menü", with the phone number.
- `load-failed`: "Nem sikerült betölteni a menüt" with "Újrapróbálom".

## How to get to it (user POV)

- Open `$WEB_URL/`.

## Driving it with the browser pane and api.sh

- `doctor.sh` prints the menu state. On `open`, open `$WEB_URL/` in the browser pane and wait for
  the tab list. Click a tab by its name ("Szombat, okt. 17.") and read the panel with
  `get_page_text`.
- Compare against the API: `$S/api.sh GET /api/menu` (the window week) and
  `$S/api.sh GET '/api/menu?week=2026-W42'`.
- Phone layout: `resize_window` with `preset: "mobile"`. Headless `shot.sh` covers 1280 px.
- `fallback-week` and `no-menu` depend on the clock and on what is published. Do not publish or
  unpublish a week to reach them. The component tests (`MenuPage.test.tsx`) cover them with a
  stubbed `/api/menu`; report them as covered by tests only.

## Gotchas

- `astro dev` shows its toolbar at the bottom of the page. It is not the app. For screenshots
  without it, build with `PUBLIC_API_URL=$API_URL` and serve `apps/web/dist`.
- The API's CORS allows only the run's `WEB_URL` origin. A page served from another port gets no
  menu.
