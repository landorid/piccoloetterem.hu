import { Hono } from 'hono';
import { hc, type InferResponseType } from 'hono/client';
import { describe, expect, it } from 'vitest';
import { type AppType, app, handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from './admin.routes';
import { noopMenuCache } from './cache';

const id = '00000000-0000-4000-8000-000000000101';

const routes: [method: string, path: string][] = [
  ['GET', '/items'],
  ['PUT', '/items'],
  ['POST', `/items/${id}/sold-out`],
  ['GET', '/weeks/2026/41'],
  ['PUT', '/weeks/2026/41'],
  ['POST', '/weeks/2026/41/publish'],
  ['GET', '/closed-dates?from=2026-10-01&to=2026-10-31'],
  ['POST', '/closed-dates'],
  ['DELETE', '/closed-dates/2026-10-23'],
];

describe('/api/admin/menu through the typed client', () => {
  // A type-level check, enforced by `pnpm typecheck` (tsc compiles the tests): what a GET returns
  // goes straight back into its PUT, with no cast.
  it('accepts a GET result as the body of its PUT', () => {
    const client = hc<AppType>('http://localhost');
    type PermanentMenu = InferResponseType<typeof client.api.admin.menu.items.$get, 200>;
    type Week = InferResponseType<
      (typeof client.api.admin.menu.weeks)[':year'][':week']['$get'],
      200
    >;
    const putBack = (menu: PermanentMenu, week: Week) => [
      client.api.admin.menu.items.$put({ json: menu }),
      client.api.admin.menu.weeks[':year'][':week'].$put({
        param: { year: '2099', week: '10' },
        json: week,
      }),
    ];
    expect(putBack).toBeTypeOf('function');
  });
});

describe('/api/admin/menu without a Clerk session', () => {
  it.each(routes)('%s %s is 401', async (method, path) => {
    const res = await app.request(
      `/api/admin/menu${path}`,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
      },
      {},
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });
});

/*
 * Requests rejected before any query. The database URL points nowhere: the pool connects lazily,
 * so a request that reached the database would fail with a 500 instead of the expected 400.
 */
describe('/api/admin/menu request validation', () => {
  const api = new Hono<AppEnv>().route(
    '/',
    adminMenuRoutes(() => noopMenuCache),
  );
  api.onError(handleError);
  const env = { DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none', RESTAURANT: 'piccolo' };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const send = (method: string, path: string, body?: unknown) =>
    api.request(
      path,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
      ctx,
    );

  const item = {
    category: 'side',
    name: 'Hasábburgonya',
    description: null,
    priceWeekday: 600,
    priceWeekend: null,
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
  };

  const noItems = { allWeek: [], desserts: [], pickles: [], sides: [], sideExtras: [] };

  it.each<[string, string, unknown, Record<string, string>]>([
    ['PUT', '/items', { ...noItems, sideExtras: undefined }, { sideExtras: 'invalid_type' }],
    [
      'PUT',
      '/items',
      { ...noItems, sides: [{ ...item, id: 'nope' }] },
      { 'sides.0.id': 'invalid_format' },
    ],
    ['POST', '/items/not-a-uuid/sold-out', { soldOut: true }, { id: 'invalid_format' }],
    ['POST', `/items/${id}/sold-out`, {}, { soldOut: 'invalid_type' }],
    ['GET', '/weeks/2025/53', undefined, { week: 'custom' }],
    ['GET', '/weeks/2026/0', undefined, { week: 'too_small' }],
    ['PUT', '/weeks/2026/41', { featured: [] }, { days: 'invalid_type' }],
    ['GET', '/closed-dates?from=2026-10-31&to=2026-10-01', undefined, { to: 'custom' }],
    ['POST', '/closed-dates', { date: '2026-02-30' }, { date: 'invalid_format' }],
    ['DELETE', '/closed-dates/tomorrow', undefined, { date: 'invalid_format' }],
  ])('%s %s → 400 by schema', async (method, path, body, fields) => {
    const res = await send(method, path, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields });
  });

  it('rejects a permanent item that breaks a core rule under its path', async () => {
    const res = await send('PUT', '/items', {
      ...noItems,
      desserts: [
        item,
        {
          ...item,
          name: '  ',
          priceWeekday: 12.5,
          allergens: ['gluten', 'paprika'],
          requiresSide: true,
        },
      ],
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'validation',
      fields: {
        'desserts.1.name': 'required',
        'desserts.1.priceWeekday': 'not_integer',
        'desserts.1.allergens': 'invalid',
        'desserts.1.requiresSide': 'not_allowed',
      },
    });
  });

  // Replaced by `PUT /items` (decided by Dávid on 2026-10-08).
  it.each([
    ['POST', '/items'],
    ['PATCH', `/items/${id}`],
    ['POST', `/items/${id}/deactivate`],
    ['POST', '/items/reorder'],
  ])('%s %s no longer exists', async (method, path) => {
    expect((await send(method, path, {})).status).toBe(404);
  });

  it('rejects a week item that breaks a core rule under its path', async () => {
    const day = { soups: [], mains: [] };
    const res = await send('PUT', '/weeks/2026/41', {
      days: {
        1: { soups: [{ ...item, name: 'Gulyásleves', priceWeekday: 650 }], mains: [] },
        2: day,
        3: day,
        4: day,
        5: day,
        6: day,
      },
      featured: [],
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'validation',
      fields: { 'days.1.soups.0.priceWeekday': 'must_be_zero' },
    });
  });
});
