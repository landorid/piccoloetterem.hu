/**
 * Every user-facing string of the public site. Hungarian, never inlined into a
 * component or a page (see AGENTS.md).
 *
 * The copy is the O2 handover (docs/design/megrendeles/strings.md); O7 pastes the checkout and
 * success branches. Restaurant facts (phone, address, opening hours, intake window, prices) come
 * from `GET /api/config/public` and are passed in, never typed here. Error texts of core codes
 * and allergen names come from core (`orderMessagesHu`, `allergenLabelsHu`). `TODO(O2)` marks
 * copy the handover does not have.
 */
export const strings = {
  siteName: 'Piccolo Club Étterem',
  meta: {
    title: 'Rendelés — Piccolo Club Étterem',
    // TODO(O2): not in the handover.
    description:
      'Rendeld meg online a Piccolo Club Étterem heti menüjét: napi levesek és főételek, kiszállítással Szombathelyen.',
  },
  masthead: {
    intake: (from: string, until: string) => `Rendelésfelvétel ${from}–${until}`,
  },
  order: {
    terms: (fee: string, minimum: string) =>
      `Kiszállítás ${fee} / cím / nap · Naponta legalább ${minimum} ételérték`,
  },
  week: {
    heading: 'Heti menü',
    // TODO(O2): not in the handover.
    loading: 'A heti menü betöltése…',
    number: (n: number) => `${n}. hét`,
    range: (from: string, to: string) => `${from} – ${to}`,
    cutoffToday: (time: string) => `A mai napra ${time}-ig adhatsz le rendelést.`,
    cutoffPassed: (time: string) =>
      `A mai rendelésfelvétel ${time}-kor lezárult, a következő rendelhető nap holnap.`,
  },
  days: {
    /** Monday … Saturday, the menu's days 1–6. */
    short: ['H', 'K', 'Sze', 'Cs', 'P', 'Szo'],
    closed: 'Zárva',
    badgeTitle: (n: number) => `${n} menü a kosárban erre a napra`,
    pastTitle: 'Erre a napra már lezárult a rendelésfelvétel',
    /** `Szerda, szept. 9.` */
    full: (weekday: string, date: string) => `${weekday}, ${date}`,
    // TODO(O2): the handover names a tab by its visible parts only.
    tabLabel: (day: string, mark: string | null) => (mark ? `${day}, ${mark}` : day),
  },
  /** Group headings of the main-course picker. */
  sections: {
    mains: 'Napi főételek',
    featured: 'Kiemelt ajánlat',
    allWeek: 'Egész héten rendelhető',
  },
  dish: {
    soldOut: 'Elfogyott',
  },
  allergens: {
    tip: (n: number, name: string) => `${n} · ${name}`,
    more: (n: number) => `+${n}`,
    moreLabel: (names: readonly string[]) => `További allergének: ${names.join(', ')}`,
  },
  composer: {
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
    /** `KÖRET · KÖTELEZŐ`: the block must be answered (uppercased by CSS). */
    required: (label: string) => `${label} · kötelező`,
    /** `LEVES · VÁLASSZ`: the soup is not answered yet. */
    answer: (label: string) => `${label} · válassz`,
    soupHint: 'A napi főételek ára tartalmazza a levest.',
    unanswered: 'Válassz levest — a „Nem kérek” is válasz.',
    formTitle: (n: number) => `${n}. menü összeállítása`,
    // TODO(O2): the handover's main row has no accessible name; these follow its words.
    mainPrompt: 'Főétel: Válassz',
    mainChosen: (dish: string) => `${dish} — Módosítás`,
    withVariation: (dish: string, variation: string) => `${dish} — ${variation}`,
    reset: 'Ürítés',
    mealExtras: 'Extra',
    mealExtrasHint: 'Ezek a nap rendeléséhez adódnak hozzá, nem a menü ára részei.',
    extrasSubtotal: 'Kiegészítők',
    emptyMenu: 'Válassz legalább egy fogást.',
    noSoupDiscount: 'Leves nélkül',
    soupSurcharge: 'Leves felár',
    soupSurchargeWhy: 'A leves csak a napi főételek árában van benne.',
    priceTotal: 'Menü ára',
    add: 'Hozzáadás',
    pickerTitle: (slot: string) => `${slot} választása`,
  },
  cart: {
    title: 'A rendelésed erre a napra',
    menuNumber: (n: number) => `${n}. menü`,
    edit: 'Módosítás',
    remove: 'Törlés',
    addAnother: 'Még egy menü ehhez a naphoz',
    empty: 'Erre a napra még nincs összeállított menüd.',
    emptyCta: 'Állíts össze egy menüt az űrlapon.',
    foodSubtotal: 'Ételek összesen',
    extraLine: (name: string, quantity: number) => `${name} × ${quantity}`,
  },
  extras: {
    title: 'Extrák',
    lessOf: (name: string) => `Kevesebb: ${name}`,
    moreOf: (name: string) => `Több: ${name}`,
    unitPrice: (price: string) => `${price} / db`,
  },
  summary: {
    title: 'Összegzés',
    empty: 'A kosarad üres.',
    emptyHint: 'Állíts össze egy menüt, és itt látod majd a végösszeget.',
    food: 'Ételek',
    deliveryFee: 'Kiszállítás',
    grandTotal: 'Fizetendő összesen',
    feeNote: (fee: string) => `A kiszállítási díj naponta és címenként ${fee}.`,
    count: (menus: number, days: number) => `${menus} menü · ${days} nap`,
    details: 'Részletek',
    hideDetails: 'Bezár',
    continue: 'Tovább a rendeléshez',
  },
  checkout: {
    title: 'Rendelés véglegesítése',
    back: 'Vissza a menühöz',
    contact: 'Elérhetőség',
    cartValue: 'Kosár értéke',
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
    minimumTitle: 'Nem éred el a napi minimumot',
    minimumBody: (minimum: string) =>
      `Naponta legalább ${minimum} értékben kell ételt rendelni. A rendelést így is elküldheted, de a hiányzó összeget kiszállításkor ki kell fizetned.`,
    minimumDay: (day: string, missing: string) => `${day}: ${missing} különbözet`,
    submit: 'Rendelés elküldése',
    submitting: 'Küldés folyamatban…',
    // TODO(O2): not in the handover: the prefill from the last order and its 'Törlés' link.
    remembered: 'Az adataidat a legutóbbi rendelésedből töltöttük ki.',
    forget: 'Törlés',
    forgetLabel: 'A megjegyzett adatok törlése',
    /** The honeypot's label. People never see it; a bot that reads labels fills it in. */
    honeypot: 'Weboldal',
    errors: {
      summary: 'Nézd át a pirossal jelölt mezőket.',
      nameRequired: 'Add meg a neved.',
      phoneRequired: 'Add meg a telefonszámod.',
      phoneInvalid: 'Ellenőrizd a telefonszámot.',
      emailRequired: 'Add meg az e-mail címed.',
      // The handover's "hiányzik a @ jel" is true only of one way an address can be wrong.
      emailInvalid: 'Ellenőrizd az e-mail címet.',
      addressRequired: 'Add meg a szállítási címet.',
      addressIncomplete: 'Az utca mellé a házszámot is írd oda.',
    },
  },
  success: {
    title: 'Köszönjük, megkaptuk a rendelésed!',
    lead: (email: string) =>
      `A visszaigazolást elküldtük a ${email} címre. Ha pár percen belül nem érkezik meg, nézd meg a levélszemét mappát is.`,
    daysTitle: 'Amit rendeltél',
    orderId: (id: string) => `Azonosító: ${id}`,
    payNote: 'Fizetés a futárnál, kiszállításkor.',
    questions: 'Kérdésed van? Hívj minket:',
    newOrder: 'Új rendelés indítása',
  },
  errors: {
    nextWeekTitle: 'A jövő heti menü még nem érhető el',
    nextWeekBody:
      'A következő hét menüjét vasárnap este vagy hétfő reggel töltjük fel. Nézz vissza akkor — addig is elérhetők vagyunk telefonon.',
    emptyWeekTitle: 'Erre a hétre még nincs feltöltve menü',
    emptyWeekBody:
      'Amint elkészül a heti menü, itt azonnal látni fogod. Telefonon addig is szívesen segítünk.',
    // TODO(O2): not in the handover.
    loadFailedTitle: 'Nem sikerült betölteni a menüt',
    loadFailedBody:
      'Ellenőrizd az internetkapcsolatot, és próbáld újra. Ha most sem megy, telefonon is leadhatod a rendelésed.',
    retry: 'Újrapróbálom',
    unavailableTitle: 'Az online rendelés most nem érhető el',
    unavailableBody: 'Próbáld újra később.',
    cutoffTitle: 'Lejárt a rendelési határidő',
    cutoffBody: (day: string, time: string) =>
      `${day} ${time}-kor lezárult a rendelésfelvétel, ezért ezt a napot kivettük a kosaradból. A többi nap megmaradt.`,
    cutoffAction: 'Értem',
    submitFailedTitle: 'Nem sikerült elküldeni a rendelést',
    submitFailedBody: (phone: string) =>
      `A kosarad megmaradt, semmi nem veszett el. Próbáld meg újra — ha másodszorra sem megy, hívj minket a ${phone} számon.`,
    resubmit: 'Újraküldés',
    // TODO(O2): not in the handover: 429 from POST /api/orders, which sends no usable wait time.
    rateLimitedTitle: 'Most túl sok rendelés érkezett',
    rateLimitedBody: (phone: string) =>
      `Próbáld újra néhány perc múlva. Ha sürgős, hívj minket a ${phone} számon.`,
    /** A day the API refused at submission because its cutoff passed meanwhile. */
    cutoffSubmitBody: (days: string, time: string) =>
      `${days}: ${time}-kor lezárult a rendelésfelvétel, ezért ezt a napot kivettük a kosaradból. A többi nap megmaradt, a rendelést elküldheted.`,
    // TODO(O2): not in the handover: a day staff closed (#60) after it went into the cart.
    closedTitle: 'Erre a napra időközben nem lehet rendelni',
    closedBody: (days: string) =>
      `${days}: ezt a napot kivettük a kosaradból. A többi nap megmaradt, a rendelést elküldheted.`,
    /** Every day of the cart was removed: there is nothing left to send. */
    cartEmptied: 'A kosarad üres lett. Állíts össze egy menüt egy másik napra.',
    soldOutTitle: 'Időközben elfogyott',
    soldOutBody:
      'Az alábbi fogások közben elfogytak. Cseréld ki őket, és küldd el újra a rendelést.',
    soldOutItem: (day: string, menu: string, dish: string) => `${day} · ${menu} · ${dish}`,
    soldOutAction: 'Vissza a kosárhoz',
    // TODO(O2): not in the handover: a 400 the guest cannot fix in the form (a stale cart).
    rejectedTitle: 'A rendelést nem tudtuk elfogadni',
    rejectedBody: (phone: string) =>
      `A kosaradban valami már nem rendelhető. Frissítsd az oldalt, és állítsd össze újra — vagy hívj minket a ${phone} számon.`,
    /** A day staff closed (#60): it must not say the restaurant is closed. */
    closedDay: 'Erre a napra nem lehet rendelni.',
  },
  footer: {
    openingTitle: 'Nyitvatartás',
    deliveryTitle: 'Kiszállítás',
    // The handover's sentence starts with "Hétfő–szombat,": the opening hours already say which
    // days, and the operating days are not part of the public config.
    delivery: (fee: string, minimum: string) =>
      `${fee} / cím / nap. Minimum ${minimum} ételérték naponta.`,
    contactTitle: 'Elérhetőség',
  },
  common: {
    close: 'Bezár',
    /** `amount` is already grouped by `Intl.NumberFormat('hu-HU')`; see format.ts. */
    forint: (amount: string) => `${amount}\u00a0Ft`,
    /** A signed adjustment, `+650 Ft` / `−100 Ft`; `amount` is the unsigned formatted value. */
    plus: (amount: string) => `+${amount}`,
    minus: (amount: string) => `−${amount}`,
  },
} as const;
