import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { app, handleError } from './app';
import type { AppEnv, Bindings } from './env';
import { HttpError } from './errors';
import { handler } from './index';
import { validate } from './validation';

/** An ASSETS binding serving a fixed set of paths, like the built `public/`. */
function fakeAssets(files: Record<string, string>): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL) => {
      const { pathname } = new URL(input instanceof Request ? input.url : input);
      const body = files[pathname];
      return body === undefined ? new Response('', { status: 404 }) : new Response(body);
    },
    connect: () => {
      throw new Error('not used');
    },
  } as unknown as Fetcher;
}

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function serve(path: string, env: Partial<Bindings> = {}) {
  const assets = fakeAssets({
    '/': 'astro index',
    '/megrendeles/': 'astro megrendeles',
    '/admin/': 'admin shell',
    '/admin/assets/app.js': 'admin js',
  });
  return handler.fetch(
    new Request(`http://localhost${path}`),
    { ASSETS: assets, ...env },
    ctx,
  ) as Promise<Response>;
}

describe('Worker routing', () => {
  it('serves static files as they are', async () => {
    const res = await serve('/admin/assets/app.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('admin js');
  });

  it('answers unknown /admin paths with the SPA shell and 200', async () => {
    for (const path of ['/admin/deep/path', '/admin/orders/123']) {
      const res = await serve(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('admin shell');
    }
  });

  it('keeps the asset 404 outside /admin, including look-alike prefixes', async () => {
    for (const path of ['/nonexistent', '/administrator']) {
      expect((await serve(path)).status).toBe(404);
    }
  });

  it('sends /api paths to Hono, never to the assets', async () => {
    const res = await serve('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found', message: 'No route for /api/nope' });
  });
});

describe('GET /api/health', () => {
  it('returns 200 without any binding', async () => {
    const res = await app.request('/api/health', {}, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: expect.any(String) });
  });
});

describe('GET /api/health/db', () => {
  it('fails as an internal error when no database is configured', async () => {
    const res = await app.request('/api/health/db', {}, { RESTAURANT: 'piccolo' }, ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal', eventId: expect.any(String) });
  });
});

describe('error shapes', () => {
  const test = new Hono<AppEnv>()
    .post('/items', validate('json', z.object({ name: z.string(), qty: z.number().int() })), (c) =>
      c.json(c.req.valid('json')),
    )
    .get('/gone', () => {
      throw new HttpError(410, 'week_closed', 'The week is closed');
    });
  test.onError(handleError);

  it('renders validation failures as 400 { error, fields }', async () => {
    const res = await test.request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qty: 1.5 }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'validation',
      fields: { name: 'invalid_type', qty: 'invalid_type' },
    });
  });

  it('renders HttpError as { error: code, message }', async () => {
    const res = await test.request('/gone');
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'week_closed', message: 'The week is closed' });
  });

  it('renders a malformed JSON body as 400 bad_request', async () => {
    const res = await test.request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'bad_request' });
  });
});
