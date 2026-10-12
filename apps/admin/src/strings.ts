import type {
  CardPlace,
  DateRange,
  ImportFailure,
  ImportFinding,
  MonthDay,
} from '@piccolo/core/menu-card';

type FindingTexts = {
  [K in ImportFinding['kind']]: (finding: Extract<ImportFinding, { kind: K }>) => string;
};

const findingTexts: FindingTexts = {
  week_mismatch: (f) =>
    `A kártya dátuma ${dateRange(f.card)}, de ez a hét ${dateRange(f.week)} Ellenőrizd, hogy jó héthez töltötted-e be.`,
  week_unverified: () =>
    'A kártyán nincs dátum, ezért nem ellenőrizhető, hogy ehhez a héthez tartozik-e.',
  day_without_dishes: (f) =>
    [
      `${strings.weeklyMenu.days[f.day]}: a kártyán nincs rá étel${f.texts.length > 0 ? ` (${quoted(f.texts)})` : ''}, ezért üresen maradt.`,
      f.withheld.length > 0 && `A több napra szóló ${quoted(f.withheld)} sem került rá.`,
    ]
      .filter(Boolean)
      .join(' '),
  cell_skipped: (f) => `${cardPlace(f.where)}: kimaradt, mert nem étel: ${quoted([f.text])}.`,
  price_note_ignored: (f) => `${f.row} sor, Áraink: kimaradt ez a megjegyzés: ${quoted([f.text])}.`,
  price_missing: (f) =>
    `${cardPlace(f.where)}: ${quoted([f.name])} kimaradt, mert nincs mellette ár. Vedd fel kézzel.`,
  weekend_price_missing: (f) =>
    `${cardPlace(f.where)}: ${quoted([f.name])} mellett nincs szombati ár, ezért szombaton is a hétköznapi ár érvényes.`,
  allergens_missing: (f) =>
    `${cardPlace(f.where)}: ${quoted([f.name])} mellett nincs allergénszám. Ellenőrizd az allergéneket.`,
  allergen_unknown: (f) =>
    `${cardPlace(f.where)}: ${quoted([f.name])} ismeretlen allergénszámai kimaradtak: ${f.numbers.join(', ')}.`,
  featured_unpaired: (f) =>
    `Kiemelt ajánlatok: ${f.dishes.length} ételhez ${f.prices} ár tartozik, ezért egyik sem került be: ${quoted(f.dishes)}.`,
  section_skipped: (f) => `Kimaradt ez a rész: ${quoted([f.title])}.`,
};

/**
 * Every user-facing string of the admin. Hungarian, never inlined into a
 * component (see AGENTS.md); `pnpm lint:strings` fails on Hungarian text
 * anywhere else in `src/`.
 */
export const strings = {
  appName: 'Piccolo admin',
  loading: 'Betöltés…',
  signOut: 'Kijelentkezés',
  nav: {
    label: 'Főmenü',
    orders: 'Rendelések',
    summary: 'Napi összesítő',
    weeklyMenu: 'Heti menü',
    items: 'Étlap',
  },
  sidebar: {
    toggle: 'Oldalsáv kinyitása vagy becsukása',
    apiVersion: 'API-verzió',
    apiUnreachable: 'Az API most nem érhető el.',
  },
  pages: {
    orders: {
      title: 'Rendelések',
      description: 'Egy nap rendelései: keresés, részletek, feldolgozás és lemondás.',
    },
    summary: {
      title: 'Napi összesítő',
      description: 'Konyhai összesítő és kiszállítási lista egy napra, nyomtatható formában.',
    },
    weeklyMenu: {
      title: 'Heti menü',
      description: 'A hét leveseinek, főételeinek és ajánlatainak szerkesztése, majd közzététele.',
    },
    items: {
      title: 'Étlap',
      description: 'Az állandó tételek – desszertek, savanyúságok, köretek – és allergénjeik.',
    },
  },
  placeholder: {
    title: 'Ez a képernyő még készül',
    description: 'Hamarosan itt fogsz tudni dolgozni vele.',
  },
  notFound: {
    title: 'Ez az oldal nem létezik',
    description: 'Ellenőrizd a címet, vagy válassz a menüből.',
    back: 'Vissza a rendelésekhez',
  },
  noAccess: {
    title: 'Nincs hozzáférésed',
    notMember:
      'Ez a fiók nem tagja az étterem személyzetének. Jelentkezz be egy másik fiókkal, vagy kérj meghívót.',
    activationFailed:
      'Nem sikerült megnyitni az étterem fiókját. Jelentkezz ki, majd próbáld újra.',
  },
  confirm: {
    confirm: 'Megerősítés',
    cancel: 'Mégse',
  },
  datePicker: {
    placeholder: 'Válassz dátumot',
  },
  /** The day header of the orders screen and the summary (`DayNavigator`). */
  dayNavigator: {
    previous: 'Előző nap',
    next: 'Következő nap',
  },
  /** The weekly menu grid (`/heti-menu`, M5). */
  weeklyMenu: {
    week: {
      previous: 'Előző hét',
      next: 'Következő hét',
      pick: 'Hét kiválasztása egy napjával',
      draft: 'Piszkozat',
      published: 'Publikálva:',
    },
    days: {
      1: 'Hétfő',
      2: 'Kedd',
      3: 'Szerda',
      4: 'Csütörtök',
      5: 'Péntek',
      6: 'Szombat',
    },
    groups: {
      soups: 'Levesek',
      mains: 'Főételek',
      featured: 'Kiemelt ajánlat',
    },
    featuredHint: 'Egész héten rendelhető.',
    /** A row's name for screen readers: `Hétfő, 2. leves`. */
    rowNames: {
      soups: 'leves',
      mains: 'főétel',
      featured: 'kiemelt ajánlat',
    },
    fields: {
      name: 'Név',
      description: 'Leírás',
      priceWeekday: 'Hétköznapi ár',
      priceWeekend: 'Hétvégi ár',
      price: 'Ár',
      currency: 'Ft',
      weekendShort: 'Hétvége',
      variationShort: 'Variáció',
      weekendEmpty: 'Üresen hagyva a hétköznapi ár érvényes.',
      soupIncluded: 'Levessel',
      soldOut: 'Elfogyott',
      soldOutUnsaved: 'Mentés után állítható',
    },
    add: {
      soups: 'Leves hozzáadása',
      mains: 'Főétel hozzáadása',
      featured: 'Ajánlat hozzáadása',
    },
    removeRow: 'Sor törlése',
    closed: 'Nincs rendelés',
    actions: {
      save: 'Mentés',
      publish: 'Publikálás',
      unsaved: 'Nem mentett módosítások',
      upToDate: 'Minden változás elmentve.',
      saveFirst: 'Publikálás előtt mentsd a módosításokat.',
      emptyWeek: 'Üres hetet nem lehet publikálni.',
    },
    toasts: {
      saved: 'A heti menü elmentve.',
      published: 'A heti menü publikálva: a vendégek már látják.',
      soldOut: 'Elfogyottnak jelölve.',
      available: 'Újra rendelhető.',
      closed: 'Erre a napra nem lehet rendelni.',
      reopened: 'Erre a napra újra lehet rendelni.',
    },
    publishDialog: {
      title: 'Publikálod a heti menüt?',
      description: 'A vendégek ezután látják, és rendelhetnek belőle. Visszavonni nem lehet.',
      noMains: 'Ezeken a napokon nincs főétel:',
    },
    leaveDialog: {
      title: 'Elveted a módosításokat?',
      description: 'A heti menün nem mentett módosítások vannak. Ha továbblépsz, elvesznek.',
      confirm: 'Elvetés',
      cancel: 'Maradok',
    },
    loadFailed: {
      title: 'Nem sikerült betölteni a hetet',
      description: 'Ellenőrizd az internetkapcsolatot, majd próbáld újra.',
      retry: 'Újra',
    },
    /** By the API's validation codes (core's `WeekDraftErrorCode`), and the grid's own. */
    fieldErrors: {
      required: 'Kötelező.',
      not_integer: 'Egész forintot adj meg.',
      negative: 'Nem lehet negatív.',
      must_be_zero: 'A napi leves ára mindig 0.',
      empty: 'Üres variáció nem lehet.',
      untrimmed: 'Szóköz van egy variáció elején vagy végén.',
      duplicate: 'Kétszer szerepel.',
      not_allowed: 'Itt nem megengedett.',
      invalid: 'Érvénytelen érték.',
      unknown_item: 'Ez a tétel már nem létezik. Töröld a sort, és vedd fel újra.',
      not_weekly: 'Állandó tétel nem kerülhet a heti menübe.',
      conflict: 'Ez a tétel máshol más tartalommal szerepel.',
      fallback: 'Hibás érték.',
    },
    /** Reading the week's Word menu card into the grid (`CardImport`, `ImportReport`). */
    cardImport: {
      button: 'Word menü betöltése',
      fileInput: 'A heti étlap Word-fájlja (.docx)',
      applied: 'A Word-menü betöltve.',
      unreadable: 'A fájlt nem sikerült megnyitni. Próbáld újra.',
      failures: {
        legacy_doc:
          'Ez régi Word-formátum (.doc). Nyisd meg Wordben, mentsd el .docx-ként (Fájl > Mentés másként), és azt töltsd be.',
        not_docx: 'Ez nem Word-fájl (.docx), vagy megsérült.',
        too_large: 'A fájl túl nagy: legfeljebb 32 MB lehet.',
        no_menu_table: 'Nincs benne a heti étlap táblázata (Hétfő–Szombat és Áraink fejléccel).',
        nothing_found: 'A kártyán egyetlen étel sincs.',
      } satisfies Record<ImportFailure, string>,
      confirm: {
        title: 'Betöltöd a Word-kártyát?',
        confirm: 'Betöltés',
        description: ({ replaces, mismatch }: { replaces: boolean; mismatch?: WeekMismatch }) =>
          [
            mismatch &&
              `A kártya dátuma ${dateRange(mismatch.card)}, de ez a hét ${dateRange(mismatch.week)}`,
            replaces &&
              'A rács mostani tartalmát, a nem mentett módosításokat is, a kártya váltja fel.',
            'Mentésig semmi sem változik.',
          ]
            .filter(Boolean)
            .join(' '),
      },
      report: {
        title: 'Word-kártya betöltve',
        summary: (count: number) => `${count} tétel került a rácsba. Nézd át, majd mentsd el.`,
        dismiss: 'Összefoglaló bezárása',
        closedHint:
          'Ha egy üresen maradt napon zárva vagytok, kapcsold be a napnál: Nincs rendelés.',
      },
      findings: findingTexts,
    },
  },
  /** The orders of one day at /rendelesek (S2). */
  orders: {
    statusFilter: {
      label: 'Állapot szerinti szűrés',
      all: 'Mind',
    },
    /** By core's `OrderStatus`. */
    status: {
      received: 'Beérkezett',
      processed: 'Feldolgozva',
      cancelled: 'Lemondva',
    },
    search: {
      label: 'Keresés',
      placeholder: 'Név, telefonszám vagy e-mail',
    },
    refresh: 'Frissítés',
    count: (count: number) => `${count} rendelés`,
    columns: {
      name: 'Név',
      address: 'Cím',
      phone: 'Telefon',
      createdAt: 'Beérkezett',
      menus: 'Menük',
      total: 'Összeg',
      status: 'Állapot',
    },
    pickup: 'Elvitel',
    empty: {
      title: 'Erre a napra nincs rendelés',
      description: 'Válassz másik napot, vagy nézz vissza később: a lista magától frissül.',
    },
    loadFailed: 'Nem sikerült betölteni a rendeléseket.',
    retry: 'Újra',
    noMatch: {
      title: 'Nincs találat',
      description: 'Próbálj más keresést, vagy válaszd a „Mind” szűrőt.',
    },
    shortcuts: {
      label: 'Billentyűparancsok',
      next: 'j vagy ↓: következő rendelés',
      previous: 'k vagy ↑: előző rendelés',
      open: 'Enter: a kijelölt rendelés megnyitása',
      process: 'p: a megnyitott rendelés feldolgozva',
      arrowsInDetail: 'Megnyitott rendelésnél a nyilak görgetnek, a j és a k lapoz.',
    },
    detail: {
      title: 'Rendelés részletei',
      loadFailed: 'Nem sikerült betölteni a rendelést.',
      retry: 'Újra',
      customer: 'Megrendelő',
      name: 'Név',
      phone: 'Telefon',
      email: 'E-mail',
      address: 'Cím',
      menu: (position: number) => `${position}. menü`,
      /** By core's `PriceAdjustment` codes, as the checkout labels them. */
      adjustments: {
        no_soup_discount: 'Leves nélkül',
        soup_charge: 'Leves felár',
      },
      extras: 'Extrák',
      note: 'Megjegyzés',
      foodSubtotal: 'Ételek',
      deliveryFee: 'Kiszállítás',
      total: 'Végösszeg',
      createdAt: 'Beérkezett',
      processedAt: 'Feldolgozva',
      cancelledAt: 'Lemondva',
      siblings: 'A rendelés további napjai',
      process: 'Feldolgozva',
      cancel: 'Lemondás',
    },
    cancelDialog: {
      title: 'Lemondod a rendelést?',
      description: (name: string, date: string) =>
        `${name} rendelése (${date}) lemondott állapotba kerül. Visszavonni nem lehet.`,
      confirm: 'Lemondás',
      cancel: 'Mégse',
    },
    toasts: {
      processed: 'Feldolgozottnak jelölve.',
      cancelled: 'A rendelés lemondva.',
      alreadyDone: 'Ezt már valaki más megtette.',
    },
    currency: 'Ft',
  },
  toaster: {
    label: 'Értesítések',
  },
  allergenSelect: {
    label: 'Allergének',
    none: 'Nincs',
  },
  variationsInput: {
    label: 'Variációk',
    placeholder: 'Új variáció, majd Enter',
    remove: (variation: string) => `${variation} törlése`,
  },
  /** The kitchen summary and delivery list at /osszesito (S3). */
  summary: {
    print: 'Nyomtatás',
    tabs: {
      kitchen: 'Konyhai összesítő',
      delivery: 'Kiszállítási lista',
    },
    cards: {
      orders: 'Rendelések',
      menus: 'Menük',
      fulfilment: 'Kiszállítás / elvitel',
      revenue: 'Bevétel',
    },
    /** By core's `Slot`. */
    slots: {
      main: 'Főételek',
      soup: 'Levesek',
      side: 'Köretek',
      pickle: 'Savanyúságok',
      dessert: 'Desszertek',
    },
    extras: 'Extrák',
    noneInSlot: 'Nincs rendelés.',
    columns: {
      name: 'Név',
      variation: 'Variáció',
      count: 'Darab',
      phone: 'Telefon',
      address: 'Cím',
      /** On paper the note is printed under the address. */
      addressAndNote: 'Cím, megjegyzés',
      menus: 'Menük',
      total: 'Összeg',
      note: 'Megjegyzés',
      status: 'Státusz',
      handedOver: 'Átadva',
    },
    /** A pickup order's address is empty. */
    pickup: 'Személyes átvétel',
    /** By core's `OrderStatus`. */
    statuses: {
      received: 'Beérkezett',
      processed: 'Feldolgozva',
      cancelled: 'Lemondva',
    },
    deliveryTotal: (count: number) => `Összesen: ${count} rendelés`,
    money: (amount: number) => `${new Intl.NumberFormat('hu-HU').format(amount)} Ft`,
    noOrders: {
      title: 'Erre a napra nincs rendelés',
      description: 'Válassz másik napot a fenti naptárban.',
    },
    noDeliveries: {
      title: 'Erre a napra nincs kiszállítás',
      description: 'Válassz másik napot a fenti naptárban.',
    },
    loadFailed: {
      title: 'Nem sikerült betölteni',
      description: 'Ellenőrizd az internetkapcsolatot, majd próbáld újra.',
      retry: 'Újra',
    },
  },
  /** The permanent items editor at /etlap (M6). */
  items: {
    /** Section headings, by the sections of `PUT /api/admin/menu/items`. */
    sections: {
      allWeek: 'Egész héten rendelhető',
      desserts: 'Desszertek',
      pickles: 'Savanyúságok',
      sides: 'Köretek',
      sideExtras: 'Feláras köretek',
    },
    columns: {
      name: 'Név',
      description: 'Leírás',
      priceWeekday: 'Hétköznapi ár',
      priceWeekend: 'Hétvégi ár',
      variations: 'Variációk',
      requiresSide: 'Köret kötelező',
      allergens: 'Allergének',
      soldOut: 'Elfogyott',
      active: 'Aktív',
    },
    /** A row's name for screen readers: `Desszertek, 2. tétel`. */
    rowName: (section: string, position: number) => `${section}, ${position}. tétel`,
    weekendSameAsWeekday: 'Üresen hagyva hétvégén is a hétköznapi ár érvényes.',
    emptySection: 'Ebben a részben még nincs tétel.',
    addItem: 'Új tétel',
    removeNewItem: 'Új tétel elvetése',
    moveUp: 'Feljebb',
    moveDown: 'Lejjebb',
    reactivate: 'Visszaaktiválás',
    soldOutAfterSave: 'Mentés után állítható',
    save: 'Mentés',
    saving: 'Mentés…',
    saved: 'Az étlap elmentve.',
    discard: 'Változások elvetése',
    discardConfirm: {
      title: 'Elveted a változásokat?',
      description: 'Minden nem mentett módosítás elvész.',
      confirm: 'Elvetés',
    },
    unsaved: 'Nem mentett változások.',
    upToDate: 'Minden változás elmentve.',
    invalidFields: (count: number) => `${count} hibás mező. Javítsd, majd mentsd újra.`,
    loadFailed: 'Nem sikerült betölteni az étlapot.',
    retry: 'Újrapróbálás',
    /** By core's and the API's error codes for an item field. */
    fieldErrors: {
      required: 'Kötelező mező.',
      not_integer: 'Egész forintösszeget adj meg.',
      negative: 'Nem lehet negatív.',
      must_be_zero: 'Csak 0 lehet.',
      empty: 'Üres variáció.',
      untrimmed: 'Szóköz van a variáció elején vagy végén.',
      duplicate: 'Kétszer szerepel.',
      not_allowed: 'Ennél a tételnél nem állítható.',
      invalid: 'Érvénytelen érték.',
      unknown_item: 'Ez a tétel nem található. Töltsd újra az oldalt.',
      weekly_item: 'Ez heti tétel, a heti menüben szerkeszthető.',
    },
    fieldErrorFallback: 'Hibás érték.',
    /** A row's photo (`ItemImageCell`). */
    image: {
      /** The cell's button for screen readers: `Desszertek, 2. tétel: kép`. */
      cell: (row: string) => `${row}: kép`,
      add: 'Kép feltöltése',
      replace: 'Kép cseréje',
      remove: 'Kép törlése',
      /** An unsaved row has no id to attach an image to yet. */
      afterSave: 'Mentés után tölthető fel',
      preview: 'A tétel képe',
      missing: 'A kép nem található ezen a gépen.',
      uploading: 'Feltöltés…',
      uploaded: 'A kép feltöltve.',
      removed: 'A kép törölve.',
      removeConfirm: {
        title: 'Törlöd a képet?',
        description: 'A kép és a kicsinyített változata is törlődik. Később újra feltöltheted.',
        confirm: 'Törlés',
      },
    },
  },
  errors: {
    codeLabel: 'Hibakód',
    fallback: 'Váratlan hiba történt.',
    /** By the API's `error` code (apps/api README), plus `network` for a request that never arrived. */
    byCode: {
      network: 'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot.',
      forbidden: 'Ehhez nincs jogosultságod.',
      not_found: 'A keresett adat nem található.',
      validation: 'Néhány mező hibás. Javítsd, majd próbáld újra.',
      bad_request: 'A kérés hibás volt.',
      internal: 'Hiba történt a szerveren. Próbáld újra később.',
      order_not_found: 'Ez a rendelés nem található.',
      invalid_transition: 'A rendelés állapota közben megváltozott. Frissítettük.',
      item_not_found: 'Ez a tétel már nem található. Töltsd újra az oldalt.',
      payload_too_large: 'A feltöltés túl nagy.',
      source_too_big: 'A kép túl nagy (legfeljebb 30 MB lehet).',
      undecodable: 'Ezt a képet nem lehet beolvasni. Próbálj JPEG, PNG vagy WebP képet.',
      encode_failed: 'A képet nem sikerült átalakítani. Próbálj másik képet.',
      result_too_big: 'A kép átalakítva is túl nagy maradt. Próbálj egyszerűbb képet.',
    },
  },
} as const;

type WeekMismatch = Extract<ImportFinding, { kind: 'week_mismatch' }>;

/** `06.15.–06.20.`, which ends a sentence too. */
function dateRange({ from, to }: DateRange): string {
  const monthDay = ({ month, day }: MonthDay) =>
    `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}.`;
  return `${monthDay(from)}–${monthDay(to)}`;
}

function quoted(texts: readonly string[]): string {
  return texts.map((text) => `„${text}”`).join(', ');
}

/** Where a card import finding sat: `Kedd, d sor`, `Hétfő–Péntek, c sor`, `3. kiemelt ajánlat`. */
function cardPlace(place: CardPlace): string {
  if (place.part === 'featured') {
    return `${place.position}. kiemelt ajánlat`;
  }
  const names = place.days.map((day) => strings.weeklyMenu.days[day]);
  const consecutive = place.days.every((day, i) => i === 0 || day === (place.days[i - 1] ?? 0) + 1);
  const days = consecutive && names.length > 2 ? `${names[0]}–${names.at(-1)}` : names.join(', ');
  return `${days}, ${place.row} sor`;
}
