/*
 * `POST /api/orders` against a real database, with the admin menu routes preparing the week.
 * Runs only when DATABASE_URL is set in the shell (a Neon development branch or a local container
 * that `pnpm db:migrate` has migrated).
 *
 * That database may also serve a deployed development environment, so the test never truncates:
 * it works in a random unused week of the 2090s, with the clock set inside it, uses e-mail
 * addresses of its own, and deletes every row it creates afterwards. It does not touch permanent
 * items.
 */
import { datesOfIsoWeek, isoDate, type MenuItem } from '@piccolo/core';
import {
  and,
  asc,
  closedDates,
  createDb,
  customers,
  eq,
  inArray,
  like,
  menuItems,
  menuSchedule,
  menuWeeks,
  orderExtras,
  orderItems,
  orderMenus,
  orders,
} from '@piccolo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from '../menu/admin.routes';
import { noopMenuCache } from '../menu/cache';
import { memoryKv } from '../menu/memoryKv';
import { publicOrderRoutes } from './public.routes';
import { noRateLimit } from './rateLimit';

const url = process.env.DATABASE_URL;
const tz = 'Europe/Budapest';

describe.skipIf(!url)('POST /api/orders against DATABASE_URL', () => {
  const db = createDb(url ?? '');
  const run = crypto.randomUUID().slice(0, 8);
  const emailOf = (who: string) => `o3-test-${run}-${who}@example.com`;

  // Picked in beforeAll: a random week of the 2090s without a row and without closed dates.
  let isoYear = 0;
  let isoWeek = 0;
  /** Monday … Saturday, `YYYY-MM-DD`. */
  let dates: string[] = [];
  let now = new Date(0);

  const events: [submissionId: string, orderIds: string[]][] = [];
  const api = new Hono<AppEnv>()
    .route(
      '/orders',
      publicOrderRoutes({
        now: () => now,
        limiterFor: () => noRateLimit,
        eventsFor: () => ({
          async orderSubmitted(submissionId, orderIds) {
            events.push([submissionId, [...orderIds]]);
          },
        }),
      }),
    )
    .route(
      '/admin/menu',
      adminMenuRoutes(() => noopMenuCache),
    );
  api.onError(handleError);
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const env = {
    DATABASE_URL: url,
    RESTAURANT: 'piccolo',
    ENVIRONMENT: 'development',
    MENU_CACHE: memoryKv(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: response bodies are checked by the assertions
  async function send(method: string, path: string, body?: unknown): Promise<[number, any]> {
    const res = await api.request(
      path,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
      ctx,
    );
    return [res.status, await res.json()];
  }

  const content = (name: string, fields: Partial<MenuItem> = {}) => ({
    name,
    description: null,
    priceWeekday: 2190,
    priceWeekend: 2390,
    variations: [],
    allergens: [],
    soupIncluded: true,
    requiresSide: false,
    ...fields,
  });

  /** The week's items by day (1–6): a soup, a stew with variations, a cheap main, a sold-out one. */
  const menu: Record<number, { soup: MenuItem; stew: MenuItem; cheap: MenuItem; gone: MenuItem }> =
    {};
  let featured: MenuItem;
  const createdItems = new Set<string>();

  beforeAll(async () => {
    for (;;) {
      isoYear = 2090 + Math.floor(Math.random() * 10);
      isoWeek = 1 + Math.floor(Math.random() * 51);
      dates = datesOfIsoWeek(isoYear, isoWeek, tz)
        .slice(0, 6)
        .map((date) => isoDate(date));
      const weeksInUse = await db
        .select({ isoWeek: menuWeeks.isoWeek })
        .from(menuWeeks)
        .where(and(eq(menuWeeks.isoYear, isoYear), eq(menuWeeks.isoWeek, isoWeek)));
      const datesInUse = await db
        .select({ date: closedDates.date })
        .from(closedDates)
        .where(inArray(closedDates.date, dates));
      if (weeksInUse.length === 0 && datesInUse.length === 0) {
        break;
      }
    }
    // Tuesday 08:00: Tuesday to Saturday are orderable, Monday is past.
    const [, tuesday] = datesOfIsoWeek(isoYear, isoWeek, tz);
    now = new Date(tuesday.getTime() + 8 * 60 * 60 * 1000);

    const days = Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((day) => [
        day,
        {
          soups: [
            content(`O3 teszt leves ${day}`, {
              priceWeekday: 0,
              priceWeekend: null,
              soupIncluded: false,
            }),
          ],
          mains: [
            content(`O3 teszt pörkölt ${day}`, { variations: ['sertés', 'marha'] }),
            content(`O3 teszt főzelék ${day}`, { priceWeekday: 2049, priceWeekend: null }),
            content(`O3 teszt elfogyott ${day}`, { priceWeekday: 1990, priceWeekend: null }),
          ],
        },
      ]),
    );
    const [saved, week] = await send('PUT', `/admin/menu/weeks/${isoYear}/${isoWeek}`, {
      days,
      featured: [
        content('O3 teszt rántott sajt', {
          priceWeekday: 2490,
          priceWeekend: 2690,
          soupIncluded: false,
        }),
      ],
    });
    expect(saved).toBe(200);
    for (const day of [1, 2, 3, 4, 5, 6]) {
      const [soup] = week.days[day].soups;
      const [stew, cheap, gone] = week.days[day].mains;
      menu[day] = { soup, stew, cheap, gone };
      for (const item of [soup, stew, cheap, gone]) {
        createdItems.add(item.id);
      }
    }
    [featured] = week.featured;
    createdItems.add(featured.id);

    const [published] = await send('POST', `/admin/menu/weeks/${isoYear}/${isoWeek}/publish`);
    expect(published).toBe(200);
    for (const day of [1, 2, 3, 4, 5, 6]) {
      const [soldOut] = await send('POST', `/admin/menu/items/${menu[day]?.gone.id}/sold-out`, {
        soldOut: true,
      });
      expect(soldOut).toBe(200);
    }
  });

  afterAll(async () => {
    try {
      const testCustomers = await db
        .select({ id: customers.id })
        .from(customers)
        .where(like(customers.emailKey, `o3-test-${run}-%`));
      const ids = testCustomers.map((row) => row.id);
      // Menus, items and extras go with their order (on delete cascade).
      await db.delete(orders).where(like(orders.email, `o3-test-${run}-%`));
      if (ids.length > 0) {
        await db.delete(orders).where(inArray(orders.customerId, ids));
        await db.delete(customers).where(inArray(customers.id, ids));
      }
      await db
        .delete(menuSchedule)
        .where(and(eq(menuSchedule.isoYear, isoYear), eq(menuSchedule.isoWeek, isoWeek)));
      await db
        .delete(menuWeeks)
        .where(and(eq(menuWeeks.isoYear, isoYear), eq(menuWeeks.isoWeek, isoWeek)));
      if (createdItems.size > 0) {
        await db.delete(menuItems).where(inArray(menuItems.id, [...createdItems]));
      }
      await db.delete(closedDates).where(inArray(closedDates.date, dates));
    } finally {
      await Promise.all(pending);
      await db.$client.end();
    }
  });

  const customer = (who: string) => ({
    name: 'O3 Teszt Anna',
    phone: '06 30 123 4567',
    email: emailOf(who),
    address: 'Szombathely, Fő tér 1.',
  });
  function at(day: number) {
    const items = menu[day];
    if (!items) {
      throw new Error(`No items for day ${day}`);
    }
    return items;
  }

  /** Everything stored for one submission, in a stable order. */
  async function stored(submissionId: string) {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.submissionId, submissionId))
      .orderBy(asc(orders.deliveryDate));
    const ids = rows.map((row) => row.id);
    const menus = await db
      .select()
      .from(orderMenus)
      .where(inArray(orderMenus.orderId, ids))
      .orderBy(asc(orderMenus.orderId), asc(orderMenus.position));
    const items = await db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderMenuId,
          menus.map((row) => row.id),
        ),
      );
    const extras = await db.select().from(orderExtras).where(inArray(orderExtras.orderId, ids));
    return { orders: rows, menus, items, extras };
  }

  let firstCustomerId = '';

  it('stores a two-day submission: two orders, one customer, the snapshots', async () => {
    const wed = at(3);
    const sat = at(6);
    const [status, body] = await send('POST', '/orders', {
      ...customer('a'),
      note: ' Kérem a hátsó bejáratot. ',
      days: [
        {
          deliveryDate: dates[2],
          fulfilment: 'delivery',
          menus: [
            { soupId: wed.soup.id, mainId: wed.stew.id, variation: 'marha' },
            { mainId: wed.stew.id, variation: 'sertés' },
          ],
          extras: [{ key: 'kenyer', quantity: 2 }],
        },
        {
          deliveryDate: dates[5],
          fulfilment: 'delivery',
          menus: [
            { soupId: sat.soup.id, mainId: sat.stew.id, variation: 'sertés' },
            { soupId: sat.soup.id, mainId: featured.id },
          ],
          extras: [],
        },
      ],
    });

    // Wednesday: 2190 + (2190 − 100) + 2 × 50; Saturday, weekend prices: 2390 + (2690 + 650).
    expect(status).toBe(201);
    expect(body).toEqual({
      submissionId: expect.any(String),
      orders: [
        { id: expect.any(String), deliveryDate: dates[2], total: 4380 + 150 },
        { id: expect.any(String), deliveryDate: dates[5], total: 5730 + 150 },
      ],
      grandTotal: 4530 + 5880,
    });

    const rows = await stored(body.submissionId);
    expect(rows.orders.map((order) => order.id)).toEqual(
      body.orders.map((order: { id: string }) => order.id),
    );
    const [first] = rows.orders;
    firstCustomerId = first?.customerId ?? '';
    expect(rows.orders).toEqual([
      expect.objectContaining({
        submissionId: body.submissionId,
        deliveryDate: dates[2],
        fulfilment: 'delivery',
        status: 'received',
        name: 'O3 Teszt Anna',
        phone: '+36301234567',
        email: emailOf('a'),
        address: 'Szombathely, Fő tér 1.',
        note: 'Kérem a hátsó bejáratot.',
        foodSubtotal: 4380,
        deliveryFee: 150,
        total: 4530,
        processedAt: null,
        cancelledAt: null,
      }),
      expect.objectContaining({
        submissionId: body.submissionId,
        customerId: firstCustomerId,
        deliveryDate: dates[5],
        foodSubtotal: 5730,
        deliveryFee: 150,
        total: 5880,
      }),
    ]);

    const [wedOrder, satOrder] = body.orders.map((order: { id: string }) => order.id);
    const menuRows = rows.menus.map(({ orderId, position, price }) => ({
      orderId,
      position,
      price,
    }));
    expect(new Set(menuRows.map((row) => JSON.stringify(row)))).toEqual(
      new Set(
        [
          { orderId: wedOrder, position: 1, price: 2190 },
          { orderId: wedOrder, position: 2, price: 2090 },
          { orderId: satOrder, position: 1, price: 2390 },
          { orderId: satOrder, position: 2, price: 3340 },
        ].map((row) => JSON.stringify(row)),
      ),
    );
    const itemsOf = (orderId: string, position: number) => {
      const menuId = rows.menus.find((m) => m.orderId === orderId && m.position === position)?.id;
      return rows.items
        .filter((item) => item.orderMenuId === menuId)
        .map(({ slot, menuItemId, name, variation, unitPrice }) => ({
          slot,
          menuItemId,
          name,
          variation,
          unitPrice,
        }))
        .sort((a, b) => a.slot.localeCompare(b.slot));
    };
    expect(itemsOf(wedOrder, 1)).toEqual([
      {
        slot: 'main',
        menuItemId: wed.stew.id,
        name: 'O3 teszt pörkölt 3',
        variation: 'marha',
        unitPrice: 2190,
      },
      {
        slot: 'soup',
        menuItemId: wed.soup.id,
        name: 'O3 teszt leves 3',
        variation: null,
        unitPrice: 0,
      },
    ]);
    expect(itemsOf(wedOrder, 2)).toEqual([
      {
        slot: 'main',
        menuItemId: wed.stew.id,
        name: 'O3 teszt pörkölt 3',
        variation: 'sertés',
        unitPrice: 2190,
      },
    ]);
    expect(itemsOf(satOrder, 2)).toEqual([
      {
        slot: 'main',
        menuItemId: featured.id,
        name: 'O3 teszt rántott sajt',
        variation: null,
        unitPrice: 2690,
      },
      {
        slot: 'soup',
        menuItemId: sat.soup.id,
        name: 'O3 teszt leves 6',
        variation: null,
        unitPrice: 0,
      },
    ]);
    expect(rows.extras).toEqual([
      expect.objectContaining({
        orderId: wedOrder,
        extraKey: 'kenyer',
        name: 'Kenyér',
        quantity: 2,
        unitPrice: 50,
      }),
    ]);

    const [stored_] = await db.select().from(customers).where(eq(customers.id, firstCustomerId));
    expect(stored_).toMatchObject({
      emailKey: emailOf('a'),
      email: emailOf('a'),
      name: 'O3 Teszt Anna',
      phone: '+36301234567',
      address: 'Szombathely, Fő tér 1.',
    });

    // Told after the commit, with the orders in the order of the days.
    await Promise.all(pending);
    expect(events).toContainEqual([body.submissionId, [wedOrder, satOrder]]);
  });

  it('updates the customer on a repeat with the same e-mail instead of adding one', async () => {
    const [before] = await db.select().from(customers).where(eq(customers.id, firstCustomerId));
    const [status, body] = await send('POST', '/orders', {
      name: 'O3 Teszt Anna Mária',
      phone: '+36 70 765 4321',
      email: `  ${emailOf('a').toUpperCase()} `,
      address: 'Szombathely, Kossuth utca 2.',
      days: [
        {
          deliveryDate: dates[3],
          fulfilment: 'delivery',
          menus: [{ soupId: at(4).soup.id, mainId: at(4).cheap.id }],
          extras: [],
        },
      ],
    });
    expect(status).toBe(201);

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.emailKey, emailOf('a')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: firstCustomerId,
      email: emailOf('a').toUpperCase(),
      name: 'O3 Teszt Anna Mária',
      phone: '+36707654321',
      address: 'Szombathely, Kossuth utca 2.',
    });
    expect(rows[0]?.lastOrderAt.getTime()).toBeGreaterThan(before?.lastOrderAt.getTime() ?? 0);
    const [order] = (await stored(body.submissionId)).orders;
    expect(order?.customerId).toBe(firstCustomerId);
  });

  it('rejects a day past the cutoff with 409 cutoff_passed and stores nothing', async () => {
    const [status, body] = await send('POST', '/orders', {
      ...customer('b'),
      days: [
        {
          deliveryDate: dates[0],
          fulfilment: 'delivery',
          menus: [{ soupId: at(1).soup.id, mainId: at(1).stew.id, variation: 'sertés' }],
          extras: [],
        },
        {
          deliveryDate: dates[1],
          fulfilment: 'delivery',
          menus: [{ mainId: at(2).cheap.id }],
          extras: [],
        },
      ],
    });
    expect(status).toBe(409);
    expect(body).toEqual({
      error: 'validation',
      fields: { 'days.0.deliveryDate': 'cutoff_passed' },
    });
    expect(
      await db
        .select()
        .from(customers)
        .where(eq(customers.emailKey, emailOf('b'))),
    ).toEqual([]);
  });

  it('rejects a sold-out item with 409 sold_out, read from the database', async () => {
    const [status, body] = await send('POST', '/orders', {
      ...customer('b'),
      days: [
        {
          deliveryDate: dates[2],
          fulfilment: 'delivery',
          menus: [{ mainId: at(3).cheap.id }, { soupId: at(3).soup.id, mainId: at(3).gone.id }],
          extras: [],
        },
      ],
    });
    expect(status).toBe(409);
    expect(body).toEqual({ error: 'validation', fields: { 'days.0.menus.1.mainId': 'sold_out' } });
  });

  it('answers 400 when a failure is not cutoff or sold-out, e.g. an item of another day', async () => {
    const [status, body] = await send('POST', '/orders', {
      ...customer('b'),
      days: [
        {
          deliveryDate: dates[2],
          fulfilment: 'delivery',
          menus: [{ mainId: at(4).cheap.id }, { mainId: at(3).gone.id }],
          extras: [],
        },
      ],
    });
    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'validation',
      fields: { 'days.0.menus.0.mainId': 'unknown_item', 'days.0.menus.1.mainId': 'sold_out' },
    });
  });

  it('accepts a delivery day with a food subtotal of 2199, under the minimum (#57)', async () => {
    // 2049 + 3 × 50 = 2199.
    const [status, body] = await send('POST', '/orders', {
      ...customer('c'),
      days: [
        {
          deliveryDate: dates[4],
          fulfilment: 'delivery',
          menus: [{ soupId: at(5).soup.id, mainId: at(5).cheap.id }],
          extras: [{ key: 'kenyer', quantity: 3 }],
        },
      ],
    });
    expect(status).toBe(201);
    expect(body.grandTotal).toBe(2199 + 150);
    const rows = await stored(body.submissionId);
    expect(rows.orders).toEqual([
      expect.objectContaining({ foodSubtotal: 2199, deliveryFee: 150, total: 2349 }),
    ]);
  });

  it('rejects a closed date with 409 date_closed and writes no order and no customer', async () => {
    const [closed] = await send('POST', '/admin/menu/closed-dates', { date: dates[3] });
    expect(closed).toBe(200);
    const ordersBefore = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.deliveryDate, dates[3] ?? ''));

    const [status, body] = await send('POST', '/orders', {
      ...customer('d'),
      days: [
        {
          deliveryDate: dates[2],
          fulfilment: 'delivery',
          menus: [{ mainId: at(3).cheap.id }],
          extras: [],
        },
        {
          deliveryDate: dates[3],
          fulfilment: 'delivery',
          menus: [{ soupId: at(4).soup.id, mainId: at(4).stew.id, variation: 'marha' }],
          extras: [],
        },
      ],
    });
    expect(status).toBe(409);
    expect(body).toEqual({
      error: 'date_closed',
      dates: [dates[3]],
      fields: { 'days.1.deliveryDate': 'date_closed' },
    });
    expect(
      await db
        .select()
        .from(customers)
        .where(eq(customers.emailKey, emailOf('d'))),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(orders)
        .where(eq(orders.email, emailOf('d'))),
    ).toEqual([]);
    // The order stored for that date before it was closed stays (the repeat above).
    expect(
      await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.deliveryDate, dates[3] ?? '')),
    ).toEqual(ordersBefore);
  });
});
