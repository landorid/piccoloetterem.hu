/*
 * `GET /api/menu` against a real database, with the admin menu routes purging the same cache.
 * Runs only when DATABASE_URL is set in the shell (a Neon development branch or a local container
 * that `pnpm db:migrate` has migrated).
 *
 * That database may also serve a deployed development environment, so the test never truncates:
 * it works in two random unused weeks of the 2090s, with the clock set inside them, and deletes
 * every row it creates afterwards. It does not touch permanent items.
 */
import { datesOfIsoWeek, isoDate, type MenuItem } from '@piccolo/core';
import {
  and,
  closedDates,
  createDb,
  eq,
  inArray,
  menuItems,
  menuSchedule,
  menuWeeks,
} from '@piccolo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from './admin.routes';
import { kvMenuCache } from './cache';
import { memoryKv } from './memoryKv';
import { publicMenuRoutes } from './public.routes';

const url = process.env.DATABASE_URL;
const tz = 'Europe/Budapest';
const hour = 60 * 60 * 1000;

describe.skipIf(!url)('GET /api/menu against DATABASE_URL', () => {
  const db = createDb(url ?? '');

  // Picked in beforeAll: a random week of the 2090s and the next one, both without a row, and
  // the first week's Wednesday, not closed.
  let isoYear = 0;
  let weekA = 0;
  let weekB = 0;
  let datesA: string[] = [];
  let datesB: string[] = [];
  let tuesdayMorning = new Date(0);
  let fridayAfterCutoff = new Date(0);

  let now = new Date(0);
  const kv = memoryKv();
  const cache = kvMenuCache(kv);
  const api = new Hono<AppEnv>()
    .route(
      '/menu',
      publicMenuRoutes(
        () => cache,
        () => now,
      ),
    )
    .route(
      '/admin/menu',
      adminMenuRoutes(() => cache),
    );
  api.onError(handleError);
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const env = { DATABASE_URL: url, RESTAURANT: 'piccolo', MENU_CACHE: kv };

  const createdItems = new Set<string>();

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

  /** `GET /menu…` → status, body, `X-Db-Queries`, `ETag`. */
  async function getMenu(query = '', headers: Record<string, string> = {}) {
    const res = await api.request(`/menu${query}`, { headers }, env, ctx);
    return {
      status: res.status,
      body: res.status === 304 ? null : await res.json(),
      queries: res.headers.get('x-db-queries'),
      etag: res.headers.get('etag'),
    };
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
  const soupContent = (name: string) =>
    content(name, { priceWeekday: 0, priceWeekend: null, soupIncluded: false });
  const emptyDays = () =>
    Object.fromEntries([1, 2, 3, 4, 5, 6].map((day) => [day, { soups: [], mains: [] }]));

  /** Saves a week through the admin route and remembers the items it created. */
  async function saveWeek(isoWeek: number, body: unknown) {
    const [status, week] = await send('PUT', `/admin/menu/weeks/${isoYear}/${isoWeek}`, body);
    expect(status).toBe(200);
    for (const day of Object.values(week.days) as { soups: MenuItem[]; mains: MenuItem[] }[]) {
      for (const item of [...day.soups, ...day.mains]) {
        createdItems.add(item.id);
      }
    }
    for (const item of week.featured as MenuItem[]) {
      createdItems.add(item.id);
    }
    return week;
  }

  beforeAll(async () => {
    for (;;) {
      isoYear = 2090 + Math.floor(Math.random() * 10);
      weekA = 1 + Math.floor(Math.random() * 50);
      weekB = weekA + 1;
      const weekDates = (isoWeek: number) =>
        datesOfIsoWeek(isoYear, isoWeek, tz)
          .slice(0, 6)
          .map((date) => isoDate(date));
      datesA = weekDates(weekA);
      datesB = weekDates(weekB);
      const weeksInUse = await db
        .select({ isoWeek: menuWeeks.isoWeek })
        .from(menuWeeks)
        .where(and(eq(menuWeeks.isoYear, isoYear), inArray(menuWeeks.isoWeek, [weekA, weekB])));
      const datesInUse = await db
        .select({ date: closedDates.date })
        .from(closedDates)
        .where(inArray(closedDates.date, [...datesA, ...datesB]));
      if (weeksInUse.length === 0 && datesInUse.length === 0) {
        break;
      }
    }
    const [, tuesday, , , friday] = datesOfIsoWeek(isoYear, weekA, tz);
    tuesdayMorning = new Date(tuesday.getTime() + 8 * hour);
    fridayAfterCutoff = new Date(friday.getTime() + 9.5 * hour + 60_000);
  });

  afterAll(async () => {
    try {
      const testWeeks = (table: typeof menuSchedule | typeof menuWeeks) =>
        and(eq(table.isoYear, isoYear), inArray(table.isoWeek, [weekA, weekB]));
      await db.delete(menuSchedule).where(testWeeks(menuSchedule));
      await db.delete(menuWeeks).where(testWeeks(menuWeeks));
      if (createdItems.size > 0) {
        await db.delete(menuItems).where(inArray(menuItems.id, [...createdItems]));
      }
      await db.delete(closedDates).where(inArray(closedDates.date, [...datesA, ...datesB]));
    } finally {
      await Promise.all(pending);
      await db.$client.end();
    }
  });

  let stew: MenuItem;

  it('caches an unpublished current week: closed, then no query', async () => {
    now = tuesdayMorning;
    const week = await saveWeek(weekA, {
      days: {
        ...emptyDays(),
        1: { soups: [soupContent('M3 teszt gulyásleves')], mains: [content('M3 teszt pörkölt')] },
        2: { soups: [], mains: [content('M3 teszt rakott krumpli')] },
      },
      featured: [content('M3 teszt rántott sajt', { soupIncluded: false })],
    });
    [stew] = week.days[1].mains;

    expect(await getMenu()).toMatchObject({ status: 200, body: { state: 'closed' }, queries: '1' });
    expect(await getMenu()).toMatchObject({ status: 200, body: { state: 'closed' }, queries: '0' });
    expect(await getMenu(`?week=${isoYear}-W${String(weekA).padStart(2, '0')}`)).toMatchObject({
      status: 404,
      body: { error: 'week_not_published' },
      queries: '0',
    });
  });

  it('shows the week once it is published: four queries, then none, then 304', async () => {
    const [status] = await send('POST', `/admin/menu/weeks/${isoYear}/${weekA}/publish`);
    expect(status).toBe(200);

    const first = await getMenu();
    expect(first).toMatchObject({
      status: 200,
      queries: '4',
      body: {
        state: 'open',
        orderableDates: datesA.slice(1),
        closedDates: [],
        menu: {
          isoYear,
          isoWeek: weekA,
          days: {
            1: {
              date: datesA[0],
              soups: [{ name: 'M3 teszt gulyásleves' }],
              mains: [{ name: 'M3 teszt pörkölt', soldOut: false }],
            },
            2: { mains: [{ name: 'M3 teszt rakott krumpli' }] },
          },
          featured: [{ name: 'M3 teszt rántott sajt' }],
        },
      },
    });

    const second = await getMenu();
    expect(second).toMatchObject({ status: 200, queries: '0', etag: first.etag });
    expect(second.body).toEqual(first.body);
    expect(await getMenu('', { 'If-None-Match': first.etag ?? '' })).toMatchObject({
      status: 304,
      queries: '0',
      etag: first.etag,
    });
  });

  it('shows a sold-out toggle on the next request', async () => {
    const before = await getMenu();
    const [status] = await send('POST', `/admin/menu/items/${stew.id}/sold-out`, {
      soldOut: true,
    });
    expect(status).toBe(200);

    const after = await getMenu('', { 'If-None-Match': before.etag ?? '' });
    expect(after).toMatchObject({
      status: 200,
      queries: '4',
      body: { menu: { days: { 1: { mains: [{ name: 'M3 teszt pörkölt', soldOut: true }] } } } },
    });
    expect(after.etag).not.toBe(before.etag);
  });

  it('moves a date closed after the week was cached from orderable to closed', async () => {
    const [status] = await send('POST', '/admin/menu/closed-dates', { date: datesA[2] });
    expect(status).toBe(200);
    expect(await getMenu()).toMatchObject({
      queries: '4',
      body: {
        orderableDates: [datesA[1], datesA[3], datesA[4], datesA[5]],
        closedDates: [datesA[2]],
      },
    });
  });

  it('rolls over after the Friday cutoff: not published, then published', async () => {
    now = fridayAfterCutoff;
    expect(await getMenu()).toEqual({
      status: 200,
      body: { state: 'next_week_not_published' },
      queries: '1',
      etag: expect.any(String),
    });
    expect(await getMenu()).toMatchObject({ queries: '0' });

    await saveWeek(weekB, {
      days: { ...emptyDays(), 3: { soups: [], mains: [content('M3 teszt lecsó')] } },
      featured: [],
    });
    const [status] = await send('POST', `/admin/menu/weeks/${isoYear}/${weekB}/publish`);
    expect(status).toBe(200);
    expect(await getMenu()).toMatchObject({
      queries: '4',
      body: {
        state: 'open',
        orderableDates: datesB,
        menu: { isoWeek: weekB, days: { 3: { mains: [{ name: 'M3 teszt lecsó' }] } } },
      },
    });
  });
});
