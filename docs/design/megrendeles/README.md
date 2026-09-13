# `/megrendeles` — design note

The mockup for the public ordering page, produced for [issue #30](https://github.com/landorid/piccoloetterem.hu/issues/30) (O2).
Issues O5–O7 build to it; the copy is handed over separately in [strings.md](strings.md).

| | |
|---|---|
| The mockup | [`mockup.html`](mockup.html) — open it in a browser, no build step, no dependencies |
| Same thing, hosted | <https://claude.ai/code/artifact/b06bba8f-12ec-4236-8597-5f81521ab695> — for reviewing on a phone, which is the point |
| The copy | [`strings.md`](strings.md) — paste-ready `strings.ts` |
| One-screen overview | [`overview.png`](overview.png) — all 19 states at mobile width |

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
| `--brand-50` | `#faf4ec` | option group headers, sheet close button |
| `--ink-900` | `#211c16` | body text |
| `--ink-700` | `#4b4239` | descriptions, secondary body |
| `--ink-500` | `#7b7065` | labels, help text, placeholders, sold-out rows (4.8:1) |
| `--ink-400` | `#8a7f72` | chevrons and disabled controls **only** — decorative, below 4.5:1 by intent |
| `--line` / `--line-strong` | `#e8dfd2` / `#d6c8b4` | hairlines / input borders, dashed totals rule |
| `--paper` / `--ground` | `#ffffff` / `#faf6f0` | cards / page |

Semantic colour is separate from the accent and never decorative:
`--ok-700 #2c6e4a` on `--ok-100 #e3f1e8` (success), `--warn-700 #8a5300` on `--warn-100 #fdf0dc`
(minimum not reached on checkout, cutoff passed), `--danger-700 #a3251d` on `--danger-100 #fbe8e5` (sold out,
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

**Mobile (375).** One column. Sticky masthead; the day strip under it scrolls away with the page; then — in this order —
alerts, **the composer form**, which runs edge to edge with no card border, the day's order. A sticky bottom bar carries the running total and the only way forward; tapping
**Részletek** expands the full per-day breakdown in place. Only the main-course chooser is a bottom
sheet; every other choice is open on the page.

**Desktop (1280).** A two-column grid: the composer form in the left column
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
| `DayRail` | the week strip, built like the iOS calendar header: weekday caps, the date in a circle, a mark below. Six equal columns fill the width — no horizontal scrolling. Filled brand circle for the selected day, ink circle when that day is closed, cart-count badge or `ZÁRVA` in the mark slot |
| `Banner` | info / warn / danger / ok; title, body, optional list, optional action |
| `Tile` | the leading 48px square on side, pickle, dessert and Extra rows — the item's initial, empty for "Nem kérek". Soups, the main-course row and the main-course picker carry no tile (Dávid, 2026-09-13) |
| `AllergenChip` + `AllergenTip` | a round tinted disc with a hand-drawn pictogram, one per EU allergen; hover, focus or tap names it in a bubble that gives the number too. Three chips per dish, then a `+N` chip that names the rest in its bubble. Used by `ChoiceRows`, the main-course row and `SlotPicker` |
| `DayCart` | composed menus, numbered, with per-line breakdown, adjustments, edit/remove; the day's extras as plain priced lines, no heading and no stepper; food subtotal |
| `ExtrasRow` | a priced line (`name × qty`, line total) in the day's order; the steppers live in the form's Extra block |
| `ComposerForm` | **the primary screen, not a modal.** An empty form for the next menu, in course order: soup, main, its variation and side, then pickle, dessert and the Extra steppers, all open. Once the main is chosen its row shows the dish — name, allergens, price. The head names which menu you are building; the foot carries the live price, "Ürítés" and "Hozzáadás" |
| `CheckoutSummary` | the cart value, the per-day recap and the totals as one column beside the form |
| `ChoiceRows` | soup, variation, side, pickle and dessert: a stack of full-width rows — tile (none on soup and variation rows), name, the price effect and the dish's allergen chips under the name, and a mark on the right that fills with the accent and a ✓ when chosen |
| `SlotPicker` | the one remaining sheet: the main course, 11 dishes across three labelled groups, "Nem kérek" last, sold-out disabled |
| `PriceBox` | item lines, adjustment lines with their reason, dashed rule, total |
| `Totals` | per day: food and delivery fee; then the grand total |
| `SummaryBar` | sticky bar on mobile, card in the rail on desktop; collapsed/expanded; never blocked by the minimum |
| `CheckoutForm` | five fields, inline errors, error summary, submitting state, and the minimum notice naming each day under 2 200 Ft with its difference |
| `OrderRecap` | per-day card used on checkout and success |
| `SuccessScreen` | per-day cards with their own order id, grand total, e-mail confirmation line |
| `MessageScreen` | standalone message with contact details (week not published, empty week) |

## The states in the mockup

Scope 2a–2h of the issue, one entry each. All 19 exist at both widths.

| State | Scope | What it shows |
|---|---|---|
| Az első képernyő — üres űrlap | 2a, 2b | the empty form for menu 1, past days disabled |
| Menü — kosárral | 2a, 2c | three numbered menus, both price adjustments, day badges |
| Extrák a nap rendelésében | 2c | the day's extras as plain lines under the menu; box, bread and sauces are steppers in the form |
| Allergén — ikon és buborék | 2a | a bubble open on a milk chip in the main-course row |
| Űrlap — kötelező mezők | 2b | missing variation and missing side, add disabled |
| Fogásválasztó — főétel | 2b | grouped options, sold-out disabled |
| Űrlap — kész menü | 2b | full price breakdown with the soup surcharge explained |
| Összeállító — csak leves | 2b | a soup in the soup slot, no main, the +650 Ft surcharge explained |
| Összegzés kibontva | 2d | per-day subtotals, delivery fee line, grand total |
| Minimum alatt — pénztár | 2d, 2e | nothing blocks; checkout names each day under the minimum and the difference paid on delivery |
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
| **A leading square tile on every row**, with a quiet placeholder when there is no photo | `Tile`, except on soup and main-course rows, which Dávid wanted without an avatar (2026-09-13). Piccolo has no photos (PLAN.md §2), so the tile carries the item's initial. |
| **The whole row as the tap target** | The "Összeállítom" button is gone: fewer things on the row, a much bigger target. |
| **Horizontal rails for secondary sections** | Kiemelt ajánlat, Egész héten rendelhető, Feláras köretek, Savanyúságok, Desszertek. |
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
| Leves | 2 + "Nem kérek" | **choice rows, first in the form** — and the row carries the adjustment, so "Nem kérek −100 Ft" and "Húsleves +650 Ft" are visible *before* the tap. This is the price the old system hid until afterwards, and undercharged by 200 Ft when it finally showed it. |
| Főétel | 11, across three categories | **its own row + picker** — too many to inline. The row has two faces: a prompt before it is answered, and afterwards the dish itself, drawn exactly like any other chosen course — same border, tint and filled check. Only the prompt carries a chevron, since that is where it helps: this is the one row that opens a picker. |
| Változat | 2–3 | **choice rows**, without tiles — a variation is a property of the main course above it, not a dish of its own, and `Csirkemell` / `Csirkecomb` would both draw a `C`. |
| Köret | 7 | **choice rows** — it is the only required slot and the usual reason the add button is disabled, so it should be satisfiable without leaving the sheet. |
| Savanyúság, Desszert | 3 + "Nem kérek" each | **choice rows**, open on the page like the rest, **starting on "Nem kérek"** — see decision 14. |

A required block is labelled `KÖRET · KÖTELEZŐ` in red: the requirement is a word, not only a colour.

### The soup comes first, and carries no price until a main decides it

The form follows course order — soup, main, its variation and side, pickle, dessert — which is how a
Hungarian menu reads and how the old form was laid out. That ordering has one hazard, and the soup
block is built around it: **the soup's price depends on the main.** Beside a daily main it is
included; beside an all-week dish, or on its own, it is 650 Ft.

Put the soup first and the naive rendering shows `+650 Ft` on every soup at the exact moment the
guest has no main yet and so no way to improve it. That is the worst case presented as the price,
and it is a good way to talk someone out of a soup that would have been free. So until a main is
chosen the soup rows carry **no amount at all** — there is no honest number to print yet, and the
block hint says the part that is true regardless (`A napi főételek ára tartalmazza a levest`). Pick a
main and the rows fill in with real figures: `0 Ft` beside a daily main, `−100 Ft` on "Nem kérek",
`+650 Ft` beside an all-week dish.

Two consequences worth knowing. A guest ordering **soup alone** does not see its 650 Ft until the
price box below totals it — acceptable, because the price box is on the same screen and itemises it.
And the soup is the one block whose rows can lack an amount, which is a deliberate asymmetry, not an
oversight: `choiceRows` omits the element entirely rather than rendering an empty one.

### The week strip does not scroll

Six days divide the width evenly, so every day is on screen at once — on a 320 px phone that is
still 53 px a column. The old strip was a flex row of 60 px minimum-width tabs with padding, which
came to roughly 530 px and pushed Saturday off the right edge. A strip you have to swipe hides the
very days you are deciding between, and a half-visible last day reads as a rendering fault rather
than an invitation to scroll.

It is **not sticky** (Dávid, 2026-09-13): only the masthead stays on screen, so a long form gets
the height back once the day is chosen.

The shape is the iOS calendar header: weekday letters in small caps, the date in a circle below, and
a mark under that. The circle replaces the old underline — it is the same "you are here" signal in
less vertical space, and it gives the closed state somewhere to live (ink circle instead of brand,
so a day you are looking at is marked without promising you can order on it). The mark slot is
always rendered, badge or not, so the circles sit on one baseline across the week. The date loses
its Hungarian trailing dot inside the circle, as it does in every calendar grid.

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
   Checkout therefore names each day under it, with its own difference — and since 2026-09-13
   that is a notice, not a block (decision 16).
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
5. **Extras are added in the form and listed in the day's order.** Revised three times on
   2026-09-13. They were a category of the offer list, then steppers in the day's order; Dávid then
   removed the extras section from the day's card. Now every extra, the box included, is a stepper
   in the form's Extra block and is added together with the menu. The day's card lists what the day
   holds as plain priced lines under the menus, with no heading and no stepper, because the food
   subtotal counts them. **Changing them happens in the form:** "Módosítás" pulls the menu back into
   the form together with the day's extras, and "Hozzáadás" merges them again. The cost: "Ürítés"
   during an edit drops those extras too. Removing the day's last menu drops the day with its
   extras, so no counted line stays hidden, and a day can never hold only extras.
6. **No payment section at all** — one sentence at the bottom of checkout says the courier is paid
   on delivery. Adding a payment block would imply a choice that does not exist.
7. **Pickup is not drawn.** `pickupEnabled` is false for Piccolo; drawing an unreachable branch
   would invite it into O6.
8. **No portions stepper.** Removed 2026-09-13 at Dávid's request. One composition adds one menu;
   three of the same lunch are composed three times. The model is unchanged either way:
   `order_menus` has no quantity column and should not get one, because three lunches are three
   rows — what the kitchen summary counts and the delivery list carries.
9. **A soup on its own is possible, but not advertised.** PLAN.md §2 prices a soup without a main at
   650 Ft, and the form accepts a menu with only a soup. It gets no button of its own — these are
   people ordering lunch, and a lone soup should be reachable, not loud. What it does get is the
   price: before a main is chosen the soup block quotes the rule, and the price box carries the
   `+650 Ft` line with its reason the moment the soup stands alone.
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
    **(b) The number is in the bubble, not on the disc.** A 28 px disc holds a
    glyph or two digits, not both legibly. A guest with a real allergy scans for the shape, not for
    "7"; the number is the EU list's numbering, and the bubble (`7 · Tej és tejtermék (laktóz)`) shows it with the name. The numbered list was removed on 2026-09-13 (decision 18).
    **(c) Three chips, then `+N`.** Three is the widest ordinary dish in the fixture, and three discs fit the narrowest row on one line. Beyond that the rest collapse into one
    `+N` chip that names them in its own bubble — the lasagne is given five so the guard is visible
    somewhere.
    Two honest costs. The bubble opens on hover, on focus **and on tap**, because touch has no
    hover — so a tap on a chip shows the name instead of selecting the row, on a 28 px disc
    inside a 72 px row. Its hit area is 32 × 44 px, the 44 taken vertically with a negative margin
    so that no row grows. And the chip is a `span` with `role="button"`, not a real `<button>`:
    every place it appears — a choice row, the main-course row, the picker row — is *itself* a button, and
    a nested `<button>` is markup the HTML parser rewrites, which tears the row apart. **For O6 this
    is the one thing to build differently**: make the row a container with a stretched action button
    so the chips can be real sibling buttons. The design does not change; the markup does.

### The order flow, end to end

1. The page opens on **an empty form for menu 1**, under the day tabs. No browsing, no modal.
2. Fill it top down, in course order: soup, then the main (a row that opens the one remaining
   sheet), its variation and side if that dish needs them, then pickle, dessert and the Extra
   steppers — all open on the page. Before a main is chosen the soup quotes a rule, not a price.
3. Every dish is in the form. The weekly menu as a browsable list is not on this page; it gets its
   own page (#58).
4. **Hozzáadás** commits the composition to the active day as one menu, and merges the Extra
   quantities into the day. The form empties and its head now reads
   "2. menü összeállítása".
5. The day's order fills in beside the form (above it on a phone); "Módosítás" pulls a menu back
   into the form, where it was built.
6. **Tovább a rendeléshez** → checkout: the form on the left, the whole order beside it on the right.
   If a day is under the 2 200 Ft minimum, checkout says so and names the difference; nothing blocks.

11. **The composer is the screen, not a modal.** Revised 2026-09-07. Dávid tried the
    browse → tap → modal → step → step route and said it had become harder than the old site, which
    opens on a form you simply fill in. It had. The page now opens on an empty form for menu 1 —
    the same content the modal held. The two-step
    split went with the modal: it existed to keep a sheet short, and a page has no such limit, so
    the "Tovább" was a tap everyone paid for nothing. The form is long on a phone, and that is the
    deliberate trade: everything visible with nothing to discover beats a short screen you have to
    travel through. The main course keeps its sheet — 11 dishes across three categories do not
    belong inline.
12. **The sauces and bread are offered inside the form but land on the day.** They are `order_extras`
    rows with a quantity, not menu slots, so the form holds them until "Hozzáadás" and then merges
    them into the active day. The box is offered here too since 2026-09-13: the form is the only place an extra is added or
    changed (decision 5).
13. **Checkout puts the form and the order side by side, with the rail on the right.** The reference
    image has the summary on the left; ours stays on the right because that is where this design's
    rail already lives on the menu screen, and a sidebar that changes sides between screens costs
    more than it gains. On a phone the order flips: the **form comes first** and the recap follows,
    because filling it in is the job of that screen and the reference's arrangement is a tablet
    layout. One line of CSS moves the rail to the left if Dávid prefers the reference exactly.

14. **Only the soup has to be answered; pickle and dessert start on "Nem kérek".** "Nem kérek"
    is the last option in every list.
    On 2026-09-07 Dávid asked for no default on soup, dessert and pickle alike, so each had to be
    answered before "Hozzáadás" enabled. On 2026-09-13 he reversed it for **pickle and dessert**:
    they now open with "Nem kérek" selected. The soup keeps the forced answer — its block reads
    `LEVES · VÁLASSZ` in red until settled, and the footer says `Válassz levest — a „Nem kérek” is
    válasz.`
    **Why the split is the right one.** The soup is the slot where an answer moves the price —
    included beside a daily main, −100 Ft if declined, +650 Ft beside an all-week dish — so a
    pre-checked answer there would decide money on the guest's behalf. Pickle (250 Ft) and dessert
    (590–690 Ft) are plain add-ons with no such interplay. Forcing them cost two taps per menu on a
    page used by regulars inside a two-hour window, which is the friction Dávid had already flagged.
    The trade: some upsell attention on dessert and pickle is given back. If analytics later shows
    attach rate on those two matters more than completion speed, it is one line to restore —
    add them back to the `unanswered:` check in `priceMenu` and drop their defaults in
    `composedMenu`.
15. **The main course prompts "Válassz", not "Nem kérek".** The row is not offering to decline a
    main; it is asking for one. A menu without a main is still valid — the soup-only case in
    decision 9 — but that is reached by choosing a soup, not by declining the main.

16. **The minimum warns on checkout and never blocks.** Decided by Dávid on 2026-09-13, revising
    PLAN.md §2 ("below it the submission is rejected"); tracked in
    [#57](https://github.com/landorid/piccoloetterem.hu/issues/57). The old site worked this way in
    practice: an advisory warning, the order accepted, the difference collected on delivery. Nothing
    on the order page mentions the minimum any more — the summary does not warn and "Tovább" is
    never disabled by it. Checkout shows one warning banner listing each day under 2 200 Ft with its
    difference. The totals do not change. Whether the difference becomes a priced line, what the
    courier's list shows and whether the e-mail repeats it are open questions in #57, not design
    calls.
17. **The weekly menu is not listed on this page.** Decided by Dávid on 2026-09-13; tracked in
    [#58](https://github.com/landorid/piccoloetterem.hu/issues/58), because PLAN.md §1 says "the
    weekly menu **is** the order page". The chip rail, the dish sections, the rails and the extras
    category are gone; the menu will have its own page. Nothing orderable is lost — every dish is in
    the form or the main-course picker. Two things moved so that nothing required went with the
    list. **Allergens:** distance selling must make allergen information available before the
    purchase (EU Regulation 1169/2011, Art. 14), and the list was where soups, sides, pickles and
    desserts showed theirs — so every choice row now carries its dish's allergen chips. **Extras:** see decision 5.
18. **No allergen notice, no allergen list, and no avatar on soups and mains.** Dávid, 2026-09-13.
    The notice paragraph and its "Allergének" link to the numbered list of 14 are gone. Every dish
    keeps its allergen chips, and tapping one names the allergen — that per-dish marking is what
    carries the allergen information before the purchase. The general cross-contamination warning was
    voluntary text; whether the restaurant wants it somewhere else, for example in the e-mail, is its
    call. `config.allergenNotice` (PLAN.md §3) has no reader on this page any more. Soup rows, the
    main-course row and the main-course picker also lose their tile, so the name leads.
19. **Quantities are set with − and + only.** Dávid, 2026-09-13. Wherever a count is chosen — today
    the Extra steppers in the form — there are two buttons and the number between them is plain text,
    never an input. No keyboard opens on a phone, nothing out of range can be typed, and the control
    reads the same everywhere. − is disabled at 0 and + at 20, the limit O1 and O3 already validate.
    The number is announced politely to screen readers when it changes. **At 0 the row shows only a
    round +**; the − and the number appear from 1, because on a 375 px phone a full stepper on every
    untouched extra squeezed the names. The buttons are 36 px wide with a 44 px tall tap area. **For
    O6:** do not build this as `<input type="number">` with buttons around it.

## Follow-ups this mockup suggests

Not in scope for #30 — listed so they are not lost:

- **A menu no longer carries a recipient name, and PLAN.md still says it does.** Dávid decided on
  2026-09-07 that a composed menu belongs to no one. That contradicts PLAN.md §2 ("Group ordering:
  several composed menus per day, each with an optional `recipient_name`") and §3
  (`order_menus.recipient_name`). Downstream: **#18 / F3** should not create the column,
  **#31 / O3** should not accept it, and **#36–#38 / S1–S3** lose the per-person split in the
  kitchen summary and the delivery list — those now identify a menu by its number within the day.
  Tracked in [#56](https://github.com/landorid/piccoloetterem.hu/issues/56); this mockup is already built without the name.
- **The minimum no longer blocks, and PLAN.md §2 still says it does.** Tracked in
  [#57](https://github.com/landorid/piccoloetterem.hu/issues/57), with three open questions: is the
  difference part of the order's price, does the courier's list show it, does the e-mail repeat it.
- **The weekly menu leaves `/megrendeles`, and PLAN.md §1 still says the menu *is* the order page.**
  Tracked in [#58](https://github.com/landorid/piccoloetterem.hu/issues/58), including whether the
  new menu page is in release 1 and what it changes in #33 / O5 and #34 / O6.
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
