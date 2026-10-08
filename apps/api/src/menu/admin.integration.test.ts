/*
 * The admin menu API against a real database. Runs only when DATABASE_URL is set in the shell
 * (a Neon development branch or a local container that `pnpm db:migrate` has migrated).
 *
 * That database may also serve a deployed development environment, so the tests never truncate:
 * they work in a random week of the 2090s and delete every row they create afterwards, and they
 * restore the sort order of the existing items the reorder test touches.
 */
import { randomUUID } from 'node:crypto';
import { datesOfIsoWeek, isoDate, type MenuItem } from '@piccolo/core';
import {
  and,
  closedDates,
  createDb,
  customers,
  eq,
  inArray,
  menuItems,
  menuSchedule,
  menuWeeks,
  orderItems,
  orderMenus,
  orders,
} from '@piccolo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from './admin.routes';
import type { MenuCache } from './cache';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('admin menu API against DATABASE_URL', () => {
  const db = createDb(url ?? '');

  const isoYear = 2090 + Math.floor(Math.random() * 10);
  const weekA = 1 + Math.floor(Math.random() * 50);
  const weekB = weekA + 1;
  const neverSaved = weekA + 2;
  const [monday, , wednesday, , , , sunday] = datesOfIsoWeek(isoYear, weekA, 'Europe/Budapest');
  const closedDate = isoDate(wednesday);

  const purges: string[] = [];
  const cache: MenuCache = {
    async purgeWeek(year, week) {
      purges.push(`${year}/${week}`);
    },
    async purgeAll() {
      purges.push('all');
    },
  };
  const api = new Hono<AppEnv>().route(
    '/',
    adminMenuRoutes(() => cache),
  );
  api.onError(handleError);
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  // biome-ignore lint/suspicious/noExplicitAny: response bodies are checked by the assertions
  async function send(method: string, path: string, body?: unknown): Promise<[number, any]> {
    const res = await api.request(
      path,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { DATABASE_URL: url, RESTAURANT: 'piccolo' },
      ctx,
    );
    const json = await res.json();
    for (const item of itemsIn(json)) {
      createdItems.add(item.id);
    }
    return [res.status, json];
  }

  // Cleanup bookkeeping.
  let preexistingItems = new Set<string>();
  const createdItems = new Set<string>();
  const createdOrders: string[] = [];
  const createdCustomers: string[] = [];
  let sideExtraOrder: { id: string; sortOrder: number }[] = [];

  /** Every menu item in a response body, so the ones this run created can be deleted. */
  function itemsIn(json: unknown): MenuItem[] {
    if (typeof json !== 'object' || json === null) {
      return [];
    }
    if ('id' in json && 'category' in json) {
      return [json as MenuItem];
    }
    return Object.values(json).flatMap(itemsIn);
  }

  const content = (name: string, fields: Partial<MenuItem> = {}) => ({
    name,
    description: null,
    priceWeekday: 2190,
    priceWeekend: 2390,
    variations: [],
    allergens: ['gluten'],
    soupIncluded: true,
    requiresSide: false,
    ...fields,
  });
  const soupContent = (name: string) =>
    content(name, { priceWeekday: 0, priceWeekend: null, soupIncluded: false });
  const emptyDays = () =>
    Object.fromEntries([1, 2, 3, 4, 5, 6].map((day) => [day, { soups: [], mains: [] }]));

  /** An order for `deliveryDate` with one composed menu holding `items`, snapshotted by name. */
  async function placeOrder(deliveryDate: string, items: MenuItem[]): Promise<string> {
    const [customer] = await db
      .insert(customers)
      .values({
        emailKey: `m2-test-${randomUUID()}@example.invalid`,
        email: 'm2-test@example.invalid',
        name: 'M2 Teszt',
        phone: '+36301234567',
        address: 'Szombathely, Teszt utca 1.',
        lastOrderAt: new Date(),
      })
      .returning({ id: customers.id });
    if (!customer) throw new Error('No customer');
    createdCustomers.push(customer.id);
    const [order] = await db
      .insert(orders)
      .values({
        submissionId: randomUUID(),
        customerId: customer.id,
        deliveryDate,
        fulfilment: 'delivery',
        status: 'received',
        name: 'M2 Teszt',
        phone: '+36301234567',
        email: 'm2-test@example.invalid',
        address: 'Szombathely, Teszt utca 1.',
        foodSubtotal: 4380,
        deliveryFee: 150,
        total: 4530,
      })
      .returning({ id: orders.id });
    if (!order) throw new Error('No order');
    createdOrders.push(order.id);
    const [menu] = await db
      .insert(orderMenus)
      .values({ orderId: order.id, position: 0, price: 4380 })
      .returning({ id: orderMenus.id });
    if (!menu) throw new Error('No order menu');
    await db.insert(orderItems).values(
      items.map((item) => ({
        orderMenuId: menu.id,
        slot: 'main' as const,
        menuItemId: item.id,
        name: item.name,
        variation: null,
        unitPrice: item.priceWeekday,
      })),
    );
    return order.id;
  }

  beforeAll(async () => {
    const existing = await db.select({ id: menuItems.id }).from(menuItems);
    preexistingItems = new Set(existing.map((row) => row.id));
    sideExtraOrder = await db
      .select({ id: menuItems.id, sortOrder: menuItems.sortOrder })
      .from(menuItems)
      .where(eq(menuItems.category, 'side_extra'));
  });

  beforeEach(() => {
    purges.length = 0;
  });

  afterAll(async () => {
    try {
      if (createdOrders.length > 0) {
        // Cascades to order_menus, order_items and order_extras.
        await db.delete(orders).where(inArray(orders.id, createdOrders));
      }
      if (createdCustomers.length > 0) {
        await db.delete(customers).where(inArray(customers.id, createdCustomers));
      }
      const testWeeks = (table: typeof menuSchedule | typeof menuWeeks) =>
        and(eq(table.isoYear, isoYear), inArray(table.isoWeek, [weekA, weekB, neverSaved]));
      await db.delete(menuSchedule).where(testWeeks(menuSchedule));
      await db.delete(menuWeeks).where(testWeeks(menuWeeks));
      // Responses also list items that were there before the run; those stay.
      const ours = [...createdItems].filter((id) => !preexistingItems.has(id));
      if (ours.length > 0) {
        await db.delete(menuSchedule).where(inArray(menuSchedule.menuItemId, ours));
        await db.delete(menuItems).where(inArray(menuItems.id, ours));
      }
      await db.delete(closedDates).where(eq(closedDates.date, closedDate));
      for (const { id, sortOrder } of sideExtraOrder) {
        await db.update(menuItems).set({ sortOrder }).where(eq(menuItems.id, id));
      }
    } finally {
      await Promise.all(pending);
      await db.$client.end();
    }
  });

  let soup: MenuItem;
  let stew: MenuItem;
  let potatoes: MenuItem;
  let cheese: MenuItem;

  it('reads a week without a row as an empty draft', async () => {
    expect(await send('GET', `/weeks/${isoYear}/${neverSaved}`)).toEqual([
      200,
      {
        week: { isoYear, isoWeek: neverSaved, publishedAt: null },
        days: emptyDays(),
        featured: [],
      },
    ]);
  });

  it('upserts a week: renamed items keep their id, removed ones are detached and inactive, order snapshots stay', async () => {
    const [status, first] = await send('PUT', `/weeks/${isoYear}/${weekA}`, {
      days: {
        ...emptyDays(),
        1: {
          soups: [soupContent('M2 teszt gulyásleves')],
          mains: [content('M2 teszt pörkölt'), content('M2 teszt rakott krumpli')],
        },
      },
      featured: [content('M2 teszt rántott sajt', { soupIncluded: false, requiresSide: true })],
    });
    expect(status).toBe(200);
    expect(first.week).toEqual({ isoYear, isoWeek: weekA, publishedAt: null });
    [soup] = first.days[1].soups;
    [stew, potatoes] = first.days[1].mains;
    [cheese] = first.featured;
    expect([soup, stew, potatoes, cheese].map((item) => [item.category, item.active])).toEqual([
      ['daily_soup', true],
      ['daily_main', true],
      ['daily_main', true],
      ['featured', true],
    ]);
    expect(purges).toEqual([`${isoYear}/${weekA}`]);

    const orderId = await placeOrder(isoDate(monday), [stew, potatoes]);

    // Send back what GET returns, edited: rename the stew, drop the potatoes, add the soup on Wed.
    const [, read] = await send('GET', `/weeks/${isoYear}/${weekA}`);
    expect(read).toEqual(first);
    read.days[1].mains = [{ ...stew, name: 'M2 teszt marhapörkölt' }];
    read.days[3].soups = [soup];
    purges.length = 0;

    const [secondStatus, second] = await send('PUT', `/weeks/${isoYear}/${weekA}`, read);
    expect(secondStatus).toBe(200);
    expect(second.days[1].mains).toEqual([{ ...stew, name: 'M2 teszt marhapörkölt' }]);
    expect(second.days[1].soups).toEqual([soup]);
    expect(second.days[3].soups).toEqual([soup]);
    expect(second.featured).toEqual([cheese]);
    expect(purges).toEqual([`${isoYear}/${weekA}`]);

    const schedule = await db
      .select({
        day: menuSchedule.day,
        id: menuSchedule.menuItemId,
        sortOrder: menuSchedule.sortOrder,
      })
      .from(menuSchedule)
      .where(and(eq(menuSchedule.isoYear, isoYear), eq(menuSchedule.isoWeek, weekA)));
    expect(schedule).toHaveLength(4);
    expect(schedule).toEqual(
      expect.arrayContaining([
        { day: 1, id: soup.id, sortOrder: 0 },
        { day: 1, id: stew.id, sortOrder: 0 },
        { day: 3, id: soup.id, sortOrder: 0 },
        { day: null, id: cheese.id, sortOrder: 0 },
      ]),
    );

    const [removed] = await db.select().from(menuItems).where(eq(menuItems.id, potatoes.id));
    expect(removed).toMatchObject({ name: 'M2 teszt rakott krumpli', active: false });

    const snapshots = await db
      .select({ menuItemId: orderItems.menuItemId, name: orderItems.name })
      .from(orderItems)
      .innerJoin(orderMenus, eq(orderItems.orderMenuId, orderMenus.id))
      .where(eq(orderMenus.orderId, orderId));
    expect(snapshots).toEqual(
      expect.arrayContaining([
        { menuItemId: stew.id, name: 'M2 teszt pörkölt' },
        { menuItemId: potatoes.id, name: 'M2 teszt rakott krumpli' },
      ]),
    );
  });

  it('rejects week items that are permanent, unknown or twice in one list', async () => {
    const [, created] = await send('POST', '/items', {
      ...content('M2 teszt állandó', { soupIncluded: false }),
      category: 'all_week',
    });
    const [status, body] = await send('PUT', `/weeks/${isoYear}/${weekA}`, {
      days: {
        ...emptyDays(),
        2: { soups: [], mains: [{ ...content('x'), id: randomUUID() }, stew, stew] },
      },
      featured: [{ ...created.item }],
    });
    expect([status, body]).toEqual([
      400,
      {
        error: 'validation',
        fields: {
          'days.2.mains.0.id': 'unknown_item',
          'days.2.mains.2.id': 'duplicate',
          'featured.0.id': 'not_weekly',
        },
      },
    ]);
  });

  it('publishes a week once: publishing again returns the same published_at', async () => {
    expect(await send('POST', `/weeks/${isoYear}/${neverSaved}/publish`)).toEqual([
      404,
      { error: 'week_not_found', message: expect.any(String) },
    ]);

    const [firstStatus, first] = await send('POST', `/weeks/${isoYear}/${weekA}/publish`);
    expect(firstStatus).toBe(200);
    expect(first.week.publishedAt).toEqual(expect.any(String));
    const [, second] = await send('POST', `/weeks/${isoYear}/${weekA}/publish`);
    expect(second).toEqual(first);
    const [, read] = await send('GET', `/weeks/${isoYear}/${weekA}`);
    expect(read.week.publishedAt).toBe(first.week.publishedAt);
    expect(purges).toEqual([`${isoYear}/${weekA}`, `${isoYear}/${weekA}`]);
  });

  it('marks a weekly item sold out and purges every week it is scheduled on', async () => {
    await send('PUT', `/weeks/${isoYear}/${weekB}`, { days: emptyDays(), featured: [cheese] });
    purges.length = 0;

    const [status, body] = await send('POST', `/items/${cheese.id}/sold-out`, { soldOut: true });
    expect([status, body.item.soldOut]).toEqual([200, true]);
    expect(purges.toSorted()).toEqual([`${isoYear}/${weekA}`, `${isoYear}/${weekB}`]);

    // Removed from week B, the item is still on week A and stays active there.
    await send('PUT', `/weeks/${isoYear}/${weekB}`, { days: emptyDays(), featured: [] });
    const [, weekARead] = await send('GET', `/weeks/${isoYear}/${weekA}`);
    expect(weekARead.featured).toEqual([{ ...cheese, soldOut: true }]);
  });

  it('creates, edits, deactivates and reactivates a permanent item, purging every week', async () => {
    const [status, created] = await send('POST', '/items', {
      ...content('M2 teszt steak', { soupIncluded: false }),
      category: 'side_extra',
    });
    expect(status).toBe(201);
    expect(created.item).toMatchObject({
      category: 'side_extra',
      active: true,
      soldOut: false,
      sortOrder: Math.max(-1, ...sideExtraOrder.map((row) => row.sortOrder)) + 1,
    });
    expect(purges).toEqual(['all']);
    const { id } = created.item;

    const [, patched] = await send('PATCH', `/items/${id}`, {
      name: 'M2 teszt steak 2',
      priceWeekend: null,
    });
    expect(patched.item).toEqual({ ...created.item, name: 'M2 teszt steak 2', priceWeekend: null });

    expect(await send('PATCH', `/items/${id}`, { priceWeekday: -5, variations: [' a'] })).toEqual([
      400,
      { error: 'validation', fields: { priceWeekday: 'negative', variations: 'untrimmed' } },
    ]);
    expect((await send('PATCH', `/items/${soup.id}`, { name: 'x' }))[0]).toBe(404);
    expect((await send('POST', `/items/${soup.id}/deactivate`))[0]).toBe(404);

    const [, deactivated] = await send('POST', `/items/${id}/deactivate`);
    expect(deactivated.item.active).toBe(false);
    const [, listed] = await send('GET', '/items?category=side_extra');
    expect(listed.items.map((item: MenuItem) => item.id)).toContain(id);
    const [, reactivated] = await send('PATCH', `/items/${id}`, { active: true });
    expect(reactivated.item.active).toBe(true);

    purges.length = 0;
    const [, soldOut] = await send('POST', `/items/${id}/sold-out`, { soldOut: true });
    expect(soldOut.item.soldOut).toBe(true);
    expect(purges).toEqual(['all']);
  });

  it('reorders a whole permanent category and nothing less', async () => {
    await send('POST', '/items', {
      ...content('M2 teszt köret', { soupIncluded: false }),
      category: 'side_extra',
    });
    const [, before] = await send('GET', '/items?category=side_extra');
    const reversed: string[] = before.items.map((item: MenuItem) => item.id).toReversed();
    purges.length = 0;

    const [status, after] = await send('POST', '/items/reorder', { ids: reversed });
    expect(status).toBe(200);
    expect(after.items.map((item: MenuItem) => [item.id, item.sortOrder])).toEqual(
      reversed.map((id, index) => [id, index]),
    );
    expect(purges).toEqual(['all']);

    expect(await send('POST', '/items/reorder', { ids: reversed.slice(1) })).toEqual([
      400,
      { error: 'validation', fields: { ids: 'incomplete' } },
    ]);
    expect(await send('POST', '/items/reorder', { ids: [stew.id] })).toEqual([
      400,
      { error: 'validation', fields: { ids: 'weekly_category' } },
    ]);
  });

  it('keeps one schedule when two saves of the same week are in flight', async () => {
    // The race needs a saved week: a new week's row insert already makes the second writer wait.
    await send('PUT', `/weeks/${isoYear}/${weekB}`, { days: emptyDays(), featured: [] });
    const payload = {
      days: emptyDays(),
      featured: [content('M2 teszt dupla mentés', { soupIncluded: false })],
    };
    const results = await Promise.all([
      send('PUT', `/weeks/${isoYear}/${weekB}`, payload),
      send('PUT', `/weeks/${isoYear}/${weekB}`, payload),
    ]);
    expect(results.map(([status]) => status)).toEqual([200, 200]);
    const schedule = await db
      .select({ id: menuSchedule.menuItemId })
      .from(menuSchedule)
      .where(and(eq(menuSchedule.isoYear, isoYear), eq(menuSchedule.isoWeek, weekB)));
    expect(schedule).toHaveLength(1);
    const [, read] = await send('GET', `/weeks/${isoYear}/${weekB}`);
    expect(read.featured.map((item: MenuItem) => item.id)).toEqual(schedule.map((row) => row.id));
  });

  it('closes a date that already has orders without touching them; closing it again is a no-op', async () => {
    const orderId = await placeOrder(closedDate, [stew]);
    const orderBefore = await db.select().from(orders).where(eq(orders.id, orderId));

    expect(await send('POST', '/closed-dates', { date: closedDate })).toEqual([
      200,
      { date: closedDate, created: true },
    ]);
    expect(purges).toEqual([`${isoYear}/${weekA}`]);
    expect(await send('POST', '/closed-dates', { date: closedDate })).toEqual([
      200,
      { date: closedDate, created: false },
    ]);

    const range = `from=${isoDate(monday)}&to=${isoDate(sunday)}`;
    expect(await send('GET', `/closed-dates?${range}`)).toEqual([200, { dates: [closedDate] }]);
    expect(await db.select().from(orders).where(eq(orders.id, orderId))).toEqual(orderBefore);
    const rows = await db.select().from(closedDates).where(eq(closedDates.date, closedDate));
    expect(rows).toHaveLength(1);

    purges.length = 0;
    expect(await send('DELETE', `/closed-dates/${closedDate}`)).toEqual([
      200,
      { date: closedDate, deleted: true },
    ]);
    expect(purges).toEqual([`${isoYear}/${weekA}`]);
    expect(await send('GET', `/closed-dates?${range}`)).toEqual([200, { dates: [] }]);
    expect(await send('DELETE', `/closed-dates/${closedDate}`)).toEqual([
      200,
      { date: closedDate, deleted: false },
    ]);
  });
});
