import { Hono } from 'hono';
import { hc, type InferRequestType, type InferResponseType } from 'hono/client';
import { describe, expect, it } from 'vitest';
import { type AppType, handleError } from '../app';
import type { AppEnv } from '../env';
import { memoryKv } from '../menu/memoryKv';
import { publicOrderRoutes } from './public.routes';
import { kvRateLimiter } from './rateLimit';

/*
 * `POST /api/orders` up to the database. The database URL points nowhere: the pool connects
 * lazily, so a request that reached the database would fail with a 500. Everything that touches
 * the database is covered by public.integration.test.ts.
 */

const env = {
  DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
  RESTAURANT: 'piccolo',
  ENVIRONMENT: 'development',
  MENU_CACHE: memoryKv(),
};
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const valid = {
  name: 'Kiss Anna',
  phone: '+36 30 123 4567',
  email: 'anna@example.com',
  address: 'Szombathely, Fő tér 1.',
  days: [
    {
      deliveryDate: '2026-10-06',
      fulfilment: 'delivery',
      menus: [{ soupId: uuid(1), mainId: uuid(2) }],
      extras: [],
    },
  ],
};

function setup() {
  const kv = memoryKv();
  const api = new Hono<AppEnv>().route(
    '/orders',
    publicOrderRoutes({
      limiterFor: () => kvRateLimiter(kv, { limit: 2, windowSeconds: 600 }, 'order-rate:'),
      now: () => new Date('2026-10-06T06:00:00Z'),
    }),
  );
  api.onError(handleError);
  // biome-ignore lint/suspicious/noExplicitAny: response bodies are checked by the assertions
  async function post(body: unknown, headers: Record<string, string> = {}): Promise<[number, any]> {
    const res = await api.request(
      '/orders',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      env,
      ctx,
    );
    const text = await res.text();
    return [res.status, text === '' ? null : JSON.parse(text)];
  }
  return { api, kv, post };
}

describe('POST /api/orders before the database', () => {
  it('answers a filled honeypot with a plausible 200 and does nothing else', async () => {
    const { kv, post } = setup();
    const [status, body] = await post({ ...valid, website: 'https://spam.example' });
    expect(status).toBe(200);
    expect(body).toEqual({ submissionId: expect.any(String), orders: [], grandTotal: 0 });
    // Also with a body that would not validate, and without counting the client.
    const [again] = await post({ website: 'x' }, { 'cf-connecting-ip': '203.0.113.7' });
    expect(again).toBe(200);
    expect(kv.stats.writes).toBe(0);
  });

  it('rejects a body over 64 KB with 413', async () => {
    const { post } = setup();
    const [status, body] = await post({ ...valid, note: 'x'.repeat(70 * 1024) });
    expect(status).toBe(413);
    expect(body).toMatchObject({ error: 'payload_too_large' });
  });

  it('rejects malformed JSON with 400', async () => {
    const { post } = setup();
    const [status, body] = await post('{"name":');
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'bad_request' });
  });

  it('caps days at 7, menus at 30 per day and extras at 20 per day', async () => {
    const { post } = setup();
    const day = valid.days[0];
    const [status, body] = await post({
      ...valid,
      days: [
        { ...day, menus: Array(31).fill({ mainId: uuid(2) }) },
        { ...day, extras: Array(21).fill({ key: 'kenyer', quantity: 1 }) },
        ...Array(6).fill(day),
      ],
    });
    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'validation',
      fields: { days: 'too_big', 'days.0.menus': 'too_big', 'days.1.extras': 'too_big' },
    });
  });

  it('rejects ids that are not UUIDs before they reach a query', async () => {
    const { post } = setup();
    const [status, body] = await post({
      ...valid,
      days: [{ ...valid.days[0], menus: [{ mainId: "1' or '1'='1" }] }],
    });
    expect(status).toBe(400);
    expect(body.fields).toEqual({ 'days.0.menus.0.mainId': 'invalid_format' });
  });

  it('rejects days in different ISO weeks with 400', async () => {
    const { post } = setup();
    const day = valid.days[0];
    const [status, body] = await post({
      ...valid,
      days: [day, { ...day, deliveryDate: '2026-10-12' }],
    });
    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'validation',
      fields: { 'days.1.deliveryDate': 'other_week' },
    });
  });

  it('limits submissions per client IP, counting valid ones only', async () => {
    const { post, kv } = setup();
    const ip = { 'cf-connecting-ip': '203.0.113.7' };
    const otherWeeks = {
      ...valid,
      days: [valid.days[0], { ...valid.days[0], deliveryDate: '2026-10-12' }],
    };
    // A malformed body is not counted.
    expect((await post({ ...valid, days: 'none' }, ip))[0]).toBe(400);
    expect(kv.stats.writes).toBe(0);
    // Valid shapes are, whatever happens to them next.
    expect((await post(otherWeeks, ip))[0]).toBe(400);
    expect((await post(otherWeeks, ip))[0]).toBe(400);
    const [status, body] = await post(otherWeeks, ip);
    expect(status).toBe(429);
    expect(body).toMatchObject({ error: 'rate_limited' });
    // Another address is not limited.
    expect((await post(otherWeeks, { 'cf-connecting-ip': '203.0.113.8' }))[0]).toBe(400);
  });

  it('sends Retry-After with the 429', async () => {
    const { api } = setup();
    const send = () =>
      api.request(
        '/orders',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
          body: JSON.stringify({ ...valid, days: [] }),
        },
        env,
        ctx,
      );
    await send();
    await send();
    const res = await send();
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('600');
  });
});

describe('POST /api/orders through the typed client', () => {
  // Type-level checks, enforced by `pnpm typecheck`.
  it('takes a SubmissionDraft and returns the stored orders', () => {
    const client = hc<AppType>('http://localhost');
    type Body = InferRequestType<typeof client.api.orders.$post>['json'];
    type Created = InferResponseType<typeof client.api.orders.$post, 201>;
    type Conflict = InferResponseType<typeof client.api.orders.$post, 409>;
    const body: Body = valid as Body;
    const read = (created: Created, conflict: Conflict) => [
      created.submissionId,
      created.orders.map((order) => [order.id, order.deliveryDate, order.total]),
      created.grandTotal,
      conflict.error === 'date_closed' ? conflict.dates : conflict.fields,
    ];
    expect(body.days).toHaveLength(1);
    expect(read).toBeTypeOf('function');
  });
});
