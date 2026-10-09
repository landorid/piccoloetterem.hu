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
      nameAndDescription: 'Név és leírás',
      name: 'Név',
      description: 'Leírás',
      priceWeekday: 'Ár hétköznap (Ft)',
      priceWeekend: 'Ár hétvége (Ft)',
      variations: 'Variációk',
      requiresSide: 'Köret kötelező',
      allergens: 'Allergének',
      soldOut: 'Elfogyott',
      active: 'Aktív',
      order: 'Sorrend',
    },
    descriptionPlaceholder: 'Leírás (nem kötelező)',
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
    },
  },
} as const;
