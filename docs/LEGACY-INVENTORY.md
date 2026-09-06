# Legacy inventory — `ci_piccolo/` (CodeIgniter 3 + AngularJS 1.x)

Functional inventory of the old system, produced 2026-09-06 by reading the code.
Reference, not specification: the rewrite copies functionality, not implementation.

## 1. Public site

Routes (`application/config/routes.php:52-58`): `/` weekly menu, `/megrendeles` ordering,
`/galeria`, `/elerhetoseg`, `/kapu` admin shell, everything else 404.
Dead links: `/adatkezeles` (privacy) and `/kapcsolat` have no route.
There is NO à-la-carte page, no news, no "rólunk". "Étlap" = admin-managed permanent items
merged into the weekly menu page and the order form.

### `/` weekly menu (`Front.php:61-73`, `views/hetimenu.php`)
- Day tabs Mon–Sat; today's tab preselected (Sunday: none).
- Per day: `napimenu` dishes (name, description, price). `ar == 0` renders "a soup is included".
- Fixed sections from étlap JSON: Kiemelt ajánlat, Egész héten rendelhető, Desszertek,
  Savanyúságok, Feláras köretek (weekday price shown; weekend price commented out).
- Hardcoded extras (`hetimenu.php:115-137`): soup only 650, main without soup −100,
  ketchup/tartar 400, box 100, bread 50.
- Allergens: one static sentence, no data model.
- Sidebar: delivery 150 Ft, Mon–Sat, phone, minimum 2200 Ft/address, intake 07:30–09:30,
  open Mon–Sat 11–16.

### Week/day/cutoff logic
- `getCurrentWeek()` (`Front.php:16-35`): on Sat/Sun jump to next week IF next week's menu exists.
- `getCurrentDay()` (`Front.php:37-59`): after 09:30 Mon–Thu → tomorrow; before 09:30 Mon–Fri → today;
  Fri after 09:30 / Sat / Sun → next Monday if next week uploaded, else "no menu yet" overlay.
- Cutoff history: 10:30 → 10:00 → 09:30.
- Latent bug: PHP rolls week on Sat+Sun, JS only on Sun → Saturday inconsistency.

### `/megrendeles` ordering (`views/megrendeles.php`, `assets/scripts/_megrendeles.js`)
- CURRENTLY DISABLED by a hardcoded sentence ("technikai hiba"); form still renders below.
- Loads `GET /api/hetimenu?date=YYYY/W`, flattens per day with `cat` labels
  (Napi menü / Kiemelt ajánlat / Egész héten rendelhető).
- Day tabs Mon–Sat; days before first orderable day disabled; badge = menus in that day's cart.
- Composing ONE menu, five slots: Leves (day's `ar==0` items, "nem kérek" allowed) · Főétel
  (napimenu + kiemelt + egész héten; `maxorder==0` disabled = manual sold-out) · variáció
  (`;`-split, REQUIRED if present) · Köret (alap + feláras; shown/required only when főétel has
  `koret==true`) · Savanyúság · Desszert (+variations).
- "Hozzáad" pushes menu into `globalCart[day]`; multiple menus per day = GROUP ORDERING;
  index becomes `food.menu_number`.
- Pricing: numeric or `{hetkoznap,hetvege}` (weekend chosen by BROWSING day, not delivery day — bug).
  −100 if main without soup and not `ignore_leves`; +450 if soup only (site advertises 650 — mismatch).
  No delivery fee charged, no discounts, no packaging fee. Per-day totals → `orders.price`.
- Checkout modal: warning if total < 2200 (advisory only). Fields: Név*, Telefon*, Email (optional),
  Cím+csengő*, Megjegyzés. DELIVERY ONLY, no pickup, no payment selector, no online payment.
  Fields cached in localStorage. `POST /api/megrendeles` → cart emptied, "rögzítettük" message.
  NO email at submit time.

### `/galeria`: 9 hardcoded photos, lightbox. `/elerhetoseg`: static address/phone/hours/map iframe.

### Public API (`controllers/Api.php`) — only `is_ajax_request()` guard, NO AUTH on anything except login
GET etlap · GET hetimenu?date · POST megrendeles · POST week (write!) · PUT etlap (write!) ·
GET megrendeles/{day} · GET megrendeles_by_id/{id} · GET megrendeles_confirm/{id} (sends email!) ·
GET currentday · login.

## 2. Admin (`/kapu`, `Back.php`, SPA in `dist/scripts/backend-edit.js`)
Server-side login guard commented out; only client-side ui-router gates. Aauth, role `Admin`.

| State | What staff can do |
|---|---|
| Order list `/{day}/nap` | Per weekday of the SERVER'S CURRENT ISO WEEK. Columns: Név, Cím, Dátum, Összeg, Státusz (Folyamatban/Feldolgozva). Row modal: customer data + each menu by menu_number. Button "Visszaigazolás" → status=1 + customer email. No cancel/edit/delete/filter/search/print/export, no week picker. |
| Daily summary `/napi-osszefoglalo` | TODAY only: count tables per dish (variation name if any) for Főétel/Leves/Köret/Desszert/Savanyúság + order count + revenue. |
| Weekly upload `/heti` | Pick week (date or week number), load existing. Grid 7 days × 7 rows: nev, reszletek, ar, variaciok, maxorder, ignore_leves. Default prices weekday [0,0,1020,1020,1120,1120,1170], Sat [0,0,1120,1120,1220,1220,1270]. Kiemelt: 5 rows with hetkoznap/hetvege. Text-parse helpers: "Név (részletek)" split; "A - B - C" → variations. Save = DELETE whole week + reinsert. No images, allergens, copy-previous-week. |
| Étlap `/etlap` | Edit one JSON blob: egesz_heten (nev, reszletek, 2 prices, variaciok, köret checkbox), desszert, savanyusag, koret (name only), felaras_koret (name + 2 prices). Fixed-length arrays. |
| Login | email + password + remember |

Nav has "Statisztika" → nonexistent route. No customer mgmt, no staff mgmt UI, no settings screen.

## 3. Emails
Exactly ONE: `Backend::email_send()` on staff "Visszaigazolás". To customer if email non-empty.
From info@piccoloetterem.hu. Subject "♨ Sikeres megrendelés!". Body: "rögzítettük, kollégánk
feldolgozta, hamarosan kiszállításra kerül". NO order contents/total/day in the email.
No email to staff on new order. Plain PHP mail().

## 4. Data model (as used by `models/Backend.php`)
- `menu2`: id, date 'YYYY/W', day 0–7 (0 for kiemelt), cat napimenu|kiemelt, nev, reszletek,
  variaciok (;), ar (int, or JSON {hetkoznap,hetvege} for kiemelt), maxorder (0 sold out, −1 unlimited), ignore_leves.
- `menu`: key/value JSON; only live row `date='etlap'`.
- `user`: one row PER SUBMISSION (id, name, tel, email, address, ip). Blind array_merge of client JSON.
- `orders`: id, user_id, day 1–6, date 'YYYY/W', price (day total), message, status 0/1, timestamp. One row per day.
- `food`: id, order_id, type leves|foetel|koret|savanyusag|desszert, name, variation, menu_number. NO per-line price.
- Aauth tables.
No images, allergens, categories, delivery zones, settings, customers.

## 5. Static content — all hardcoded in PHP views
Gallery, contact, sidebar, header intake window, extras price list, Schema.org JSON-LD (rating 4.9/278;
404 page has stale duplicate with old address).

## 6. Config / constants (hardcoded)
Cutoff 09:30 · intake 07:30–09:30 Mon–Sat · orderable Mon–Sat · week rollover Sat+Sun (PHP) / Sun (JS) ·
next-week gate = menu exists · minimum 2200 Ft (warning only) · delivery 150 Ft (never charged) ·
soup-only +450 (site says 650) · no-soup −100 unless ignore_leves · weekend = Saturday ·
grid 7×7, 5 kiemelt · open Mon–Sat 11–16 · address Mátyás Király u. 12., +36 30 490 1122 ·
no delivery zone · DB creds committed · CSRF off.

## 7. Surprising
1. Admin API has no server-side auth; anyone can write the menu and read all orders.
2. Ordering disabled by a hardcoded sentence, not a flag.
3. Delivery fee and minimum are marketing text only. Payment logos decorative; no payment handling.
4. Soup-only undercharged by 200 Ft (450 vs 650).
5. Weekend pricing by browsing day, not delivery day.
6. PHP/JS Saturday week disagreement.
7. `user` is not a customer table; no history, no dedupe; personalisation = localStorage.
8. One submission → several `orders` rows sharing one `user` row.
9. Unvalidated client JSON inserted directly.
10. Detail endpoint never returns status; "Már feldolgozva" relies on list row.
11. Statisztika nav → 404.
12. `maxorder` is a manual switch, not stock; not enforced server-side.
13. Admin only sees the current ISO week; Sunday orders for next week invisible until rollover.
14. Weekly save destroys and recreates the week; no history.
15. Uncommitted working-copy changes carry the current business rules (address, 2200 min, 150 delivery,
    Saturday, 5th kiemelt, new extras).
