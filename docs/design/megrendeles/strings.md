# `/megrendeles` — copy handover

Every Hungarian word that appears in [`mockup.html`](mockup.html) comes from one table. This file
is that table, generated from the mockup so the two cannot drift apart. **O5, O6 and O7 paste it
into `apps/web/src/strings.ts`** — nothing on the page is written inline (AGENTS.md).

Merge it with what is already in `strings.ts`: keep `siteName`, replace the `order` branch.

## Four things to decide while pasting

1. **Templated strings are functions.** `week.number(37)`, `success.lead(email)` and friends take a
   parameter. They stay in the strings file — that is where the sentence order and the Hungarian
   suffixes live; a component must never build a sentence from fragments.
2. **Some of these are configuration, not copy.** They are listed here because the mockup has to
   render *something*, but the real source is `RestaurantConfig` (PLAN.md §3), because the next
   restaurant will have different ones:
   | Key in this file | Real home |
   |---|---|
   | `allergens.notice` | `config.allergenNotice` |
   | `errors.nextWeekBody` | `config.messages.nextWeekNotPublished` |
   | `errors.emptyWeekBody` | new `config.messages.*` entry — see the note in README.md |
   | extras names (`Éthordó doboz`, `Kenyér`, `Ketchup / tartármártás`) | `config.extras[].name` |
   | `order.phone`, `order.address`, `order.intake`, `footer.opening`, `footer.delivery` | restaurant identity — **not yet in `RestaurantConfig`**, see README.md §Follow-ups |
3. **Numbers written into sentences.** `order.terms`, `summary.minimumWarning`, `summary.minimumBlocked`,
   `sections.soupsHint` and `footer.delivery` currently spell out 2 200 Ft, 150 Ft and 650 Ft. They
   must be interpolated from `config.pricing` instead of typed, or the copy lies the day a price
   changes. Left as prose here so the sentences read naturally in review; O6 wires them up.
4. **Formatting is not copy.** `common.currency` is a formatter, not a string. Put it in a
   `format.ts` next to `strings.ts`. Hungarian groups thousands only from five digits, so
   `Intl.NumberFormat('hu-HU')` renders `4680 Ft` and `10 400 Ft` — both correct, do not "fix" it.
   The separator it emits is a narrow no-break space (U+202F).

## The table

```ts
export const strings = {
  siteName: 'Piccolo Club Étterem',
  order: {
    title: 'Rendelés — Piccolo Club Étterem',
    intake: 'Rendelésfelvétel 7:30–9:30',
    phone: '+36 30 490 1122',
    address: 'Szombathely, Mátyás Király u. 12.',
    terms: 'Kiszállítás 150 Ft / cím / nap · Naponta legalább 2 200 Ft ételérték',
  },
  week: {
    heading: 'Heti menü',
    number: (n: number) => n + '. hét',
    range: (from: string, to: string) => from + ' – ' + to,
    cutoffToday: 'A mai napra 9:30-ig adhatsz le rendelést.',
    cutoffPassed: 'A mai rendelésfelvétel 9:30-kor lezárult, a következő rendelhető nap holnap.',
  },
  days: {
    long: ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'],
    short: ['H', 'K', 'Sze', 'Cs', 'P', 'Szo'],
    closed: 'Zárva',
    badgeTitle: (n: number) => n + ' menü a kosárban erre a napra',
    pastTitle: 'Erre a napra már lezárult a rendelésfelvétel',
  },
  sections: {
    soups: 'Napi levesek',
    mains: 'Napi főételek',
    featured: 'Kiemelt ajánlat',
    allWeek: 'Egész héten rendelhető',
    sides: 'Köretek',
    sideExtras: 'Feláras köretek',
    pickles: 'Savanyúságok',
    desserts: 'Desszertek',
    weekendHint: 'Szombaton eltérő ár',
    soupsHint: 'Napi főétel mellé ingyen, önmagában 650 Ft.',
    all: 'Összes',
    jumpLabel: 'Ugrás a kínálaton belül',
  },
  dish: {
    soupIncluded: 'A menü ára tartalmazza',
    soldOut: 'Elfogyott',
    hasVariations: 'Választható',
    needsSide: 'Körettel',
    compose: 'Összeállítom',
    noPhoto: 'Ehhez a fogáshoz nincs kép',
    composeBlank: 'Menü összeállítása',
    weekendPrice: (p: string) => 'szombaton ' + p,
  },
  allergens: {
    link: 'Allergének',
    title: 'Allergén tájékoztató',
    codesLabel: 'Allergének:',
    notice: 'Az ételek allergénjeit a fogás neve alatt számokkal jelöljük. A konyhánkban glutént, tejet, tojást, szóját, diót, zellert és halat is használunk, ezért a nyomokban való előfordulás egyetlen fogásnál sem zárható ki. Ha allergiád van, a rendelés leadása előtt hívj minket.',
    list: [
      'Glutént tartalmazó gabonák',
      'Rákfélék',
      'Tojás',
      'Halak',
      'Földimogyoró',
      'Szójabab',
      'Tej és tejtermék (laktóz)',
      'Diófélék',
      'Zeller',
      'Mustár',
      'Szezámmag',
      'Kén-dioxid és szulfitok',
      'Csillagfürt',
      'Puhatestűek',
    ],
  },
  composer: {
    title: 'Menü összeállítása',
    editTitle: 'Menü módosítása',
    recipientLabel: 'Kinek lesz? (opcionális)',
    recipientPlaceholder: 'Pl. Anita',
    recipientHelp: 'Ha többeknek rendelsz, a név alapján osztjátok szét az ebédet.',
    slots: {
      soup: 'Leves',
      main: 'Főétel',
      side: 'Köret',
      pickle: 'Savanyúság',
      dessert: 'Desszert',
    },
    none: 'Nem kérek',
    choose: 'Válassz',
    variationLabel: 'Változat',
    variationOf: (name: string) => name + ' — változat',
    variationMissing: 'Válassz változatot',
    sideMissing: 'Ehhez a főételhez köret jár',
    emptyMenu: 'Válassz legalább egy fogást.',
    noSoupDiscount: 'Leves nélkül',
    soupSurcharge: 'Leves felár',
    soupSurchargeWhy: 'A leves csak a napi főételek árában van benne.',
    priceTotal: 'Menü ára',
    add: 'Hozzáadás',
    addMany: (n: number) => n + ' adag hozzáadása',
    portions: 'adag',
    portionsHelp: 'Ugyanez a menü több adagban — mindegyik külön sorként kerül a kosárba, saját névvel.',
    save: 'Módosítás mentése',
    cancel: 'Mégsem',
    pickerTitle: (slot: string) => slot + ' választása',
  },
  cart: {
    title: 'A rendelésed erre a napra',
    menuNumber: (n: number) => n + '. menü',
    anonymous: 'Név nélkül',
    edit: 'Módosítás',
    remove: 'Törlés',
    addAnother: 'Még egy menü ehhez a naphoz',
    empty: 'Erre a napra még nincs összeállított menüd.',
    emptyCta: 'Válassz egy főételt a lentiek közül, vagy állíts össze egy menüt levessel.',
    foodSubtotal: 'Ételek összesen',
  },
  extras: {
    title: 'Extrák',
    hint: 'Naponta, az adott nap rendeléséhez.',
    less: 'Kevesebb',
    more: 'Több',
  },
  summary: {
    title: 'Összegzés',
    empty: 'A kosarad üres.',
    emptyHint: 'Állíts össze egy menüt, és itt látod majd a végösszeget.',
    food: 'Ételek',
    deliveryFee: 'Kiszállítás',
    dayTotal: 'Nap összesen',
    grandTotal: 'Fizetendő összesen',
    feeNote: 'A kiszállítási díj naponta és címenként 150 Ft.',
    barMenus: (n: number) => n + ' menü',
    barDays: (n: number) => n + ' nap',
    details: 'Részletek',
    hideDetails: 'Bezár',
    continue: 'Tovább a rendeléshez',
    minimumWarning: (day: string, missing: string) => day + ': még ' + missing + ' hiányzik a 2 200 Ft-os minimumhoz.',
    minimumBlocked: (days: string) => 'Naponta legalább 2 200 Ft értékben kell ételt rendelni. Még nem éred el: ' + days + '.',
  },
  checkout: {
    title: 'Rendelés véglegesítése',
    back: 'Vissza a menühöz',
    contact: 'Elérhetőség',
    orderTitle: 'A rendelésed',
    name: 'Név',
    namePlaceholder: 'Teljes név',
    phone: 'Telefonszám',
    phonePlaceholder: '+36 30 123 4567',
    phoneHelp: 'A futár ezen a számon keres, ha nem talál.',
    email: 'E-mail cím',
    emailHelp: 'Ide küldjük a visszaigazolást.',
    address: 'Szállítási cím',
    addressPlaceholder: 'Utca, házszám, emelet, ajtó',
    addressHelp: 'Írd ide a csengő nevét is, ha nem a tiéd.',
    note: 'Megjegyzés (opcionális)',
    notePlaceholder: 'Pl. a portán kérem leadni.',
    payment: 'A rendelést a futárnál fizeted, kiszállításkor.',
    submit: 'Rendelés elküldése',
    submitting: 'Küldés folyamatban…',
    required: '*',
    errors: {
      summary: 'Nézd át a pirossal jelölt mezőket.',
      nameRequired: 'Add meg a neved.',
      phoneRequired: 'Add meg a telefonszámod.',
      phoneInvalid: 'Ellenőrizd a telefonszámot.',
      emailRequired: 'Add meg az e-mail címed.',
      emailInvalid: 'Ellenőrizd az e-mail címet — hiányzik a @ jel.',
      addressRequired: 'Add meg a szállítási címet.',
      addressIncomplete: 'Az utca mellé a házszámot is írd oda.',
    },
  },
  success: {
    title: 'Köszönjük, megkaptuk a rendelésed!',
    lead: (email: string) => 'A visszaigazolást elküldtük a ' + email + ' címre. Ha pár percen belül nem érkezik meg, nézd meg a levélszemét mappát is.',
    daysTitle: 'Amit rendeltél',
    orderId: 'Azonosító',
    payNote: 'Fizetés a futárnál, kiszállításkor.',
    questions: (phone: string) => 'Kérdésed van? Hívj minket: ' + phone,
    newOrder: 'Új rendelés indítása',
  },
  errors: {
    submitFailedTitle: 'Nem sikerült elküldeni a rendelést',
    submitFailedBody: 'A kosarad megmaradt, semmi nem veszett el. Próbáld meg újra — ha másodszorra sem megy, hívj minket a +36 30 490 1122 számon.',
    retry: 'Újraküldés',
    cutoffTitle: 'Lejárt a rendelési határidő',
    cutoffBody: (day: string) => day + ' 9:30-kor lezárult a rendelésfelvétel, ezért ezt a napot kivettük a kosaradból. A többi nap megmaradt.',
    cutoffAction: 'Értem',
    soldOutTitle: 'Időközben elfogyott',
    soldOutBody: 'Az alábbi fogások közben elfogytak. Cseréld ki őket, és küldd el újra a rendelést.',
    soldOutWhere: (day: string, who: string) => day + ' · ' + who,
    soldOutAction: 'Vissza a kosárhoz',
    nextWeekTitle: 'A jövő heti menü még nem érhető el',
    nextWeekBody: 'A következő hét menüjét vasárnap este vagy hétfő reggel töltjük fel. Nézz vissza akkor — addig is elérhetők vagyunk telefonon.',
    emptyWeekTitle: 'Erre a hétre még nincs feltöltve menü',
    emptyWeekBody: 'Amint elkészül a heti menü, itt azonnal látni fogod. Telefonon addig is szívesen segítünk.',
    closedDay: 'Ezen a napon zárva vagyunk.',
  },
  footer: {
    openingTitle: 'Nyitvatartás',
    opening: 'Hétfő–szombat 11:00–16:00',
    deliveryTitle: 'Kiszállítás',
    delivery: 'Hétfő–szombat, 150 Ft / cím / nap. Minimum 2 200 Ft ételérték naponta.',
    contactTitle: 'Elérhetőség',
  },
  common: {
    close: 'Bezár',
    currency: (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ') + ' Ft',
  },
} as const;
```

## Wording choices worth keeping

- **Informal `te`, never `ön`.** These are regulars ordering lunch, and the old site is informal too.
- **Errors say what to do next.** `errors.submitFailedBody` names a phone number, because a guest
  who cannot order by 9:30 has lost their lunch, not just a form submission.
- **"Kinek lesz?" instead of "Címzett".** Group ordering is nine colleagues, not a shipping label.
- **"Elfogyott", not "Nem elérhető".** It is what the kitchen says on the phone.
- **`composer.portions` is `adag`, not `db`.** You order portions of a lunch, not pieces of a
  product. `addMany(3)` reads "3 adag hozzáadása" — it says what the button will do, in the plural
  the guest already sees on the stepper.
- **The e-mail address is repeated on the success screen.** A mistyped address is the most common
  reason a confirmation never arrives, and it is the only moment the guest can still notice it.
