import {
  buildPublicMenu,
  firstOrderableDay,
  isoWeekOf,
  loadConfig,
  type MenuItem,
} from '@piccolo/core';
import { Hono } from 'hono';
import { hc, type InferResponseType } from 'hono/client';
import { describe, expect, it } from 'vitest';
import { type AppType, app, handleError } from '../app';
import type { AppEnv } from '../env';
import { type CachedWeek, kvMenuCache } from './cache';
import { memoryKv } from './memoryKv';
import { publicMenuRoutes } from './public.routes';

/*
 * `GET /api/menu` with every week already in the cache. The database URL points nowhere: the pool
 * connects lazily, so a request that reached the database would fail with a 500. The database
 * path is covered by public.integration.test.ts.
 *
 * ISO week 2026/41 runs from Monday 5 to Sunday 11 October; Budapest is UTC+2 then.
 */

const config = loadConfig({ RESTAURANT: 'piccolo' });
const env = {
  DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
  RESTAURANT: 'piccolo',
  ENVIRONMENT: 'development',
};
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const item = (id: number, category: MenuItem['category'], name: string): MenuItem => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  category,
  name,
  description: null,
  priceWeekday: category === 'daily_soup' ? 0 : 2190,
  priceWeekend: category === 'daily_soup' ? null : 2390,
  variations: [],
  allergens: [],
  soupIncluded: category === 'daily_main',
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
});

const soup = item(1, 'daily_soup', 'Gulyásleves');
const stew = item(2, 'daily_main', 'Pörkölt');
const pickle = item(3, 'pickle', 'Csemegeuborka');

function published(isoWeek: number, closedDates: string[] = [], soldOut = false): CachedWeek {
  return {
    published: true,
    closedDates,
    menu: buildPublicMenu(
      { isoYear: 2026, isoWeek, publishedAt: new Date('2026-10-01T18:00:00Z') },
      [
        { isoYear: 2026, isoWeek, day: 1, menuItemId: soup.id, sortOrder: 0 },
        { isoYear: 2026, isoWeek, day: 1, menuItemId: stew.id, sortOrder: 1 },
      ],
      [soup, { ...stew, soldOut }, pickle],
      config,
    ),
  };
}

const menuOf = (week: CachedWeek) => (week.published ? week.menu : null);

/** The public menu at `at` (ISO, with offset), with `weeks` (`'2026-41'` → week) in the cache. */
async function setup(at: string, weeks: Record<string, CachedWeek>) {
  const kv = memoryKv();
  const cache = kvMenuCache(kv);
  const seed = async (key: string, week: CachedWeek) => {
    const [isoYear, isoWeek] = key.split('-').map(Number);
    await cache.week(isoYear ?? 0, isoWeek ?? 0, async () => week);
  };
  for (const [key, week] of Object.entries(weeks)) {
    await seed(key, week);
  }
  let now = new Date(at);
  const api = new Hono<AppEnv>().route(
    '/',
    publicMenuRoutes(
      () => cache,
      () => now,
    ),
  );
  api.onError(handleError);
  return {
    cache,
    seed,
    setNow(next: string) {
      now = new Date(next);
    },
    get(path = '/', headers: Record<string, string> = {}, overrides: Partial<typeof env> = {}) {
      return api.request(path, { headers }, { ...env, ...overrides, MENU_CACHE: kv }, ctx);
    },
  };
}

describe('GET /api/menu', () => {
  it('is open from tomorrow after the cutoff, to Saturday', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', { '2026-41': published(41) });
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      state: 'open',
      menu: menuOf(published(41)),
      orderableDates: ['2026-10-08', '2026-10-09', '2026-10-10'],
      weekLabel: '2026/41. hét (10.05 – 10.10)',
    });
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{40}"$/);
    expect(res.headers.get('x-db-queries')).toBe('0');
  });

  it('includes today before the cutoff and leaves out closed dates', async () => {
    const { get } = await setup('2026-10-07T09:29:00+02:00', {
      '2026-41': published(41, ['2026-10-09']),
    });
    expect(await (await get()).json()).toMatchObject({
      state: 'open',
      orderableDates: ['2026-10-07', '2026-10-08', '2026-10-10'],
    });
  });

  it('rolls over to next Monday on Saturday when next week is published', async () => {
    const { get } = await setup('2026-10-10T12:00:00+02:00', {
      '2026-41': published(41),
      '2026-42': published(42),
    });
    expect(await (await get()).json()).toEqual({
      state: 'open',
      menu: menuOf(published(42)),
      orderableDates: [
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
        '2026-10-15',
        '2026-10-16',
        '2026-10-17',
      ],
      weekLabel: '2026/42. hét (10.12 – 10.17)',
    });
  });

  it('is next_week_not_published after the Friday cutoff, with no message', async () => {
    const { get } = await setup('2026-10-09T09:31:00+02:00', {
      '2026-41': published(41),
      '2026-42': { published: false },
    });
    expect(await (await get()).json()).toEqual({ state: 'next_week_not_published' });
  });

  it('is closed when the current week is not published', async () => {
    const { get } = await setup('2026-10-07T08:00:00+02:00', { '2026-41': { published: false } });
    expect(await (await get()).json()).toEqual({ state: 'closed' });
  });

  it('is closed when every remaining day of the week is closed', async () => {
    const { get } = await setup('2026-10-09T09:00:00+02:00', {
      '2026-41': published(41, ['2026-10-09', '2026-10-10']),
    });
    expect(await (await get()).json()).toEqual({ state: 'closed' });
  });

  it('leaves X-Db-Queries out in production', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', { '2026-41': published(41) });
    const res = await get('/', {}, { ENVIRONMENT: 'production' });
    expect(res.status).toBe(200);
    expect(res.headers.has('x-db-queries')).toBe(false);
  });
});

describe('GET /api/menu?week=', () => {
  const weeks = {
    '2026-40': published(40),
    '2026-41': published(41),
    '2026-42': { published: false } as const,
  };

  it('is 404 for a week that is not published', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', weeks);
    const res = await get('/?week=2026-W42');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'week_not_published',
      message: 'No published menu for 2026/42',
    });
  });

  it('returns the window week with its orderable dates', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', weeks);
    expect(await (await get('/?week=2026-W41')).text()).toBe(await (await get()).text());
  });

  it('returns another published week with no orderable date', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', weeks);
    expect(await (await get('/?week=2026-W40')).json()).toEqual({
      state: 'open',
      menu: menuOf(published(40)),
      orderableDates: [],
      weekLabel: '2026/40. hét (09.28 – 10.03)',
    });
  });

  it.each([
    ['2026-42', 'invalid_format'],
    ['2026-W4', 'invalid_format'],
    ['2025-W53', 'custom'],
    ['1999-W01', 'custom'],
  ])('rejects week=%s', async (week, code) => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', weeks);
    const res = await get(`/?week=${week}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields: { week: code } });
  });
});

describe('GET /api/menu revalidation', () => {
  it('answers a matching If-None-Match with 304 and no body', async () => {
    const { get } = await setup('2026-10-07T10:00:00+02:00', { '2026-41': published(41) });
    const etag = (await get()).headers.get('etag') ?? '';

    for (const ifNoneMatch of [etag, `W/${etag}`, `"other", ${etag}`]) {
      const res = await get('/', { 'If-None-Match': ifNoneMatch });
      expect(res.status).toBe(304);
      expect(await res.text()).toBe('');
      expect(res.headers.get('etag')).toBe(etag);
      expect(res.headers.get('cache-control')).toBe('no-cache');
      expect(res.headers.get('x-db-queries')).toBe('0');
    }
  });

  it('changes the ETag when the orderable dates change at the cutoff', async () => {
    const { get, setNow } = await setup('2026-10-07T09:29:00+02:00', {
      '2026-41': published(41),
    });
    const before = (await get()).headers.get('etag') ?? '';
    setNow('2026-10-07T09:30:00+02:00');
    const res = await get('/', { 'If-None-Match': before });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).not.toBe(before);
  });

  it('changes the ETag when a purged week comes back different', async () => {
    const { get, cache, seed } = await setup('2026-10-07T10:00:00+02:00', {
      '2026-41': published(41),
    });
    const before = (await get()).headers.get('etag') ?? '';
    await cache.purgeWeek(2026, 41);
    await seed('2026-41', published(41, [], true));
    const res = await get('/', { 'If-None-Match': before });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      menu: { days: { 1: { mains: [{ name: 'Pörkölt', soldOut: true }] } } },
    });
  });
});

describe('GET /api/menu through the app', () => {
  // A type-level check, enforced by `pnpm typecheck`: the typed client sees the route and its
  // three states.
  it('is on the typed client', () => {
    const client = hc<AppType>('http://localhost');
    type Body = InferResponseType<typeof client.api.menu.$get, 200>;
    const state = (body: Body): 'open' | 'next_week_not_published' | 'closed' => body.state;
    const request = () => client.api.menu.$get({ query: { week: '2026-W42' } });
    expect([state, request]).toHaveLength(2);
  });

  it('sends CORS headers on the 200 and on the 304', async () => {
    // Whatever week the real clock is in: seed it as unpublished.
    const kv = memoryKv();
    const { isoYear, isoWeek } = isoWeekOf(firstOrderableDay(new Date(), config));
    await kvMenuCache(kv).week(isoYear, isoWeek, async () => ({ published: false }));
    const appEnv = { ...env, MENU_CACHE: kv, CORS_ORIGINS: 'http://localhost:4321' };
    const origin = { Origin: 'http://localhost:4321' };

    const res = await app.request('/api/menu', { headers: origin }, appEnv, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');
    expect(res.headers.get('vary')).toBe('Origin');

    const again = await app.request(
      '/api/menu',
      { headers: { ...origin, 'If-None-Match': res.headers.get('etag') ?? '' } },
      appEnv,
      ctx,
    );
    expect(again.status).toBe(304);
    expect(again.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');
    expect(again.headers.get('vary')).toBe('Origin');
  });
});
