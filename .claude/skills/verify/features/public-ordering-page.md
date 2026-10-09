# Public ordering page

A guest opens `/megrendeles` without an account. The restaurant's name, contact details and
delivery terms come with the page. The browser then loads the week the guest can order from. On
an open week it lists every day's soups and mains with prices and allergens, then the featured
and permanent sections. Otherwise it shows why ordering is unavailable, with the phone number.
The order form replaces the listing in O6 (#34). Update this file when it lands.

## Sub-features

- `menu-open`: an open week lists days 1–6 (`Hétfő`…`Szombat`). A day not orderable now says
  "Erre a napra most nem lehet rendelni." Sold-out dishes carry "Elfogyott".
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
- To see `menu-open` when the state is not `open`, the order window's week must be published. That
  is a shared-DB write visible on the deployed development site. Ask Dávid first. With his yes,
  publish it the staff way (`admin-weekly-menu.md`), and say so in your report.

- **Load.** Navigate the browser pane to `$WEB_URL/megrendeles`. Before the menu arrives, the
  heading "Heti menü" shows with a status "A heti menü betöltése…". Then one of the states above
  replaces it. The API log shows `GET /api/menu 200`.
- **Open week.** `find` "Hétfő" (an H2 per day, id `day-YYYY-MM-DD`) and "Kiemelt ajánlat" /
  "Egész héten rendelhető". Compare names and prices with
  `api.sh --save menu-open.api GET /api/menu`. The page must match the API's `menu`, and the days
  not in `orderableDates` must carry the not-orderable note.
- **Any week as a guest sees it.** `api.sh GET '/api/menu?week=2026-W40'` returns a published
  week as `open`, with no orderable dates, or 404 `week_not_published`. Use it to read sold-out
  flags and prices after an admin change, as a second view.
- **Not-open states.** `shot.sh "$WEB_URL/megrendeles" menu-next-week.page` (or
  `menu-closed.page`). The PNG shows the message card with the phone number and the address.
- **Load failure.** Not drivable without stopping this run's API: `kill -TERM -- -$API_PID`, then
  reload. The page shows "Nem sikerült betölteni a menüt". Stopping the API ends the run, so do
  this last and then `down.sh`.
- **Proof.** The `shot.sh` PNG or a browser-pane screenshot of the state, the matching
  `api.sh --save` response, and the `GET /api/menu` line from `$VERIFY_RUN/logs/api.log`.

## Gotchas

- The clock decides. On Friday after 09:30, and all weekend, the window is next week:
  `lastSameWeekOrderDay` is Friday, so Saturday cannot be ordered from Friday's window. On
  2026-10-09 the only published week was 2026-W40, so the live state was
  `next_week_not_published`.
- `pnpm db:seed:dev` publishes the *current* ISO week only, and it writes the shared DB. It does
  not help after the Friday cutoff. Do not run it without asking.
- The menu cache is this run's private Miniflare KV, empty at launch. `X-Db-Queries: 4` on the
  first read of a week is a load, not a missed purge. After an admin write, 0 means the purge
  did not happen. A run's cache is never shared with the deployed site's KV.
- The config is fetched per request under `astro dev`, but baked in at build time in production.
  A config change needs a rebuild there.
- Headless screenshots cannot go below about 500 px wide. Check phone layout with
  `resize_window` `preset: "mobile"` in the browser pane. Reset it to `desktop` afterwards.
- The dark bar at the bottom in dev is Astro's dev toolbar.
