import type { RestaurantConfig } from './types';

/**
 * Piccolo Club Étterem, Szombathely. Do not import this file directly; use `loadConfig`.
 *
 * Values are confirmed with the restaurant in issue #41. Until then the extras' prices,
 * `messages.emptyWeek`, `contact.openingHours` and `contact.intakeWindow` are placeholders taken
 * from the O2 mockup (docs/design/megrendeles/strings.md).
 */
export const piccolo: RestaurantConfig = {
  name: 'Piccolo Club Étterem',
  timezone: 'Europe/Budapest',
  cutoff: '09:30',
  operatingDays: [1, 2, 3, 4, 5, 6],
  lastSameWeekOrderDay: 5,
  allergenNotice: 'Ételeink tartalmazhatnak allergén nyersanyagokat!',
  pricing: {
    noSoupDiscount: 100,
    soupPrice: 650,
    deliveryFee: 150,
    minimumOrder: 2200,
  },
  extras: [
    { key: 'doboz', name: 'Doboz', price: 100 },
    { key: 'kenyer', name: 'Kenyér', price: 50 },
    { key: 'ketchup', name: 'Ketchup', price: 400 },
    { key: 'tartarmartas', name: 'Tartármártás', price: 400 },
  ],
  pickupEnabled: false,
  messages: {
    nextWeekNotPublished:
      'A jövő heti menü még nincs feltöltve. Általában vasárnap este kerül fel, ezért nézz vissza vasárnap este vagy hétfő reggel.',
    emptyWeek:
      'Amint elkészül a heti menü, itt azonnal látni fogod. Telefonon addig is szívesen segítünk.',
  },
  email: {
    from: 'rendeles@piccoloetterem.hu',
    replyTo: 'info@piccoloetterem.hu',
  },
  contact: {
    address: '9700 Szombathely, Mátyás Király utca 12.',
    phone: '+36 30 490 1122',
    openingHours: 'Hétfő–szombat 11:00–16:00',
    intakeWindow: { from: '07:30', until: '09:30' },
  },
  // Hungarian public holidays: Jan 1, Mar 15, Good Friday, Easter Monday, May 1, Whit Monday,
  // Aug 20, Oct 23, Nov 1, Dec 25–26.
  holidays: [
    '2026-01-01',
    '2026-03-15',
    '2026-04-03',
    '2026-04-06',
    '2026-05-01',
    '2026-05-25',
    '2026-08-20',
    '2026-10-23',
    '2026-11-01',
    '2026-12-25',
    '2026-12-26',
    '2027-01-01',
    '2027-03-15',
    '2027-03-26',
    '2027-03-29',
    '2027-05-01',
    '2027-05-17',
    '2027-08-20',
    '2027-10-23',
    '2027-11-01',
    '2027-12-25',
    '2027-12-26',
  ],
};
