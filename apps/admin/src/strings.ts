/**
 * Every user-facing string of the admin. Hungarian, never inlined into a
 * component (see AGENTS.md).
 */
export const strings = {
  appName: 'Piccolo admin',
  heading: 'Admin — hamarosan',
  signOut: 'Kijelentkezés',
  loading: 'Betöltés…',
  noAccessTitle: 'Nincs hozzáférés',
  noAccessBody:
    'Ez a fiók nem tagja az étterem személyzetének. Ha ez tévedés, kérj meghívót az üzemeltetőtől.',
  apiUnreachable: 'Az API most nem érhető el.',
  signedIn: 'Bejelentkezve.',
} as const;
