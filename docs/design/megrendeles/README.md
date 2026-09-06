# `/megrendeles` — design note

The mockup for the public ordering page, produced for [issue #30](https://github.com/landorid/piccoloetterem.hu/issues/30) (O2).
Issues O5–O7 build to it; the copy is handed over separately in [strings.md](strings.md).

| | |
|---|---|
| The mockup | [`mockup.html`](mockup.html) — open it in a browser, no build step, no dependencies |
| The copy | [`strings.md`](strings.md) — paste-ready `strings.ts` |
| One-screen overview | [`overview.png`](overview.png) — all 17 states at mobile width |

## How to read it

Pick a state from the top bar. **Mindkettő** shows it at 375 px and 1280 px side by side,
**Áttekintés** shows every state at once. The top bar is the review harness, not the design.

The mockup is *derived*, not drawn. One strings table, one week of realistic menu data and one
pricing function — which mirrors the rules in [PLAN.md §2](../../PLAN.md) — generate the markup.
Every forint on screen is computed, so a misread rule shows up as a wrong number instead of
hiding in a picture. It is also clickable: switch days, compose a menu, add it, change quantities.
Selecting a state again resets it.

## The design

### Colour

Descended from the old site's brown `#845c30`, warmed and given a proper ramp. One accent, spent
in one place: the brand brown is the only saturated colour that appears on controls. Neutrals are
warm-biased, never pure grey, so nothing on the page reads as "default UI".

| Token | Value | Used for |
|---|---|---|
| `--brand-900` | `#33210f` | footer ground |
| `--brand-800` | `#4a3018` | masthead (white text, 12.2:1) |
| `--brand-700` | `#5f4222` | pressed primary, link text on paper |
| `--brand-600` | `#7a5230` | **primary** — buttons, active tab, cart badge (white text, 6.8:1) |
| `--brand-500` | `#96693f` | focus ring |
| `--brand-200` | `#e7d3ba` | secondary button border, masthead meta text |
| `--brand-100` | `#f3e7d7` | week pill, "Választható" tags |
| `--brand-50` | `#faf4ec` | allergen notice, option group headers, sheet close button |
| `--ink-900` | `#211c16` | body text |
| `--ink-700` | `#4b4239` | descriptions, secondary body |
| `--ink-500` | `#7b7065` | labels, help text, placeholders, sold-out rows (4.8:1) |
| `--ink-400` | `#8a7f72` | chevrons and disabled controls **only** — decorative, below 4.5:1 by intent |
| `--line` / `--line-strong` | `#e8dfd2` / `#d6c8b4` | hairlines / input borders, dashed totals rule |
| `--paper` / `--ground` | `#ffffff` / `#faf6f0` | cards / page |

Semantic colour is separate from the accent and never decorative:
`--ok-700 #2c6e4a` on `--ok-100 #e3f1e8` (success), `--warn-700 #8a5300` on `--warn-100 #fdf0dc`
(minimum not reached, cutoff passed), `--danger-700 #a3251d` on `--danger-100 #fbe8e5` (sold out,
field errors, failed submission).

Every error state is carried by **shape and words as well as colour** — a red field also gets a
tinted background and a sentence under it; a sold-out dish is struck through as well as greyed.

### Type

| Role | Face | Where |
|---|---|---|
| Display | **Fraunces** 500 | dish names, headings, the grand total, the success headline |
| UI | **Manrope** 400/600/700 | everything else: labels, prices, buttons, help text |

The serif on dish names is the one piece of restaurant in the page — it makes a list of food read
like a menu rather than like a table of SKUs. It never runs longer than a dish name, so it costs
nothing in legibility at 07:40 on a phone.

Scale, in rem against a 16 px base: `12 · 13 · 15 · 16 · 18 · 20 · 24 · 30`. Body is 16, the
smallest text that carries meaning is 13, and 12 is reserved for allergen codes and badges. Every
column of digits carries `font-variant-numeric: tabular-nums`.

> **Production note.** Both faces must be **self-hosted** in the Astro build (`latin-ext` subset —
> Hungarian needs ő and ű), not loaded from Google's CDN: an EU restaurant site that ships visitor
> IP addresses to Google Fonts is a GDPR problem the old site did not have. The mockup links the
> CDN copies only because it has to run as a single file. Fallback stack is declared either way.

### Spacing and shape

4 px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`. Radius `8` on controls, `12` on cards, `18` on
sheets. Every tappable target is at least 44 px tall — the steppers, the day tabs and the slot rows
are all sized to it, because this page is used one-handed on a tram.

Border, fill, radius and shadow are spent by role, not stamped on everything: dish lists are one
card with hairline-separated rows, the day's order is a card, the price breakdown is a dashed rule
rather than another box, and only sheets get a real shadow.

### Layout

**Mobile (375).** One column. Sticky masthead, sticky day rail under it, then — in this order —
alerts, the day's order, the menu sections, the allergen notice. A sticky bottom bar carries the
running total and the only way forward; tapping **Részletek** expands the full per-day breakdown
in place. The composer and every chooser are bottom sheets.

**Desktop (1280).** The same components in a two-column grid: menu on the left (max 760 px), a
sticky 372 px rail on the right holding the day's order and the summary. Alerts span both columns.
The composer becomes a centred dialog. Checkout and success collapse back to one centred column —
a form does not want a sidebar.

The mockup uses **container queries**, so each device frame responds to its own width. O6 should
use ordinary media queries; the breakpoint is 900 px.

## Component inventory

What O6/O7 need to build, in the order they appear:

| Component | Notes |
|---|---|
| `Masthead` | logo, intake window, tap-to-call number |
| `WeekBar` | week number pill, date range, cutoff sentence |
| `DayRail` | six tabs; disabled for past days and holidays; cart-count badge; horizontally scrollable |
| `Banner` | info / warn / danger / ok; title, body, optional list, optional action |
| `DishList` + `Dish` | name, description, price (with the Saturday price when it differs), allergen codes, tags (`Elfogyott`, `Választható`, `Körettel`), "Összeállítom" |
| `AllergenNotice` + `AllergenSheet` | the notice text and the numbered list of 14 |
| `DayCart` | composed menus with recipient, per-line breakdown, adjustments, edit/remove, food subtotal |
| `ExtrasRow` | name, unit price, stepper, line total |
| `ComposerSheet` | recipient field, five slot rows, live price box, add button with the price in it |
| `SlotPicker` | grouped radio list, "Nem kérek" first, sold-out disabled |
| `VariationPicker` | same list, no "Nem kérek" — a variation is required |
| `PriceBox` | item lines, adjustment lines with their reason, dashed rule, total |
| `Totals` | per day: food, delivery fee, minimum warning; then the grand total |
| `SummaryBar` | sticky bar on mobile, card in the rail on desktop; collapsed/expanded; blocker state |
| `CheckoutForm` | five fields, inline errors, error summary, submitting state |
| `OrderRecap` | per-day card used on checkout and success |
| `SuccessScreen` | per-day cards with their own order id, grand total, e-mail confirmation line |
| `MessageScreen` | standalone message with contact details (week not published, empty week) |

## The states in the mockup

Scope 2a–2h of the issue, one entry each. All 17 exist at both widths.

| State | Scope | What it shows |
|---|---|---|
| Menü — üres kosár | 2a | past days disabled, soups at 0, sold-out dish, allergen notice |
| Menü — kosárral | 2a, 2c | three menus with names, both price adjustments, day badges |
| Allergén tájékoztató | 2a | the 14-item list |
| Összeállító — kötelező mezők | 2b | missing variation and missing side, add disabled |
| Fogásválasztó — főétel | 2b | grouped options, sold-out disabled |
| Összeállító — kész menü | 2b | full price breakdown with the soup surcharge explained |
| Összegzés kibontva | 2d | per-day subtotals, delivery fee line, grand total |
| Minimum alatt | 2d | warning per day, "Tovább" blocked |
| Pénztár | 2e | five fields, recap, totals |
| Pénztár — mezőhibák | 2e | summary banner and inline errors |
| Beküldés folyamatban | 2e | double-submit protection |
| Sikeres rendelés | 2f | per-day ids, totals, confirmation e-mail line |
| A beküldés nem sikerült | 2g | cart kept, retry, phone number |
| Közben lejárt a határidő | 2g | day removed from the rail and from the cart |
| Beküldéskor elfogyott | 2g | which day, whose menu, which dish |
| Jövő heti menü nincs feltöltve | 2h | message screen, no day rail |
| Üres / zárt hét | 2h | day rail with every day marked "Zárva" |

## Decisions taken in this mockup

These follow from PLAN.md but are not spelled out there, so they are design calls Dávid should
confirm or reject:

1. **The minimum is shown per day, not per submission.** PLAN.md says "minimum 2 200 Ft per order",
   and one order is one delivery day — so a two-day submission must clear 2 200 Ft on *each* day.
   The summary therefore warns per day and names the day.
2. **The composer is entered from a main course, not from a blank form.** The dominant action is
   "today's main, add, done"; a blank composer is one extra decision at 07:40. "Menü összeállítása"
   is still there for anyone who starts from the soup.
3. **The recipient name lives at the top of the composer, not in a separate "group ordering" mode.**
   The measurement in STACK.md §3 says 88 % of shared e-mail addresses are office orders — group
   ordering is the normal case, not an advanced feature.
4. **The soup surcharge is explained where it happens.** "+650 Ft leves felár" carries a one-line
   reason under it. In the old system this was the single most confusing price, and it was charged
   at 450 while the site advertised 650.
5. **Extras live inside the day's order, not in a separate step.** They are per day and per order,
   and they only make sense once something has been ordered.
6. **No payment section at all** — one sentence at the bottom of checkout says the courier is paid
   on delivery. Adding a payment block would imply a choice that does not exist.
7. **Pickup is not drawn.** `pickupEnabled` is false for Piccolo; drawing an unreachable branch
   would invite it into O6.

## Follow-ups this mockup suggests

Not in scope for #30 — listed so they are not lost:

- **`RestaurantConfig` has no restaurant identity fields.** The masthead, the footer and three
  error messages need phone, address, opening hours and the intake window. They are hard-coded in
  the mockup. Recommend adding a `contact: { phone, address, openingHours, intakeWindow }` branch
  before O5.
- **`config.messages` needs a second entry** for the empty/unpublished *current* week
  (`emptyWeek`); PLAN.md §3 only lists `nextWeekNotPublished`.
- **Prices inside sentences** (2 200 / 150 / 650 Ft) must be interpolated from `config.pricing` —
  see strings.md, note 3.
- **Sold-out items are hidden from nothing.** A guest can still open a sold-out dish's row and read
  it; only the action is removed. If the restaurant would rather hide them entirely, say so now.
