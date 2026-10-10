import {
  buildPublicMenu,
  loadConfig,
  type MenuItem,
  type PricedSubmission,
  priceSubmission,
  type SubmissionDraft,
} from '@piccolo/core';
import { snapshotOf } from '../orders/submission';
import { groupSubmission, type StoredSubmission } from './submission';

/*
 * One submission for the e-mail preview, the test send and the tests, built the way a real one
 * is: a draft priced by core against a menu, snapshotted by O3's `snapshotOf`, then read back
 * through `groupSubmission`. Two delivery days of ISO week 2026/42 and three menus between them:
 *
 * - Tuesday, menu 1: a soup and a daily main, the soup included in its price.
 * - Tuesday, menu 2: a soup, a featured main that excludes it (the soup charge), its variation and
 *   the side it requires.
 * - Thursday, menu 1: a daily main without its soup (the no-soup discount), a pickle, a dessert.
 *
 * Extras on both days, a note, delivery to a Szombathely address.
 */

const config = loadConfig({ RESTAURANT: 'piccolo' });

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function item(n: number, category: MenuItem['category'], fields: Partial<MenuItem>): MenuItem {
  return {
    id: uuid(n),
    category,
    name: `Étel ${n}`,
    description: null,
    priceWeekday: 0,
    priceWeekend: null,
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
    soldOut: false,
    active: true,
    sortOrder: 0,
    ...fields,
  };
}

const tuesdaySoup = item(1, 'daily_soup', { name: 'Újházi tyúkhúsleves' });
const tuesdayMain = item(2, 'daily_main', {
  name: 'Sertéspörkölt galuskával',
  priceWeekday: 2190,
  priceWeekend: 2390,
  soupIncluded: true,
});
const thursdaySoup = item(3, 'daily_soup', { name: 'Gombakrémleves' });
const thursdayMain = item(4, 'daily_main', {
  name: 'Rántott csirkemell burgonyapürével',
  priceWeekday: 2290,
  soupIncluded: true,
});
const salmon = item(5, 'featured', {
  name: 'Grillezett lazacfilé',
  priceWeekday: 3490,
  variations: ['citromos vajjal', 'fokhagymás tejföllel'],
  requiresSide: true,
});
const rice = item(6, 'side', { name: 'Párolt jázminrizs', priceWeekday: 490 });
const pickle = item(7, 'pickle', { name: 'Csemege uborka', priceWeekday: 350 });
const pancake = item(8, 'dessert', { name: 'Túrós palacsinta', priceWeekday: 690 });

const week = { isoYear: 2026, isoWeek: 42 };
const menu = buildPublicMenu(
  { ...week, publishedAt: new Date('2026-10-08T16:00:00Z') },
  [
    { ...week, day: 2, menuItemId: tuesdaySoup.id, sortOrder: 0 },
    { ...week, day: 2, menuItemId: tuesdayMain.id, sortOrder: 1 },
    { ...week, day: 4, menuItemId: thursdaySoup.id, sortOrder: 0 },
    { ...week, day: 4, menuItemId: thursdayMain.id, sortOrder: 1 },
    { ...week, day: null, menuItemId: salmon.id, sortOrder: 0 },
  ],
  [tuesdaySoup, tuesdayMain, thursdaySoup, thursdayMain, salmon, rice, pickle, pancake],
  config,
);

const draft: SubmissionDraft = {
  name: 'Kovács Anna',
  phone: '06 30 123 4567',
  email: 'kovacs.anna@example.com',
  address: '9700 Szombathely, Fő tér 12. 2. em. 5.',
  note: 'Kérem, a kapucsengőn a 25-öt nyomják.',
  days: [
    {
      deliveryDate: '2026-10-13',
      fulfilment: 'delivery',
      menus: [
        { soupId: tuesdaySoup.id, mainId: tuesdayMain.id },
        {
          soupId: tuesdaySoup.id,
          mainId: salmon.id,
          variation: 'citromos vajjal',
          sideId: rice.id,
        },
      ],
      extras: [
        { key: 'kenyer', quantity: 2 },
        { key: 'doboz', quantity: 2 },
      ],
    },
    {
      deliveryDate: '2026-10-15',
      fulfilment: 'delivery',
      menus: [{ mainId: thursdayMain.id, pickleId: pickle.id, dessertId: pancake.id }],
      extras: [
        { key: 'tartarmartas', quantity: 1 },
        { key: 'doboz', quantity: 1 },
      ],
    },
  ],
};

/** Core's prices for the fixture: what every total of the e-mail must equal. */
export const fixturePriced: PricedSubmission = priceSubmission(draft, menu, config);

let next = 100;
const { submissionId, rows } = snapshotOf(draft, fixturePriced, () => uuid(next++));

/** The fixture as `loadSubmissionForEmail` would read it back, not yet confirmed. */
export const fixtureSubmission: StoredSubmission = groupSubmission(submissionId, {
  orders: rows.orders.map((order) => ({
    id: defined(order.id),
    deliveryDate: order.deliveryDate,
    fulfilment: order.fulfilment,
    name: order.name,
    phone: order.phone,
    email: order.email,
    address: order.address,
    note: order.note ?? null,
    foodSubtotal: order.foodSubtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    confirmationSentAt: null,
  })),
  menus: rows.menus.map((row) => ({ ...row, id: defined(row.id) })),
  items: rows.items.map((row) => ({ ...row, variation: row.variation ?? null })),
  extras: rows.extras,
});

function defined(id: string | undefined): string {
  if (id === undefined) {
    throw new Error('snapshotOf generates every id');
  }
  return id;
}
