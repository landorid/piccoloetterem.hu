/**
 * Every user-facing string of the public site. Hungarian, never inlined into a
 * component or a page (see AGENTS.md).
 *
 * The copy is the O2 handover (docs/design/megrendeles/strings.md). O6 and O7 paste the rest of
 * it as they build the order form and checkout. Restaurant facts (phone, address, opening hours,
 * intake window, prices) come from `GET /api/config/public` and are passed in, never typed here.
 * `TODO(O2)` marks copy the handover does not have.
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
  week: {
    heading: 'Heti menü',
    // TODO(O2): not in the handover.
    loading: 'A heti menü betöltése…',
  },
  dish: {
    soldOut: 'Elfogyott',
  },
  /**
   * The read-only menu listing that proves the menu loads (O5). O6 replaces it with the order
   * form (#34), and the browsable weekly menu gets a page of its own (#58).
   */
  scaffold: {
    // TODO(O2): the handover has no listing; these headings follow the admin's sections.
    soups: 'Levesek',
    mains: 'Főételek',
    featured: 'Kiemelt ajánlat',
    allWeek: 'Egész héten rendelhető',
    sides: 'Köretek',
    sideExtras: 'Feláras köretek',
    pickles: 'Savanyúságok',
    desserts: 'Desszertek',
    soupHint: 'A napi főételek ára tartalmazza a levest.',
    // TODO(O2): not in the handover.
    notOrderable: 'Erre a napra most nem lehet rendelni.',
    weekendPrice: (price: string) => `hétvégén ${price}`,
    variations: (list: string) => `Változatok: ${list}`,
    allergens: (list: string) => `Allergének: ${list}`,
    allergen: (number: number, name: string) => `${number} · ${name}`,
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
    /** `amount` is already grouped by `Intl.NumberFormat('hu-HU')`; see format.ts. */
    forint: (amount: string) => `${amount}\u00a0Ft`,
  },
} as const;
