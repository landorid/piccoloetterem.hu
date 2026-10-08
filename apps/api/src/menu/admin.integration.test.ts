/*
 * The admin menu API against a real database. Runs only when DATABASE_URL is set in the shell
 * (a Neon development branch or a local container that `pnpm db:migrate` has migrated).
 *
 * That database may also serve a deployed development environment, so the tests never truncate:
 * they work in a random week of the 2090s and delete every row they create afterwards. Saving the
 * permanent menu touches every permanent item, so the ones that existed before the run are put
 * back exactly as they were.
 */
import { randomUUID } from 'node:crypto';
import { datesOfIsoWeek, isoDate, type MenuItem, permanentCategories } from '@piccolo/core';
import {
  and,
  closedDates,
  createDb,
  customers,
  eq,
  inArray,
  like,
  menuItems,
  menuSchedule,
  menuWeeks,
  notInArray,
  orderItems,
  orderMenus,
  orders,
  sql,
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

  // A random week of the 2090s, its next two weeks and its Wednesday, all unused: picked in
  // beforeAll, so cleanup can delete them without touching anyone else's rows.
  let isoYear = 0;
  let weekA = 0;
  let weekB = 0;
  let neverSaved = 0;
  let mondayDate = '';
  let sundayDate = '';
  let closedDate = '';

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
  let permanentBefore: (typeof menuItems.$inferSelect)[] = [];
  /** `created_at` / `updated_at` as Postgres prints them: a JS `Date` would drop the microseconds. */
  const stampsBefore = new Map<string, { created: string; updated: string }>();

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
  const sideContent = (name: string) =>
    content(name, { priceWeekday: 750, priceWeekend: null, soupIncluded: false });
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
    for (;;) {
      isoYear = 2090 + Math.floor(Math.random() * 10);
      weekA = 1 + Math.floor(Math.random() * 50);
      weekB = weekA + 1;
      neverSaved = weekA + 2;
      const [monday, , wednesday, , , , sunday] = datesOfIsoWeek(isoYear, weekA, 'Europe/Budapest');
      mondayDate = isoDate(monday);
      sundayDate = isoDate(sunday);
      closedDate = isoDate(wednesday);
      const weeksInUse = await db
        .select({ isoWeek: menuWeeks.isoWeek })
        .from(menuWeeks)
        .where(
          and(
            eq(menuWeeks.isoYear, isoYear),
            inArray(menuWeeks.isoWeek, [weekA, weekB, neverSaved]),
          ),
        );
      const dateInUse = await db
        .select({ date: closedDates.date })
        .from(closedDates)
        .where(eq(closedDates.date, closedDate));
      if (weeksInUse.length === 0 && dateInUse.length === 0) {
        break;
      }
    }

    const existing = await db.select().from(menuItems);
    preexistingItems = new Set(existing.map((row) => row.id));
    permanentBefore = existing.filter((row) =>
      (permanentCategories as readonly string[]).includes(row.category),
    );
    const { rows } = await db.execute<{ id: string; created: string; updated: string }>(
      sql`select id, created_at::text as created, updated_at::text as updated from ${menuItems}`,
    );
    for (const { id, created, updated } of rows) {
      stampsBefore.set(id, { created, updated });
    }
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
      // Responses also list items that were there before the run; those stay. The name check
      // catches an item whose id never reached a response.
      const ours = [...createdItems].filter((id) => !preexistingItems.has(id));
      const named = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(
          and(
            like(menuItems.name, 'M2 teszt%'),
            notInArray(menuItems.id, [...preexistingItems, randomUUID()]),
          ),
        );
      const doomed = [...new Set([...ours, ...named.map((row) => row.id)])];
      if (doomed.length > 0) {
        await db.delete(menuSchedule).where(inArray(menuSchedule.menuItemId, doomed));
        await db.delete(menuItems).where(inArray(menuItems.id, doomed));
      }
      await db.delete(closedDates).where(eq(closedDates.date, closedDate));
      for (const { id, ...row } of permanentBefore) {
        const stamps = stampsBefore.get(id);
        await db
          .update(menuItems)
          .set({
            ...row,
            createdAt: sql`${stamps?.created}::timestamptz`,
            updatedAt: sql`${stamps?.updated}::timestamptz`,
          })
          .where(eq(menuItems.id, id));
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

    const orderId = await placeOrder(mondayDate, [stew, potatoes]);

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
    const [, permanentMenu] = await send('GET', '/items');
    const [permanent] = Object.values(permanentMenu).flat() as MenuItem[];
    if (!permanent) throw new Error('The database has no permanent item to test with');
    const [status, body] = await send('PUT', `/weeks/${isoYear}/${weekA}`, {
      days: {
        ...emptyDays(),
        2: { soups: [], mains: [{ ...content('x'), id: randomUUID() }, stew, stew] },
      },
      featured: [permanent],
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
    expect(purges.toSorted()).toEqual([`${isoYear}/${weekA}`, `${isoYear}/${weekB}`].toSorted());

    // Removed from week B, the item is still on week A and stays active there.
    await send('PUT', `/weeks/${isoYear}/${weekB}`, { days: emptyDays(), featured: [] });
    const [, weekARead] = await send('GET', `/weeks/${isoYear}/${weekA}`);
    expect(weekARead.featured).toEqual([{ ...cheese, soldOut: true }]);
  });

  let steak: MenuItem;

  it('saves the permanent menu in one request: create, rename, reorder, deactivate by omission, reactivate', async () => {
    // Send back what GET returns: valid as it is, and it numbers each section from 0.
    const [, read] = await send('GET', '/items');
    const [, base] = await send('PUT', '/items', read);
    const n = base.sideExtras.length;
    const d = base.desserts.length;
    const writtenAt = async () =>
      db
        .select({ id: menuItems.id, updatedAt: menuItems.updatedAt })
        .from(menuItems)
        .where(inArray(menuItems.id, [...preexistingItems, randomUUID()]));
    const writtenBefore = await writtenAt();
    purges.length = 0;

    // Create: two side extras and a dessert, after what is already there.
    const [status, first] = await send('PUT', '/items', {
      ...base,
      sideExtras: [
        ...base.sideExtras,
        sideContent('M2 teszt steak'),
        sideContent('M2 teszt köret'),
      ],
      desserts: [...base.desserts, sideContent('M2 teszt palacsinta')],
    });
    expect(status).toBe(200);
    expect(purges).toEqual(['all']);
    expect(first.sideExtras.slice(0, n)).toEqual(base.sideExtras);
    expect(first.desserts.slice(0, d)).toEqual(base.desserts);
    let side: MenuItem;
    let pancake: MenuItem;
    [steak, side] = first.sideExtras.slice(n);
    [pancake] = first.desserts.slice(d);
    expect(
      [steak, side, pancake].map((item) => [
        item.name,
        item.category,
        item.active,
        item.soldOut,
        item.sortOrder,
      ]),
    ).toEqual([
      ['M2 teszt steak', 'side_extra', true, false, n],
      ['M2 teszt köret', 'side_extra', true, false, n + 1],
      ['M2 teszt palacsinta', 'dessert', true, false, d],
    ]);
    // Items that did not change were not written.
    expect(await writtenAt()).toEqual(writtenBefore);

    // Rename and reorder the side extras; leave the dessert out.
    const [, second] = await send('PUT', '/items', {
      ...first,
      sideExtras: [...first.sideExtras.slice(0, n), { ...side, name: 'M2 teszt köret 2' }, steak],
      desserts: first.desserts.slice(0, d),
    });
    expect(second.sideExtras.slice(n)).toEqual([
      { ...side, name: 'M2 teszt köret 2', sortOrder: n },
      { ...steak, sortOrder: n + 1 },
    ]);
    steak = { ...steak, sortOrder: n + 1 };
    // Left out is inactive, not deleted.
    expect(second.desserts.slice(d)).toEqual([{ ...pancake, active: false }]);

    // Reactivate the dessert.
    const [, third] = await send('PUT', '/items', {
      ...second,
      desserts: second.desserts.map((item: MenuItem) =>
        item.id === pancake.id ? { ...item, active: true } : item,
      ),
    });
    expect(third.desserts.slice(d)).toEqual([pancake]);

    // One invalid item rejects the whole save, including the valid new dessert.
    purges.length = 0;
    const a = third.allWeek.length;
    const p = third.pickles.length;
    expect(
      await send('PUT', '/items', {
        ...third,
        allWeek: [...third.allWeek, stew],
        desserts: [...third.desserts, sideContent('M2 teszt nem mentett')],
        pickles: [...third.pickles, { ...sideContent('M2 teszt ismeretlen'), id: randomUUID() }],
        sides: [...third.sides, steak],
        sideExtras: [
          ...third.sideExtras.slice(0, n),
          { ...third.sideExtras[n], priceWeekday: -1 },
          steak,
        ],
      }),
    ).toEqual([
      400,
      {
        error: 'validation',
        fields: {
          [`allWeek.${a}.id`]: 'weekly_item',
          [`pickles.${p}.id`]: 'unknown_item',
          [`sideExtras.${n}.priceWeekday`]: 'negative',
          [`sideExtras.${n + 1}.id`]: 'duplicate',
        },
      },
    ]);
    expect(await send('GET', '/items')).toEqual([200, third]);
    expect(purges).toEqual([]);
  });

  it('marks a permanent item sold out and purges every week', async () => {
    const [status, body] = await send('POST', `/items/${steak.id}/sold-out`, { soldOut: true });
    expect([status, body.item]).toEqual([200, { ...steak, soldOut: true }]);
    expect(purges).toEqual(['all']);
  });

  it('keeps one new item when two saves of the permanent menu are in flight', async () => {
    const [, read] = await send('GET', '/items');
    const payload = { ...read, pickles: [...read.pickles, sideContent('M2 teszt dupla')] };
    const results = await Promise.all([
      send('PUT', '/items', payload),
      send('PUT', '/items', payload),
    ]);
    expect(results.map(([status]) => status)).toEqual([200, 200]);
    const active = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.name, 'M2 teszt dupla'), eq(menuItems.active, true)));
    expect(active).toHaveLength(1);
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

    const range = `from=${mondayDate}&to=${sundayDate}`;
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
