import { Hono } from 'hono';
import { hc, type InferResponseType } from 'hono/client';
import { describe, expect, it } from 'vitest';
import { type AppType, app, handleError } from '../app';
import type { AppEnv } from '../env';
import { adminOrderRoutes } from './admin.routes';

const id = '00000000-0000-4000-8000-000000000101';

describe('/api/admin/orders through the typed client', () => {
  // A type-level check, enforced by `pnpm typecheck`: a status change returns the list's row, so
  // the admin can put it in the list as it is.
  it('returns the list row from a status change', () => {
    const orders = hc<AppType>('http://localhost').api.admin.orders;
    type Listed = InferResponseType<typeof orders.$get, 200>['orders'][number];
    type Changed = InferResponseType<(typeof orders)[':id']['status']['$post'], 200>['order'];
    const both = [(row: Listed): Changed => row, (row: Changed): Listed => row];
    expect(both).toHaveLength(2);
  });
});

describe('/api/admin/orders without a Clerk session', () => {
  it.each([
    ['GET', '?date=2026-10-12'],
    ['GET', `?date=2026-10-12&status=received&q=06%2030&cursor=${id}`],
    ['GET', '/summary?date=2026-10-12'],
    ['GET', '/delivery-list?date=2026-10-12'],
    ['GET', '/default-date'],
    ['GET', `/${id}`],
    ['POST', `/${id}/status`],
    ['GET', '/summary'],
  ])('%s %s is 401', async (method, path) => {
    const res = await app.request(
      `/api/admin/orders${path}`,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ status: 'processed' }) : undefined,
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
describe('/api/admin/orders request validation', () => {
  const api = new Hono<AppEnv>().route('/', adminOrderRoutes());
  api.onError(handleError);
  const env = { DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none', RESTAURANT: 'piccolo' };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it.each<[string, string, unknown, Record<string, string>]>([
    ['GET', '/', undefined, { date: 'invalid_type' }],
    ['GET', '/?date=2026-02-30', undefined, { date: 'invalid_format' }],
    ['GET', '/?date=2026-10-12&status=new', undefined, { status: 'invalid_value' }],
    ['GET', `/?date=2026-10-12&q=${'x'.repeat(201)}`, undefined, { q: 'too_big' }],
    ['GET', '/?date=2026-10-12&cursor=2', undefined, { cursor: 'invalid_format' }],
    ['GET', '/summary?date=12.10.2026', undefined, { date: 'invalid_format' }],
    ['GET', '/delivery-list', undefined, { date: 'invalid_type' }],
    ['GET', '/not-a-uuid', undefined, { id: 'invalid_format' }],
    ['POST', '/not-a-uuid/status', { status: 'processed' }, { id: 'invalid_format' }],
    ['POST', `/${id}/status`, { status: 'received' }, { status: 'invalid_value' }],
    ['POST', `/${id}/status`, {}, { status: 'invalid_value' }],
  ])('%s %s → 400 by schema', async (method, path, body, fields) => {
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
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields });
  });

  it.each(['PUT', 'PATCH', 'DELETE'])(
    '%s /:id does not exist: orders are never edited',
    async (method) => {
      const res = await api.request(`/${id}`, { method }, env, ctx);
      expect(res.status).toBe(404);
    },
  );
});

/** The day the order list opens on. Budapest is UTC+2 until 25 October 2026. */
describe('GET /api/admin/orders/default-date', () => {
  const env = { DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none', RESTAURANT: 'piccolo' };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it.each([
    ['Monday before the cutoff', '2026-10-12T09:29:00+02:00', '2026-10-12'],
    ['Monday at the cutoff', '2026-10-12T09:30:00+02:00', '2026-10-13'],
    ['Friday after the cutoff', '2026-10-16T12:00:00+02:00', '2026-10-17'],
    ['Sunday', '2026-10-18T08:00:00+02:00', '2026-10-19'],
  ])('%s → %s', async (_name, at, expected) => {
    const api = new Hono<AppEnv>().route(
      '/',
      adminOrderRoutes(() => new Date(at)),
    );
    api.onError(handleError);

    // The database URL points nowhere: a query would fail with a 500.
    const res = await api.request('/default-date', {}, env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ date: expected });
  });
});
