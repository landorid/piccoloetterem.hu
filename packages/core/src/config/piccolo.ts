import type { RestaurantConfig } from './types';

/**
 * Piccolo Club Étterem, Szombathely. Do not import this file directly; use `loadConfig`.
 *
 * Values are confirmed with the restaurant in issue #41. Until then the extras' prices,
 * `contact.openingHours` and `contact.intakeWindow` are placeholders taken from the O2 mockup
 * (docs/design/megrendeles/strings.md).
 */
export const piccolo: RestaurantConfig = {
  name: 'Piccolo Club Étterem',
  timezone: 'Europe/Budapest',
  cutoff: '09:30',
  operatingDays: [1, 2, 3, 4, 5, 6],
  lastSameWeekOrderDay: 5,
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
};
