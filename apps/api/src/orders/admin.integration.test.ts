/*
 * `/api/admin/orders` against a real database, without `requireStaff`. Runs only when
 * DATABASE_URL is set in the shell, to a database `pnpm db:migrate` has migrated (the delivery
 * list needs migration 0001's `natural_sort`).
 *
 * That database may also serve a deployed development environment, so the test never truncates:
 * it writes its orders straight into a random week of the 2070s that has none (the other
 * integration tests use the 2090s), under one customer of its own, and deletes all of it
 * afterwards.
 */
import { datesOfIsoWeek, isoDate, type OrderStatus, type Slot } from '@piccolo/core';
import {
  createDb,
  customers,
  eq,
  inArray,
  like,
  orderExtras,
  orderItems,
  orderMenus,
  orders,
} from '@piccolo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleError } from '../app';
import type { AppEnv } from '../env';
import { adminOrderRoutes } from './admin.routes';

const url = process.env.DATABASE_URL;
const tz = 'Europe/Budapest';

interface ItemFixture {
  slot: Slot;
  name: string;
  variation?: string;
  unitPrice: number;
}

interface OrderFixture {
  date: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  fulfilment?: 'delivery' | 'pickup';
  status?: OrderStatus;
  note?: string;
  /** `price` defaults to the sum of the items. */
  menus: { price?: number; items: ItemFixture[] }[];
  extras?: { key: string; name: string; quantity: number; unitPrice: number }[];
  submissionId?: string;
  createdAt?: Date;
}

describe.skipIf(!url)('/api/admin/orders against DATABASE_URL', () => {
  const db = createDb(url ?? '');
  // Letters only, so no search for digits can find the run's e-mail addresses.
  const run = Array.from({ length: 8 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
  const emailPrefix = `s1-test-${run}-`;
  let customerId = '';
  /** Monday … Sunday of the week, `YYYY-MM-DD`. Sunday never gets an order. */
  let dates: string[] = [];

  const api = new Hono<AppEnv>().route('/admin/orders', adminOrderRoutes());
  api.onError(handleError);
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const env = { DATABASE_URL: url, RESTAURANT: 'piccolo', ENVIRONMENT: 'development' };

  // biome-ignore lint/suspicious/noExplicitAny: response bodies are checked by the assertions
  async function send(method: string, path: string, body?: unknown): Promise<[number, any]> {
    const res = await api.request(
      `/admin/orders${path}`,
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

  /** Inserts the orders as O3 stores them, in four statements; returns their ids in order. */
  async function insertOrders(fixtures: OrderFixture[]): Promise<string[]> {
    const orderRows: (typeof orders.$inferInsert)[] = [];
    const menuRows: (typeof orderMenus.$inferInsert)[] = [];
    const itemRows: (typeof orderItems.$inferInsert)[] = [];
    const extraRows: (typeof orderExtras.$inferInsert)[] = [];
    for (const fixture of fixtures) {
      const orderId = crypto.randomUUID();
      let foodSubtotal = 0;
      fixture.menus.forEach((menu, index) => {
        const menuId = crypto.randomUUID();
        const price = menu.price ?? menu.items.reduce((sum, item) => sum + item.unitPrice, 0);
        foodSubtotal += price;
        menuRows.push({ id: menuId, orderId, position: index + 1, price });
        for (const item of menu.items) {
          itemRows.push({ orderMenuId: menuId, menuItemId: null, variation: null, ...item });
        }
      });
      for (const extra of fixture.extras ?? []) {
        foodSubtotal += extra.quantity * extra.unitPrice;
        extraRows.push({ orderId, extraKey: extra.key, ...extra });
      }
      const fulfilment = fixture.fulfilment ?? 'delivery';
      const status = fixture.status ?? 'received';
      const createdAt = fixture.createdAt ?? new Date();
      const deliveryFee = fulfilment === 'delivery' ? 150 : 0;
      orderRows.push({
        id: orderId,
        submissionId: fixture.submissionId ?? crypto.randomUUID(),
        customerId,
        deliveryDate: fixture.date,
        fulfilment,
        status,
        name: fixture.name ?? 'S1 Teszt Elek',
        phone: fixture.phone ?? '+36301234567',
        email: fixture.email ?? `${emailPrefix}a@example.com`,
        address: fixture.address ?? (fulfilment === 'pickup' ? '' : 'Szombathely, Fő tér 1.'),
        note: fixture.note ?? null,
        foodSubtotal,
        deliveryFee,
        total: foodSubtotal + deliveryFee,
        createdAt,
        processedAt: status === 'processed' ? createdAt : null,
        cancelledAt: status === 'cancelled' ? createdAt : null,
      });
    }
    await db.insert(orders).values(orderRows);
    await db.insert(orderMenus).values(menuRows);
    await db.insert(orderItems).values(itemRows);
    if (extraRows.length > 0) {
      await db.insert(orderExtras).values(extraRows);
    }
    return orderRows.map((row) => row.id ?? '');
  }

  beforeAll(async () => {
    for (;;) {
      const isoYear = 2070 + Math.floor(Math.random() * 10);
      const isoWeek = 1 + Math.floor(Math.random() * 51);
      dates = datesOfIsoWeek(isoYear, isoWeek, tz).map((date) => isoDate(date));
      const inUse = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.deliveryDate, dates))
        .limit(1);
      if (inUse.length === 0) {
        break;
      }
    }
    const [customer] = await db
      .insert(customers)
      .values({
        emailKey: `${emailPrefix}a@example.com`,
        email: `${emailPrefix}a@example.com`,
        name: 'S1 Teszt Elek',
        phone: '+36301234567',
        address: 'Szombathely, Fő tér 1.',
        lastOrderAt: new Date(),
      })
      .returning({ id: customers.id });
    customerId = customer?.id ?? '';
  });

  afterAll(async () => {
    try {
      // Menus, items and extras go with their order (on delete cascade).
      if (customerId !== '') {
        await db.delete(orders).where(eq(orders.customerId, customerId));
      }
      await db.delete(customers).where(like(customers.emailKey, `${emailPrefix}%`));
    } finally {
      await db.$client.end();
    }
  });

  const gulyas: ItemFixture = { slot: 'soup', name: 'S1 Gulyás', unitPrice: 0 };
  const porkolt = (variation: string): ItemFixture => ({
    slot: 'main',
    name: 'S1 Pörkölt',
    variation,
    unitPrice: 2190,
  });
  const sajt: ItemFixture = { slot: 'main', name: 'S1 Rántott sajt', unitPrice: 2490 };
  const babgulyas: ItemFixture = { slot: 'soup', name: 'S1 Babgulyás', unitPrice: 0 };
  const rizs: ItemFixture = { slot: 'side', name: 'S1 Rizs', unitPrice: 0 };
  const uborka: ItemFixture = { slot: 'pickle', name: 'S1 Uborka', unitPrice: 350 };
  const palacsinta: ItemFixture = { slot: 'dessert', name: 'S1 Palacsinta', unitPrice: 600 };
  const doboz = { key: 'doboz', name: 'Doboz', unitPrice: 100 };
  const kenyer = { key: 'kenyer', name: 'Kenyér', unitPrice: 50 };

  describe('GET /summary', () => {
    let summaryOrders: string[] = [];

    beforeAll(async () => {
      const submissionId = crypto.randomUUID();
      summaryOrders = await insertOrders([
        // A: 2190 + (2190 − 100) + 2 × 50 = 4380, + 150.
        {
          date: dates[0] ?? '',
          submissionId,
          note: 'Kérem a hátsó bejáratot.',
          menus: [
            { items: [gulyas, porkolt('marha')] },
            { price: 2090, items: [porkolt('sertés')] },
          ],
          extras: [{ ...kenyer, quantity: 2 }],
        },
        // B: (2190 + 350) + (2490 + 0 + 600) + 100 + 50 = 5780, + 150.
        {
          date: dates[0] ?? '',
          status: 'processed',
          menus: [
            { items: [gulyas, porkolt('marha'), uborka] },
            { items: [babgulyas, sajt, rizs, palacsinta] },
          ],
          extras: [
            { ...doboz, quantity: 1 },
            { ...kenyer, quantity: 1 },
          ],
        },
        // C: pickup, the soup alone: 650.
        { date: dates[0] ?? '', fulfilment: 'pickup', menus: [{ price: 650, items: [gulyas] }] },
        // Not counted: cancelled, and another date (A's sibling).
        {
          date: dates[0] ?? '',
          status: 'cancelled',
          menus: [{ items: [porkolt('marha')] }],
          extras: [{ ...doboz, quantity: 5 }],
        },
        { date: dates[1] ?? '', submissionId, menus: [{ items: [sajt] }] },
      ]);
    });

    it('counts the dishes, extras, menus and revenue of the orders not cancelled', async () => {
      const [status, body] = await send('GET', `/summary?date=${dates[0]}`);
      expect(status).toBe(200);
      expect(body).toEqual({
        date: dates[0],
        orderCount: 3,
        menuCount: 5,
        revenue: 4530 + 5930 + 650,
        deliveryCount: 2,
        pickupCount: 1,
        dishes: {
          // Most first: by name, Babgulyás would lead.
          soup: [
            { name: 'S1 Gulyás', variation: null, count: 3 },
            { name: 'S1 Babgulyás', variation: null, count: 1 },
          ],
          main: [
            { name: 'S1 Pörkölt', variation: 'marha', count: 2 },
            { name: 'S1 Pörkölt', variation: 'sertés', count: 1 },
            { name: 'S1 Rántott sajt', variation: null, count: 1 },
          ],
          side: [{ name: 'S1 Rizs', variation: null, count: 1 }],
          pickle: [{ name: 'S1 Uborka', variation: null, count: 1 }],
          dessert: [{ name: 'S1 Palacsinta', variation: null, count: 1 }],
        },
        extras: [
          { key: 'doboz', name: 'Doboz', quantity: 1 },
          { key: 'kenyer', name: 'Kenyér', quantity: 3 },
        ],
      });
    });

    it('is all zeros on a date without orders', async () => {
      const [status, body] = await send('GET', `/summary?date=${dates[6]}`);
      expect(status).toBe(200);
      expect(body).toEqual({
        date: dates[6],
        orderCount: 0,
        menuCount: 0,
        revenue: 0,
        deliveryCount: 0,
        pickupCount: 0,
        dishes: { soup: [], main: [], side: [], pickle: [], dessert: [] },
        extras: [],
      });
    });

    it('GET /:id returns the snapshots, adjustments, totals and the other days', async () => {
      const [a, , , , y] = summaryOrders;
      const [status, body] = await send('GET', `/${a}`);
      expect(status).toBe(200);
      expect(body).toEqual({
        id: a,
        submissionId: expect.any(String),
        customerId,
        deliveryDate: dates[0],
        fulfilment: 'delivery',
        status: 'received',
        name: 'S1 Teszt Elek',
        phone: '+36301234567',
        email: `${emailPrefix}a@example.com`,
        address: 'Szombathely, Fő tér 1.',
        note: 'Kérem a hátsó bejáratot.',
        foodSubtotal: 4380,
        deliveryFee: 150,
        total: 4530,
        createdAt: expect.any(String),
        processedAt: null,
        cancelledAt: null,
        menus: [
          {
            position: 1,
            price: 2190,
            items: [
              { slot: 'soup', name: 'S1 Gulyás', variation: null, unitPrice: 0 },
              { slot: 'main', name: 'S1 Pörkölt', variation: 'marha', unitPrice: 2190 },
            ],
            adjustments: [],
          },
          {
            position: 2,
            price: 2090,
            items: [{ slot: 'main', name: 'S1 Pörkölt', variation: 'sertés', unitPrice: 2190 }],
            adjustments: [{ code: 'no_soup_discount', amount: -100 }],
          },
        ],
        extras: [{ key: 'kenyer', name: 'Kenyér', quantity: 2, unitPrice: 50 }],
        siblings: [{ id: y, deliveryDate: dates[1], status: 'received' }],
      });

      const [, pickup] = await send('GET', `/${summaryOrders[2]}`);
      expect(pickup).toMatchObject({
        fulfilment: 'pickup',
        address: '',
        deliveryFee: 0,
        menus: [{ price: 650, adjustments: [{ code: 'soup_charge', amount: 650 }] }],
        extras: [],
        siblings: [],
      });
    });
  });

  describe('POST /:id/status', () => {
    let received = '';
    let other = '';

    beforeAll(async () => {
      const ids = await insertOrders([
        { date: dates[3] ?? '', note: 'x'.repeat(150), menus: [{ items: [sajt] }] },
        { date: dates[3] ?? '', menus: [{ items: [sajt] }, { items: [gulyas] }] },
      ]);
      received = ids[0] ?? '';
      other = ids[1] ?? '';
    });

    async function stored(id: string) {
      const [row] = await db
        .select({
          status: orders.status,
          processedAt: orders.processedAt,
          cancelledAt: orders.cancelledAt,
        })
        .from(orders)
        .where(eq(orders.id, id));
      return row;
    }

    it('received → processed sets processed_at and returns the list row', async () => {
      const [status, body] = await send('POST', `/${received}/status`, { status: 'processed' });
      expect(status).toBe(200);
      const row = await stored(received);
      expect(row?.status).toBe('processed');
      expect(row?.processedAt).toBeInstanceOf(Date);
      expect(row?.cancelledAt).toBeNull();

      const [, list] = await send('GET', `?date=${dates[3]}`);
      const listed = list.orders.find((order: { id: string }) => order.id === received);
      expect(body).toEqual({ order: listed });
      expect(body.order).toMatchObject({
        status: 'processed',
        processedAt: row?.processedAt?.toISOString(),
        cancelledAt: null,
        menuCount: 1,
        notePreview: `${'x'.repeat(99)}…`,
      });
    });

    it('processed → processed is 409 invalid_transition and changes nothing', async () => {
      const before = await stored(received);
      const [status, body] = await send('POST', `/${received}/status`, { status: 'processed' });
      expect(status).toBe(409);
      expect(body).toEqual({
        error: 'invalid_transition',
        status: 'processed',
        message: expect.any(String),
      });
      expect(await stored(received)).toEqual(before);
    });

    it('processed → cancelled keeps processed_at and sets cancelled_at', async () => {
      const before = await stored(received);
      const [status, body] = await send('POST', `/${received}/status`, { status: 'cancelled' });
      expect(status).toBe(200);
      expect(body.order.status).toBe('cancelled');
      const row = await stored(received);
      expect(row?.processedAt).toEqual(before?.processedAt);
      expect(row?.cancelledAt).toBeInstanceOf(Date);
    });

    it.each(['processed', 'cancelled'])('cancelled → %s is 409', async (to) => {
      const [status, body] = await send('POST', `/${received}/status`, { status: to });
      expect(status).toBe(409);
      expect(body).toMatchObject({ error: 'invalid_transition', status: 'cancelled' });
      expect((await stored(received))?.status).toBe('cancelled');
    });

    it('received → cancelled leaves processed_at empty', async () => {
      const [status, body] = await send('POST', `/${other}/status`, { status: 'cancelled' });
      expect(status).toBe(200);
      expect(body.order).toMatchObject({ id: other, status: 'cancelled', processedAt: null });
      expect(body.order.cancelledAt).toEqual(expect.any(String));
      expect(body.order.menuCount).toBe(2);
    });

    it('is 404 order_not_found for an unknown id', async () => {
      const [status, body] = await send('POST', `/${crypto.randomUUID()}/status`, {
        status: 'cancelled',
      });
      expect(status).toBe(404);
      expect(body).toMatchObject({ error: 'order_not_found' });
    });
  });

  describe('GET / (list and search)', () => {
    let ids: string[] = [];
    const at = (minutes: number) => new Date(Date.UTC(2070, 0, 1, 8, minutes));

    beforeAll(async () => {
      const date = dates[2] ?? '';
      ids = await insertOrders([
        {
          date,
          name: 'S1 Kiss Anna',
          phone: '+36301234567',
          email: `${emailPrefix}anna@example.com`,
          createdAt: at(1),
          menus: [{ items: [sajt] }],
        },
        {
          date,
          name: 'S1 Nagy Béla',
          phone: '+36709876543',
          email: `${emailPrefix}bela@example.com`,
          status: 'processed',
          createdAt: at(2),
          menus: [{ items: [sajt] }, { items: [gulyas] }],
        },
        {
          date,
          name: 'S1 Szabó 100% Kft',
          phone: '+3612345678',
          email: `${emailPrefix}iroda@example.com`,
          fulfilment: 'pickup',
          status: 'cancelled',
          createdAt: at(3),
          menus: [{ items: [sajt] }],
        },
      ]);
    });

    const search = async (query: string) => {
      const [status, body] = await send('GET', `?date=${dates[2]}&${query}`);
      expect(status).toBe(200);
      return body.orders.map((order: { id: string }) => order.id);
    };

    it('lists the date newest first, with every status by default', async () => {
      const [status, body] = await send('GET', `?date=${dates[2]}`);
      expect(status).toBe(200);
      expect(body.nextCursor).toBeNull();
      expect(body.orders.map((order: { id: string }) => order.id)).toEqual([...ids].reverse());
      expect(body.orders[0]).toEqual({
        id: ids[2],
        name: 'S1 Szabó 100% Kft',
        phone: '+3612345678',
        address: '',
        fulfilment: 'pickup',
        status: 'cancelled',
        total: 2490,
        menuCount: 1,
        notePreview: null,
        createdAt: at(3).toISOString(),
        processedAt: null,
        cancelledAt: at(3).toISOString(),
      });
      expect(body.orders[1]).toMatchObject({ id: ids[1], menuCount: 2, total: 2490 + 150 });
    });

    it.each([
      ['06 30 123', [0]],
      ['30/123-45', [0]],
      ['+36 70', [1]],
      ['9876', [1]],
      ['0036 1 234', [2]],
      ['234', [2, 0]],
    ])('finds a partial phone %j', async (q, expected) => {
      expect(await search(`q=${encodeURIComponent(q)}`)).toEqual(expected.map((i) => ids[i]));
    });

    it.each([
      ['kiss', [0]],
      ['  NAGY bé ', [1]],
      ['bela@EXAMPLE', [1]],
      [`${emailPrefix}`, [2, 1, 0]],
      ['100%', [2]],
      ['%', [2]],
      ['_', []],
      ['Kovács', []],
    ])('finds %j in the name or e-mail', async (q, expected) => {
      expect(await search(`q=${encodeURIComponent(q)}`)).toEqual(expected.map((i) => ids[i]));
    });

    it('filters by status, together with the search', async () => {
      expect(await search('status=processed')).toEqual([ids[1]]);
      expect(await search('status=received')).toEqual([ids[0]]);
      expect(await search('status=cancelled&q=S1')).toEqual([ids[2]]);
      expect(await search('status=received&q=9876')).toEqual([]);
    });
  });

  describe('GET / pagination', () => {
    it('pages 205 orders as 200 + 5 by created_at, then id, without gaps or repeats', async () => {
      const date = dates[4] ?? '';
      // Three orders share each timestamp, so the id decides inside a group, and the page ends
      // inside a group: 1 + 66 × 3 = 199 orders, then the first of the next three.
      const fixtures = Array.from({ length: 205 }, (_, i) => ({
        date,
        createdAt: new Date(Date.UTC(2070, 0, 1, 8, Math.floor(i / 3))),
        menus: [{ items: [sajt] }],
      }));
      const ids = await insertOrders(fixtures);
      const created = new Map(ids.map((id, i) => [id, fixtures[i]?.createdAt.getTime() ?? 0]));
      const expected = [...ids].sort(
        (a, b) => (created.get(b) ?? 0) - (created.get(a) ?? 0) || (a < b ? 1 : -1),
      );

      const [status, first] = await send('GET', `?date=${date}`);
      expect(status).toBe(200);
      expect(first.orders).toHaveLength(200);
      expect(first.nextCursor).toBe(first.orders[199].id);
      const [, second] = await send('GET', `?date=${date}&cursor=${first.nextCursor}`);
      expect(second.orders).toHaveLength(5);
      expect(second.nextCursor).toBeNull();
      expect([...first.orders, ...second.orders].map((order: { id: string }) => order.id)).toEqual(
        expected,
      );
    });
  });

  describe('GET /delivery-list', () => {
    it('lists the delivery orders not cancelled, by address in natural order', async () => {
      const date = dates[5] ?? '';
      const [fo10, fo2, ady, arpad, , , fo2b] = await insertOrders([
        { date, address: 'Szombathely, Fő tér 10.', menus: [{ items: [sajt] }] },
        {
          date,
          address: 'szombathely, fo ter 2.',
          note: 'Kapucsengő: 12',
          status: 'processed',
          menus: [{ items: [sajt] }, { items: [gulyas] }],
        },
        { date, address: 'Szombathely, Ady tér 1.', menus: [{ items: [sajt] }] },
        { date, address: 'Szombathely, ÁRPÁD u. 3.', menus: [{ items: [sajt] }] },
        { date, fulfilment: 'pickup', menus: [{ items: [sajt] }] },
        {
          date,
          status: 'cancelled',
          address: 'Szombathely, Fő tér 5.',
          menus: [{ items: [sajt] }],
        },
        { date, address: 'Szombathely, Fő tér 2/B', menus: [{ items: [sajt] }] },
      ]);

      const [status, body] = await send('GET', `/delivery-list?date=${date}`);
      expect(status).toBe(200);
      expect(body.date).toBe(date);
      expect(body.orders.map((order: { id: string }) => order.id)).toEqual([
        ady,
        arpad,
        fo2,
        fo2b,
        fo10,
      ]);
      expect(body.orders[2]).toEqual({
        id: fo2,
        name: 'S1 Teszt Elek',
        phone: '+36301234567',
        address: 'szombathely, fo ter 2.',
        menuCount: 2,
        total: 2490 + 150,
        note: 'Kapucsengő: 12',
        status: 'processed',
      });
    });
  });

  it('GET /:id is 404 order_not_found for an unknown id', async () => {
    const [status, body] = await send('GET', `/${crypto.randomUUID()}`);
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: 'order_not_found' });
  });
});
