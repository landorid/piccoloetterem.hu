import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { app, handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from './admin.routes';
import { noopMenuCache } from './cache';

const id = '00000000-0000-4000-8000-000000000101';

const routes: [method: string, path: string][] = [
  ['GET', '/items?category=side'],
  ['POST', '/items'],
  ['PATCH', `/items/${id}`],
  ['POST', `/items/${id}/deactivate`],
  ['POST', '/items/reorder'],
  ['POST', `/items/${id}/sold-out`],
  ['GET', '/weeks/2026/41'],
  ['PUT', '/weeks/2026/41'],
  ['POST', '/weeks/2026/41/publish'],
  ['GET', '/closed-dates?from=2026-10-01&to=2026-10-31'],
  ['POST', '/closed-dates'],
  ['DELETE', '/closed-dates/2026-10-23'],
];

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

  it.each<[string, string, unknown, Record<string, string>]>([
    ['GET', '/items?category=daily_main', undefined, { category: 'invalid_value' }],
    ['POST', '/items', { ...item, category: 'daily_soup' }, { category: 'invalid_value' }],
    ['PATCH', '/items/not-a-uuid', {}, { id: 'invalid_format' }],
    ['POST', '/items/reorder', { ids: ['nope'] }, { 'ids.0': 'invalid_format' }],
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

  it('rejects an item that breaks a core rule with the core error codes', async () => {
    const res = await send('POST', '/items', {
      ...item,
      name: '  ',
      priceWeekday: 12.5,
      allergens: ['gluten', 'paprika'],
      requiresSide: true,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'validation',
      fields: {
        name: 'required',
        priceWeekday: 'not_integer',
        allergens: 'invalid',
        requiresSide: 'not_allowed',
      },
    });
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
