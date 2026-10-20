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
  /** The header of every page: the links lead to the sections of `/`. */
  header: {
    label: 'Navigáció',
    menu: 'Heti menü',
    restaurant: 'Az étterem',
    contact: 'Elérhetőség',
    order: 'Rendelés',
    intake: (from: string, until: string) => `Rendelésfelvétel ${from}–${until}`,
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
    mainPlaceholder: 'Válassz főételt',
    mainPlaceholderHint: 'Napi menü, kiemelt ajánlat vagy egész héten rendelhető étel',
    mainPick: 'Választás',
    mainChange: 'Módosítás',
    soupHint: 'A napi főételek ára tartalmazza a levest.',
    unanswered: 'Válassz levest — a „Nem kérek” is válasz.',
    mainUnanswered: 'Válassz főételt — a „Nem kérek” is válasz.',
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
    /** On a daily main whose price leaves the soup out. */
    withoutSoup: 'Levest nem tartalmaz',
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
    addToCart: 'Hozzáadás a kosárhoz',
    nextMenu: (menu: number, inCart: number) => `${menu}. menü · a kosárban ${inCart} menü`,
  },
  checkout: {
    title: 'Rendelés véglegesítése',
    back: 'Vissza a menühöz',
    contact: 'Elérhetőség',
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
    // TODO(copy): Dávid to confirm the kicker, the lead and the three steps.
    kicker: 'Jó étvágyat!',
    title: 'Köszönjük, megkaptuk a rendelésed!',
    lead: 'Minden rendben, a többi már a mi dolgunk.',
    stepsLabel: 'Mi történik most?',
    steps: {
      mail: {
        title: 'Visszaigazolás e-mailben',
        body: (email: string) =>
          `Elküldtük a ${email} címre. Ha pár percen belül nem érkezik meg, nézd meg a levélszemét mappát is.`,
      },
      cook: {
        title: 'Frissen főzzük',
        body: 'A rendelt napokon frissen készítjük el az ebédedet.',
      },
      deliver: {
        title: 'Házhoz visszük',
        body: 'Fizetés a futárnál, átvételkor.',
      },
    },
    daysTitle: 'Amit rendeltél',
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
    credit: {
      years: (current: number) => `2015–${current}`,
      linkLabel: 'Stresszmentes weboldalkészítés kisvállalkozásoknak Szombathelyen',
    },
  },
  /** `/`: the week's menu and the permanent menu, to read. Ordering is on /megrendeles. */
  menuPage: {
    meta: {
      title: 'Heti menü — Piccolo Club Étterem',
      description:
        'A Piccolo Club Étterem heti menüje és étlapja: napi levesek és főételek, desszertek, savanyúságok. Rendeld meg online, kiszállítással Szombathelyen.',
    },
    soups: 'Levesek',
    mains: 'Főételek',
    mainsHint: 'A napi főételek ára tartalmaz egy választott levest.',
    emptyDay: 'Erre a napra nincs feltöltve menü.',
    /** In place of a daily soup's price, which the menu's price includes. */
    soupIncluded: 'egy választott levest a menü ára tartalmaz',
    withSoup: '+ választott leves',
    /** On a daily main whose price leaves the soup out, against the mains hint above it. */
    withoutSoup: 'Levest nem tartalmaz',
    withSide: '+ választott köret',
    variations: (names: readonly string[]) => `Választható: ${names.join(', ')}`,
    sections: {
      featured: 'Kiemelt ajánlat',
      allWeek: 'Egész héten rendelhető',
      desserts: 'Desszertek',
      pickles: 'Savanyúságok',
      sides: 'Köretek',
    },
    sidesHint: 'A köretes főételekhez egy köret felár nélkül jár.',
    /** The page shows this week because the API has no orderable week now. */
    notices: {
      nextWeekTitle: 'A jövő heti menü hamarosan érkezik',
      nextWeekBody:
        'Vasárnap este vagy hétfő reggel töltjük fel, akkor rendelhetsz is. Addig az e heti kínálatot mutatjuk.',
      closedTitle: 'Erre a hétre már nem tudsz online rendelni',
      closedBody: 'Telefonon szívesen segítünk:',
    },
    prices: {
      title: 'Árak és extrák',
      soupAlone: 'Csak leves',
      noSoup: 'Főétel leves nélkül',
      perPiece: (price: string) => `${price} / db`,
      vat: 'Az árak forintban értendők, és tartalmazzák az áfát.',
    },
  },
  /** The shell of `/` around the menu: header, photos, the restaurant, hours, delivery, contact. */
  landing: {
    // TODO(copy): Dávid to confirm the lede and the restaurant's paragraph.
    lede: 'Friss, házias ebéd hétfőtől szombatig, nálunk vagy házhoz szállítva',
    about: {
      title: 'Az étterem',
      body: 'A Piccolo Club Étterem Szombathelyen várja a vendégeket. Minden héten új menüt főzünk: naponta több leves és főétel közül választhatsz, mellettük egész héten rendelhető ételek, desszertek és savanyúságok várnak. Ebédelj nálunk, vagy rendeld meg online, és házhoz visszük.',
    },
    hours: {
      title: 'Nyitvatartás',
      restaurant: 'Étterem',
      intake: 'Rendelésfelvétel',
      intakeValue: (from: string, until: string) => `${from}–${until}`,
      delivery: 'Kiszállítás',
      deliveryDays: 'Hétfő–szombat',
    },
    delivery: {
      title: 'Rendelj házhoz!',
      fee: 'Kiszállítási díj',
      feeValue: (fee: string) => `${fee} / cím / nap`,
      minimum: 'Minimum rendelés',
      minimumValue: (minimum: string) => `${minimum} ételérték címenként, naponta`,
      order: 'Rendeld meg online',
      orByPhone: 'vagy hívj minket:',
    },
    contact: {
      title: 'Elérhetőség',
      address: 'Cím',
      phone: 'Telefon',
      directions: 'Útvonaltervezés',
    },
    photos: {
      window: 'Megterített asztal az ablak előtt, narancssárga kárpitos paddal',
      hall: 'A hosszú étterem, a fal mentén végig kárpitos pad',
      booths: 'Asztalok a nagy ablakok előtt és a fal mellett',
      clock: 'Megterített asztalok a fali óra alatt',
      entrance: 'A Piccolo bejárata az utcáról',
    },
  },
  common: {
    close: 'Bezár',
    /** The minimum order when Saturday's differs: `2200 Ft (szombaton 2590 Ft)`. */
    minimumWithWeekend: (weekday: string, weekend: string) => `${weekday} (szombaton ${weekend})`,
    /** `amount` is already grouped by `Intl.NumberFormat('hu-HU')`; see format.ts. */
    forint: (amount: string) => `${amount}\u00a0Ft`,
    /** A signed adjustment, `+650 Ft` / `−100 Ft`; `amount` is the unsigned formatted value. */
    plus: (amount: string) => `+${amount}`,
    minus: (amount: string) => `−${amount}`,
  },
} as const;
