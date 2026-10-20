import {
  buildPublicMenu,
  type DayDraft,
  loadConfig,
  type MenuItem,
  priceSubmission,
  type SubmissionDraft,
} from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { itemIdsOf, rejectionOf, snapshotOf, submissionWeek } from './submission';

/*
 * ISO week 2026/41 runs from Monday 5 to Sunday 11 October; 2026/42 starts on Monday 12.
 */

const config = loadConfig({ RESTAURANT: 'piccolo' });
const tz = config.timezone;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const day = (deliveryDate: string, fields: Partial<DayDraft> = {}): DayDraft => ({
  deliveryDate,
  fulfilment: 'delivery',
  menus: [{ mainId: uuid(2) }],
  extras: [],
  ...fields,
});

describe('submissionWeek', () => {
  it('is the ISO week shared by every day', () => {
    expect(submissionWeek({ days: [day('2026-10-05'), day('2026-10-10')] }, tz)).toEqual({
      ok: true,
      isoYear: 2026,
      isoWeek: 41,
    });
  });

  it('marks each day outside the first day’s week', () => {
    const days = [day('2026-10-09'), day('2026-10-12'), day('2026-10-10'), day('2026-10-13')];
    expect(submissionWeek({ days }, tz)).toEqual({
      ok: false,
      fields: { 'days.1.deliveryDate': 'other_week', 'days.3.deliveryDate': 'other_week' },
    });
  });

  it('rejects a date that is not on the calendar, and no days at all', () => {
    expect(submissionWeek({ days: [day('2026-10-05'), day('2026-02-30')] }, tz)).toEqual({
      ok: false,
      fields: { 'days.1.deliveryDate': 'invalid' },
    });
    expect(submissionWeek({ days: [] }, tz)).toEqual({ ok: false, fields: { days: 'required' } });
  });

  it('uses the ISO year at a year boundary', () => {
    // Thursday 2026-12-31 and Friday 2027-01-01 are both in 2026/53.
    expect(submissionWeek({ days: [day('2026-12-31'), day('2027-01-01')] }, tz)).toEqual({
      ok: true,
      isoYear: 2026,
      isoWeek: 53,
    });
  });
});

describe('itemIdsOf', () => {
  it('lists every chosen id once, skipping empty slots', () => {
    const days = [
      day('2026-10-05', {
        menus: [
          { soupId: uuid(1), mainId: uuid(2), pickleId: '' },
          { mainId: uuid(2), sideId: uuid(3), dessertId: uuid(4) },
        ],
      }),
      day('2026-10-06', { menus: [{ soupId: uuid(1), pickleId: uuid(5) }] }),
    ];
    expect(itemIdsOf({ days }).sort()).toEqual([uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)]);
  });
});

describe('rejectionOf', () => {
  const days = [day('2026-10-06'), day('2026-10-07'), day('2026-10-08')];

  it('accepts a submission without errors, also with closed dates elsewhere in the week', () => {
    expect(rejectionOf({ days }, {}, ['2026-10-09'], tz)).toBeNull();
  });

  it('answers 409 when every failure is cutoff_passed or sold_out', () => {
    const fields = {
      'days.0.deliveryDate': 'cutoff_passed',
      'days.1.menus.0.mainId': 'sold_out',
    } as const;
    expect(rejectionOf({ days }, fields, [], tz)).toEqual({
      error: 'validation',
      status: 409,
      fields,
    });
  });

  it('answers 400 when any other code is among them, with every field', () => {
    const fields = {
      'days.0.deliveryDate': 'cutoff_passed',
      phone: 'invalid_phone',
    } as const;
    expect(rejectionOf({ days }, fields, [], tz)).toEqual({
      error: 'validation',
      status: 400,
      fields,
    });
  });

  it('answers date_closed for the closed days alone, before any other code', () => {
    const fields = {
      'days.1.deliveryDate': 'cutoff_passed',
      'days.2.deliveryDate': 'cutoff_passed',
      name: 'required',
    } as const;
    expect(rejectionOf({ days }, fields, ['2026-10-08', '2026-10-07', '2026-10-20'], tz)).toEqual({
      error: 'date_closed',
      dates: ['2026-10-07', '2026-10-08'],
      fields: { 'days.1.deliveryDate': 'date_closed', 'days.2.deliveryDate': 'date_closed' },
    });
  });
});

describe('snapshotOf', () => {
  const item = (n: number, category: MenuItem['category'], fields: Partial<MenuItem>) => ({
    id: uuid(n),
    category,
    name: `Item ${n}`,
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
  });
  const soup = item(1, 'daily_soup', { name: 'Gulyásleves' });
  const stew = item(2, 'daily_main', {
    name: 'Pörkölt',
    priceWeekday: 2190,
    priceWeekend: 2390,
    soupIncluded: true,
    variations: ['sertés', 'marha'],
  });
  const cake = item(4, 'dessert', { name: 'Rétes', priceWeekday: 600 });
  const menu = buildPublicMenu(
    { isoYear: 2026, isoWeek: 41, publishedAt: new Date('2026-10-01T18:00:00Z') },
    [1, 6].flatMap((weekDay) => [
      { isoYear: 2026, isoWeek: 41, day: weekDay as 1 | 6, menuItemId: soup.id, sortOrder: 0 },
      { isoYear: 2026, isoWeek: 41, day: weekDay as 1 | 6, menuItemId: stew.id, sortOrder: 1 },
    ]),
    [soup, stew, cake],
    config,
  );

  const draft: SubmissionDraft = {
    name: '  Kiss Anna ',
    phone: '06 30 123 4567',
    email: ' Anna.Kiss@Example.com ',
    address: ' Szombathely, Fő tér 1. ',
    note: '   ',
    days: [
      {
        deliveryDate: '2026-10-05',
        fulfilment: 'delivery',
        menus: [
          { soupId: soup.id, mainId: stew.id, variation: 'marha' },
          { mainId: stew.id, variation: 'sertés', dessertId: cake.id },
          { soupId: soup.id },
        ],
        extras: [{ key: 'kenyer', quantity: 2 }],
      },
      {
        deliveryDate: '2026-10-10',
        fulfilment: 'pickup',
        menus: [{ soupId: soup.id, mainId: stew.id, variation: 'sertés' }],
        extras: [],
      },
    ],
  };

  let next = 0;
  const snapshot = snapshotOf(draft, priceSubmission(draft, menu, config), () =>
    uuid(900 + next++),
  );

  it('numbers the orders, menus and positions with the ids it generated', () => {
    expect(snapshot.submissionId).toBe(uuid(900));
    expect(snapshot.orderIds).toEqual([uuid(901), uuid(905)]);
    expect(snapshot.rows.menus).toEqual([
      { id: uuid(902), orderId: uuid(901), position: 1, price: 2190 },
      { id: uuid(903), orderId: uuid(901), position: 2, price: 2190 - 100 + 600 },
      { id: uuid(904), orderId: uuid(901), position: 3, price: 650 },
      { id: uuid(906), orderId: uuid(905), position: 1, price: 2390 },
    ]);
  });

  it('copies the trimmed customer fields onto every order, the phone normalised', () => {
    expect(snapshot.rows.customer).toEqual({
      emailKey: 'anna.kiss@example.com',
      email: 'Anna.Kiss@Example.com',
      name: 'Kiss Anna',
      phone: '+36301234567',
      address: 'Szombathely, Fő tér 1.',
    });
    const [monday, saturday] = snapshot.rows.orders;
    expect(monday).toEqual({
      id: uuid(901),
      submissionId: uuid(900),
      deliveryDate: '2026-10-05',
      fulfilment: 'delivery',
      status: 'received',
      name: 'Kiss Anna',
      phone: '+36301234567',
      email: 'Anna.Kiss@Example.com',
      address: 'Szombathely, Fő tér 1.',
      note: null,
      foodSubtotal: 2190 + 2690 + 650 + 100,
      deliveryFee: 150,
      total: 2190 + 2690 + 650 + 100 + 150,
    });
    // Pickup: no address, no fee; the weekend price.
    expect(saturday).toMatchObject({
      deliveryDate: '2026-10-10',
      fulfilment: 'pickup',
      address: '',
      foodSubtotal: 2390,
      deliveryFee: 0,
      total: 2390,
    });
  });

  it('snapshots each item with its own price and the variation', () => {
    expect(snapshot.rows.items).toEqual([
      {
        orderMenuId: uuid(902),
        slot: 'soup',
        menuItemId: soup.id,
        name: 'Gulyásleves',
        variation: null,
        unitPrice: 0,
      },
      {
        orderMenuId: uuid(902),
        slot: 'main',
        menuItemId: stew.id,
        name: 'Pörkölt',
        variation: 'marha',
        unitPrice: 2190,
      },
      {
        orderMenuId: uuid(903),
        slot: 'main',
        menuItemId: stew.id,
        name: 'Pörkölt',
        variation: 'sertés',
        unitPrice: 2190,
      },
      {
        orderMenuId: uuid(903),
        slot: 'dessert',
        menuItemId: cake.id,
        name: 'Rétes',
        variation: null,
        unitPrice: 600,
      },
      {
        orderMenuId: uuid(904),
        slot: 'soup',
        menuItemId: soup.id,
        name: 'Gulyásleves',
        variation: null,
        unitPrice: 0,
      },
      {
        orderMenuId: uuid(906),
        slot: 'soup',
        menuItemId: soup.id,
        name: 'Gulyásleves',
        variation: null,
        unitPrice: 0,
      },
      {
        orderMenuId: uuid(906),
        slot: 'main',
        menuItemId: stew.id,
        name: 'Pörkölt',
        variation: 'sertés',
        unitPrice: 2390,
      },
    ]);
    expect(snapshot.rows.extras).toEqual([
      { orderId: uuid(901), extraKey: 'kenyer', name: 'Kenyér', quantity: 2, unitPrice: 50 },
    ]);
  });

  it('answers with the order of each day and the grand total', () => {
    expect(snapshot.response).toEqual({
      submissionId: uuid(900),
      orders: [
        { id: uuid(901), deliveryDate: '2026-10-05', total: 5780 },
        { id: uuid(905), deliveryDate: '2026-10-10', total: 2390 },
      ],
      grandTotal: 5780 + 2390,
    });
  });
});
