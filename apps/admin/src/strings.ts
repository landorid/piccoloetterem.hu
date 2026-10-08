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
