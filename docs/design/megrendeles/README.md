# `/megrendeles` — design note

The mockup for the public ordering page, produced for [issue #30](https://github.com/landorid/piccoloetterem.hu/issues/30) (O2).
Issues O5–O7 build to it; the copy is handed over separately in [strings.md](strings.md).

| | |
|---|---|
| The mockup | [`mockup.html`](mockup.html) — open it in a browser, no build step, no dependencies |
| Same thing, hosted | <https://claude.ai/code/artifact/b06bba8f-12ec-4236-8597-5f81521ab695> — for reviewing on a phone, which is the point |
| The copy | [`strings.md`](strings.md) — paste-ready `strings.ts` |
| One-screen overview | [`overview.png`](overview.png) — all 21 states at mobile width |

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
smallest text that carries meaning is 13, and 12 is reserved for badges and the collapsed allergen
chip. Every
column of digits carries `font-variant-numeric: tabular-nums`.

> **Production note.** Both faces must be **self-hosted** in the Astro build (`latin-ext` subset —
> Hungarian needs ő and ű), not loaded from Google's CDN: an EU restaurant site that ships visitor
> IP addresses to Google Fonts is a GDPR problem the old site did not have. The mockup links the
> CDN copies only because it has to run as a single file. Fallback stack is declared either way.

### Spacing and shape

4 px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`. Radius `8` on controls, `12` on cards, `18` on
sheets. Every tappable target is at least 44 px tall — the steppers, the day tabs and the choice rows
are all sized to it, because this page is used one-handed on a tram.

Border, fill, radius and shadow are spent by role, not stamped on everything: dish lists are one
card with hairline-separated rows, the day's order is a card, the price breakdown is a dashed rule
rather than another box, and only sheets get a real shadow.

### Layout

**Mobile (375).** One column. Sticky masthead, sticky day rail under it, then — in this order —
alerts, **the composer form**, the day's order, the category chips, the menu sections, the allergen
notice. A sticky bottom bar carries the running total and the only way forward; tapping
**Részletek** expands the full per-day breakdown in place. Only the main-course chooser is a bottom
sheet; every other choice is open on the page.

**Desktop (1280).** A two-column grid: the composer form and the menu sections in the left column
(max 760 px), a sticky 372 px rail on the right spanning both rows with the day's order and the
summary. Alerts span both columns. Choice rows lay out three across once the column is wide enough,
so the form stays short. Checkout splits the same way — form left, order right; success stays one
centred column.

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
| `ChipRail` | sticky category chips that jump to a section |
| `DishList` + `Dish` | tile, name, description, price (with the Saturday price when it differs), allergen chips, tags (`Elfogyott`, `Választható`, `Körettel`); the whole row is the tap target |
| `RailCard` | the same item as a card in a horizontal rail: tile, price above name |
| `Tile` | the leading 48px square — a photo where one exists, the dish's initial where none does, empty where the choice is not a dish ("Nem kérek") |
| `AllergenChip` + `AllergenTip` | a round tinted disc with a hand-drawn pictogram, one per EU allergen; hover, focus or tap names it in a bubble that gives the number too. Three chips per dish, then a `+N` chip that names the rest in its bubble. Used by `Dish`, `RailCard` and `SlotPicker` |
| `AllergenNotice` + `AllergenSheet` | the notice text and the numbered list of 14, each line carrying its pictogram next to the number |
| `DayCart` | composed menus, numbered, with per-line breakdown, adjustments, edit/remove, food subtotal; then the day's extras as priced lines with a link back to the extras section |
| `ExtrasSection` | the extras as a category of their own at the end of the offer list, with its own chip: a vertical list of `ExtrasRow`, heading and the per-day hint |
| `ExtrasRow` | name, unit price, stepper, line total — one row, two chromes: with the stepper in the offer list, as a priced line (`name × qty`) in the day's order |
| `ComposerForm` | **the primary screen, not a modal.** An empty form for the next menu: the main's row, then variation, soup, side, dessert, pickle and the Extra steppers, all open. Once the main is chosen its row shows the dish — tile, allergens, price. The head names which menu you are building; the foot carries the live price, the portions stepper, "Ürítés" and "Hozzáadás" |
| `CheckoutSummary` | the cart value, the per-day recap and the totals as one column beside the form |
| `ChoiceRows` | soup, variation and side: a stack of full-width rows — tile, name, the price effect under the name, and a mark on the right that fills with the accent and a ✓ when chosen |
| `SlotPicker` | the one remaining sheet: the main course, 11 dishes across three labelled groups, "Nem kérek" last, sold-out disabled |
| `PriceBox` | item lines, adjustment lines with their reason, dashed rule, total |
| `Totals` | per day: food, delivery fee, minimum warning; then the grand total |
| `SummaryBar` | sticky bar on mobile, card in the rail on desktop; collapsed/expanded; blocker state |
| `CheckoutForm` | five fields, inline errors, error summary, submitting state |
| `OrderRecap` | per-day card used on checkout and success |
| `SuccessScreen` | per-day cards with their own order id, grand total, e-mail confirmation line |
| `MessageScreen` | standalone message with contact details (week not published, empty week) |

## The states in the mockup

Scope 2a–2h of the issue, one entry each. All 21 exist at both widths.

| State | Scope | What it shows |
|---|---|---|
| Az első képernyő — üres űrlap | 2a, 2b | the empty form for menu 1, the catalogue below it, past days disabled |
| Menü — kosárral | 2a, 2c | three menus with names, both price adjustments, day badges |
| Extrák saját kategóriában | 2a, 2d | the extras section with two non-zero quantities, a day that holds extras and no menu, the minimum warning |
| Allergén — ikon és buborék | 2a | a bubble open on a milk chip, and the lasagne's `+2` |
| Allergén tájékoztató | 2a | the 14-item list, each with its pictogram |
| Űrlap — kötelező mezők | 2b | missing variation and missing side, add disabled |
| Fogásválasztó — főétel | 2b | grouped options, sold-out disabled |
| Űrlap — kész menü | 2b | full price breakdown with the soup surcharge explained |
| Űrlap — több adag | 2b | one composition, three cart rows |
| Összeállító — csak leves | 2b | a soup in the soup slot, no main, the +650 Ft surcharge explained |
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

## What we took from market.gasty.io

Dávid pointed at [Lucifer 2 Pizzéria on Gasty](https://market.gasty.io/delivery/lucifer_2_pizzeria/splash)
as a flow he likes. It is a per-item marketplace, not a weekly menu, so what transfers is the
*item-level* craft. What we took, and where it lands:

| Taken | Where it lands here |
|---|---|
| **The item sheet's anatomy** — uppercase category eyebrow, big title, description, allergens, choices, sticky action bar | The composer sheet. It was already close; now the order and the emphasis match. |
| **Choices as full-width selection rows** — tile, name, price under the name, a mark on the right that fills with the accent and a ✓ when chosen | Replaces the nested picker for **soup, variation and side**. One tap instead of two, and every option's price effect is visible before you choose. The single biggest improvement of this revision — see "Which slots are rows" below. |
| **A footer with the live price left and the action right** | The composer footer. The old full-width button hid the price inside its own label. |
| **A quantity stepper on the item** | "3 adag" on the composer: three colleagues, one composition, three cart rows — see decision 8. |
| **A leading square tile on every row**, with a quiet placeholder when there is no photo | `Tile`. Piccolo has no photos (PLAN.md §2), so the tile carries the dish's initial. If photos ever arrive the tile takes them and nothing else moves. |
| **The whole row as the tap target** | The "Összeállítom" button is gone: fewer things on the row, a much bigger target. |
| **Horizontal rails for secondary sections** | Kiemelt ajánlat, Egész héten rendelhető, Feláras köretek, Savanyúságok, Desszertek. |
| **A sticky category chip row** | Jump to a section without scrolling past the whole day. |
| **The delivery fee stated in the header** — their "Mindössze 190 Ft kényelmi díj" | `order.terms`, under the week label. Ours was buried in the footer and the summary. |
| **A closed-state banner that names the next opening** | We already had this for the cutoff; their version confirmed it earns the space. |
| **Allergens as pictogram chips, not bare numbers** | `AllergenChip`. Dávid's fourth request from that reference. Fourteen glyphs drawn by hand in the mockup file; the name arrives on hover, on focus and on tap — see decision 10. We took the *pictogram*, not their per-allergen hues. |

What we deliberately did **not** take:

- **The splash screen.** A welcome interstitial between a regular and their 07:40 order is a tax.
  A single restaurant reached by people who already know it does not need to introduce itself.
- **Horizontal rails for the daily soups and mains.** Gasty has eight categories of many items; we
  have two soups and four or five mains. Hiding today's mains behind a swipe is exactly the wrong
  trade. Rails are for the repeat-every-week sections only.
- **Photo-first cards.** Without photos a photo-shaped layout is mostly grey. We kept the card
  *shape* and the tile, not the photo-driven hierarchy — so price and name still lead.
- **Their yellow accent.** Piccolo's brown is the brand. We took their *selected-state* treatment
  (accent border, accent tint, filled disc with a ✓), not their hue.
- **The per-item note field.** Our domain has one note per order, and there is nothing else the
  composer needs free text for.

### Which slots are rows, and why

| Slot | Options | Treatment |
|---|---|---|
| Leves | 2 + "Nem kérek" | **choice rows** — and the row carries the adjustment, so "Nem kérek −100 Ft" and "Húsleves +650 Ft" are visible *before* the tap. This is the price the old system hid until afterwards, and undercharged by 200 Ft when it finally showed it. |
| Főétel | 11, across three categories | **its own row + picker** — too many to inline. The row has two faces: a prompt before it is answered, and the dish itself afterwards, with its tile, allergens and price, the way every chosen course is shown. It keeps a chevron because it is the only row that still opens a picker. |
| Változat | 2–3 | **choice rows**, without tiles — a variation is a property of the main course above it, not a dish of its own, and `Csirkemell` / `Csirkecomb` would both draw a `C`. |
| Köret | 7 | **choice rows** — it is the only required slot and the usual reason the add button is disabled, so it should be satisfiable without leaving the sheet. |
| Savanyúság, Desszert | 3 + "Nem kérek" each | **choice rows**, open on the page like the rest. Neither carries a default, so each has to be answered — see the forced-choice note below. |

A required block is labelled `KÖRET · KÖTELEZŐ` in red: the requirement is a word, not only a colour.

**All seven side options stack; the block does not scroll on its own.** The sheet body already
scrolls, and a scroller nested inside it is the gesture people lose on a phone — you swipe to reach
the price box and move the side list instead. It would also hide exactly the options that are the
usual reason the add button is disabled. The cost is an honest one: the composer is a long sheet,
and on a main course with a variation the chosen side can start below the fold. The price box at
the bottom still names everything chosen, so nothing is hidden, only scrolled to.

**The picker uses the same row, joined into a list.** One anatomy for choosing a dish, two chromes:
separated hairline cards inline in the composer (a small set of alternatives), one card of joined
rows in the main-course picker (11 items in three labelled groups, each with a description and
allergen codes). Separating those eleven into eleven cards would cost a border and a gap per item
and break the group structure that makes the list scannable.

## Decisions taken in this mockup

These follow from PLAN.md but are not spelled out there, so they are design calls Dávid should
confirm or reject:

1. **The minimum is shown per day, not per submission.** PLAN.md says "minimum 2 200 Ft per order",
   and one order is one delivery day — so a two-day submission must clear 2 200 Ft on *each* day.
   The summary therefore warns per day and names the day.
2. **The composer is entered from a main course, not from a blank form.** The dominant action is
   "today's main, add, done"; a blank composer is one extra decision at 07:40. "Menü összeállítása"
   is still there for anyone who starts from the soup.
3. **A menu belongs to no one — menus are numbered, not named.** Several menus a day is still the
   normal case (STACK.md §3: 88 % of shared e-mail addresses are office orders), but the person a
   menu is *for* is not something this page collects. Dávid decided this on 2026-09-07, and it
   changes PLAN.md §2 ("each with an optional `recipient_name`") and §3
   (`order_menus.recipient_name`) — see the follow-ups below.
4. **The soup surcharge is explained where it happens.** "+650 Ft leves felár" carries a one-line
   reason under it. In the old system this was the single most confusing price, and it was charged
   at 450 while the site advertised 650.
5. **Extras are a category of the offer, and the day's order is where you check them.** They were
   originally only a stepper block inside the day's order, on the argument that they only make sense
   once something has been ordered. Dávid asked for ketchup, tartar sauce and bread to be addable
   *from their own category*, the way a dish is — and he is right: the block was invisible while you
   browsed, and unreachable on a day that had no menu yet. They now have a section at the end of the
   offer list and a chip of their own. Three things follow.
   **(a) A vertical list, not a rail.** The repeat-every-week sections are rails, but a rail card is
   150 px wide and is itself the tap target; an extras row carries two 44 px buttons, a unit price
   and a line total, and cannot be a rail card without shrinking one of them. Three rows also make a
   very short rail.
   **(b) Last in the order.** Bread, sauce and a takeaway box are what you add on the way out. Before
   the daily mains they would compete with the reason the page exists; the chip makes "last" cost one
   tap from anywhere.
   **(c) One stepper per value.** The day's order keeps the extras, but as *priced lines* with a link
   back to the section — the same treatment a composed menu already gets there, a receipt with an
   edit route, not a second form. On desktop the rail and the offer list are on screen together, and
   two live steppers writing one number read as two features.
   The known cost: a day that holds only extras gets no badge on its day tab, because the badge
   counts menus. The sticky summary still counts the day and warns that it is under the minimum, so
   nothing is hidden — but if O6 wants the tab to mark it too, that is a badge variant, not a rule.
6. **No payment section at all** — one sentence at the bottom of checkout says the courier is paid
   on delivery. Adding a payment block would imply a choice that does not exist.
7. **Pickup is not drawn.** `pickupEnabled` is false for Piccolo; drawing an unreachable branch
   would invite it into O6.
8. **The portions stepper creates N menus, not one menu with a quantity.** `order_menus` has no
   quantity column and should not get one: three of the same lunch is three rows, which is what the
   kitchen summary counts and what the delivery list carries. A "×3" on a single row is one glance
   away from being read as one. The stepper is a shortcut for composing the same thing three times,
   nothing more.
9. **A soup on its own is possible, but not advertised.** PLAN.md §2 already prices a soup without a
   main at 650 Ft, and the composer already accepted a menu with only a soup — the menu simply had no
   way to start one, so the empty cart's "or compose a menu with a soup" was a promise the page could
   not keep. Tapping a soup row now opens the same composer with the *soup* slot filled instead of the
   main one. That is the whole change: one small mapping from the item's category to the slot it
   belongs in (`slotOfItem`), not a second flow, and no new domain rule. It deliberately gets no
   button and no second call-to-action next to the mains — these are people ordering lunch, the soup
   is normally part of a menu, and a lone soup should be reachable, not loud. What it does get is the
   price, twice: the section hint states it before the tap, and the composer's price box carries the
   `+650 Ft` line with its reason the moment the soup stands alone. The soup row keeps its
   `0 Ft · A menü ára tartalmazza`, because that price is a property of the *menu*, not of the soup;
   the hint directly above the rows names the other case.
10. **Allergens are pictograms in one tint, and the number moved into the bubble.** Dávid asked for
    Gasty's icon chips. Three calls follow from taking them.
    **(a) One tint, not fourteen.** The reference gives each allergen its own hue. Here the glyph
    already does the distinguishing — that is the whole reason to draw one — so a second encoding
    buys nothing and costs a lot: fourteen tints, each needing its own 4.5:1 pairing, in a palette
    whose rule is that the brown is the only saturated colour on the page, and all of it on the same
    line as the red `Elfogyott` tag and the `Választható` tags. Warning colours were the other
    temptation and are worse: most dishes carry an allergen, so a row of red discs on every dish is
    crying wolf. The chips are `--brand-700` on `--brand-100`, the tint the page already spends on
    quiet informational marks.
    **(b) The number is in the bubble and in the sheet, not on the disc.** A 28 px disc holds a
    glyph or two digits, not both legibly. A guest with a real allergy scans for the shape, not for
    "7"; the number exists only to tie the row back to the numbered legend, which is exactly what
    the bubble (`7 · Tej és tejtermék (laktóz)`) and the sheet do. The sheet now carries the
    pictogram beside each number, so the two representations teach each other.
    **(c) Three chips, then `+N`.** Three is the widest ordinary dish in the fixture, and three
    discs are what a 150 px rail card holds on one line. Beyond that the rest collapse into one
    `+N` chip that names them in its own bubble — the lasagne is given five so the guard is visible
    somewhere.
    Two honest costs. The bubble opens on hover, on focus **and on tap**, because touch has no
    hover — so a tap on a chip shows the name instead of opening the composer, on a 28 px disc
    inside a 72 px row. Its hit area is 32 × 44 px, the 44 taken vertically with a negative margin
    so that no row grows. And the chip is a `span` with `role="button"`, not a real `<button>`:
    every place it appears — the dish row, the rail card, the picker row — is *itself* a button, and
    a nested `<button>` is markup the HTML parser rewrites, which tears the row apart. **For O6 this
    is the one thing to build differently**: make the row a container with a stretched action button
    so the chips can be real sibling buttons. The design does not change; the markup does.

### The order flow, end to end

1. The page opens on **an empty form for menu 1**, under the day tabs. No browsing, no modal.
2. Fill it top down: main (a row that opens the one remaining sheet), then variation and side if
   that dish needs them, then soup, dessert, pickle and the Extra steppers — all open on the page. The
   soup rows carry the adjustment they would cause, so the −100 / +650 is visible before the tap.
3. Or scroll to the catalogue below and tap a dish there: it drops into the form and the page
   scrolls back to it. Two ways in, one place where a menu is built.
4. **Hozzáadás** commits the composition to the active day — N copies if the portions stepper says
   N, with the Extra quantities scaled by the same N. The form empties and its head now reads
   "2. menü összeállítása".
5. The day's order fills in beside the form (above it on a phone); "Módosítás" pulls a menu back
   into the form, where it was built.
6. **Tovább a rendeléshez** → checkout: the form on the left, the whole order beside it on the right.

11. **The composer is the screen, not a modal.** Revised 2026-09-07. Dávid tried the
    browse → tap → modal → step → step route and said it had become harder than the old site, which
    opens on a form you simply fill in. It had. The page now opens on an empty form for menu 1 —
    the same content the modal held — with the catalogue below it as a second way in. The two-step
    split went with the modal: it existed to keep a sheet short, and a page has no such limit, so
    the "Tovább" was a tap everyone paid for nothing. The form is long on a phone, and that is the
    deliberate trade: everything visible with nothing to discover beats a short screen you have to
    travel through. The main course keeps its sheet — 11 dishes across three categories do not
    belong inline, and the catalogue below already lists them all.
12. **The sauces and bread are offered inside the form but land on the day.** They are `order_extras`
    rows with a quantity, not menu slots, so the form holds them until "Hozzáadás" and then merges
    them into the active day, multiplied by the portions count — three identical lunches want three
    breads. The box is not offered here: it is packaging, it belongs to the day, and it already has
    its own row in the extras category. **Watch this in O6:** those same two extras can also be
    changed from the extras category below, so two controls write one number. They agree, because
    they write the same state — but if it grates, the form's copies are the ones to drop.
13. **Checkout puts the form and the order side by side, with the rail on the right.** The reference
    image has the summary on the left; ours stays on the right because that is where this design's
    rail already lives on the menu screen, and a sidebar that changes sides between screens costs
    more than it gains. On a phone the order flips: the **form comes first** and the recap follows,
    because filling it in is the job of that screen and the reference's arrangement is a tablet
    layout. One line of CSS moves the rail to the left if Dávid prefers the reference exactly.

14. **Nothing is pre-selected, and "Nem kérek" is the last option.** Dávid's call, 2026-09-07.
    Soup, dessert and pickle each open unanswered; the guest picks a dish *or* picks "Nem kérek",
    and until every one is settled the block's label reads `· válassz` in red and "Hozzáadás" is
    disabled. Three things follow.
    **(a) Why it is likely to lift the order.** A pre-checked "Nem kérek" sitting first is a default
    nobody reads — it answers the question before it is asked, and the eye moves on. Removing it
    forces the options into view once per menu. The strongest case is the **soup**: beside a daily
    main it is included, and declining it only takes 100 Ft off, so a guest who skipped past a
    pre-checked "Nem kérek" was leaving a nearly free course on the table. Dessert (590–690 Ft) and
    pickle (250 Ft) are straight upsell, and that is where the revenue would come from.
    **(b) What it costs.** Three taps per menu that nobody paid before, on a page whose users are
    regulars ordering the same lunch inside a two-hour window. Forced choice hurts habitual repeat
    users most, which is exactly this audience. The number to watch is not attach rate on its own
    but attach rate *against* completed orders per week — analytics is on the backlog.
    **(c) The cheaper half, if it turns out to hurt.** Keep the forced answer on the soup, where a
    real price consequence hangs on it, and let dessert and pickle open unanswered without blocking.
    That keeps the attention effect and gives back two of the three taps. It is one line: drop those
    two slots from the `unanswered:` check in `priceMenu`.
15. **The main course prompts "Válassz", not "Nem kérek".** The row is not offering to decline a
    main; it is asking for one. A menu without a main is still valid — the soup-only case in
    decision 9 — but that is reached by choosing a soup, not by declining the main.

## Follow-ups this mockup suggests

Not in scope for #30 — listed so they are not lost:

- **A menu no longer carries a recipient name, and PLAN.md still says it does.** Dávid decided on
  2026-09-07 that a composed menu belongs to no one. That contradicts PLAN.md §2 ("Group ordering:
  several composed menus per day, each with an optional `recipient_name`") and §3
  (`order_menus.recipient_name`). Downstream: **#18 / F3** should not create the column,
  **#31 / O3** should not accept it, and **#36–#38 / S1–S3** lose the per-person split in the
  kitchen summary and the delivery list — those now identify a menu by its number within the day.
  Tracked in [#56](https://github.com/landorid/piccoloetterem.hu/issues/56); this mockup is already built without the name.
- **`RestaurantConfig` has no restaurant identity fields.** The masthead, the footer and three
  error messages need phone, address, opening hours and the intake window. They are hard-coded in
  the mockup. Recommend adding a `contact: { phone, address, openingHours, intakeWindow }` branch
  before O5.
- **`config.messages` needs a second entry** for the empty/unpublished *current* week
  (`emptyWeek`); PLAN.md §3 only lists `nextWeekNotPublished`.
- **Prices inside sentences** (2 200 / 150 / 650 Ft) must be interpolated from `config.pricing` —
  see strings.md, note 3.
- **Ketchup and tartar sauce are now two extras — their prices still need confirming.** Dávid
  settled this on 2026-09-07: they are separate products, not one line. The mockup carries
  `ketchup` and `tartar` as two `RestaurantConfig.extras` entries, **each at the 400 Ft the combined
  entry charged**, because that is the only figure we have. Two things follow. **(a)** Whether a
  sauce really costs 400 Ft each once they are sold separately is a question for the restaurant —
  it belongs to **issue #41**, where the config values are confirmed. **(b)** PLAN.md §2 still
  enumerates the old list ("box 100, bread 50, ketchup/tartar 400"); the *rule* it states is
  unchanged — extras are per day, with a quantity, counted in the food subtotal — only the
  parenthetical is stale, and #41 rewrites it anyway.
- **Sold-out items are hidden from nothing.** A guest can still open a sold-out dish's row and read
  it; only the action is removed. If the restaurant would rather hide them entirely, say so now.
