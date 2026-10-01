import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { app, handleError, parseOrigins } from './app';
import type { AppEnv } from './env';
import { HttpError } from './errors';
import { validate } from './validation';

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const env = { CORS_ORIGINS: 'http://localhost:4321, https://admin.example.hu' };

describe('GET /api/health', () => {
  it('returns 200 without any binding', async () => {
    const res = await app.request('/api/health', {}, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: expect.any(String) });
  });
});

describe('GET /api/health/db', () => {
  it('fails as an internal error when no database is configured', async () => {
    const res = await app.request('/api/health/db', {}, {}, ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal', eventId: expect.any(String) });
  });
});

describe('unknown paths', () => {
  it('returns 404 JSON inside and outside /api, without touching the database', async () => {
    for (const path of ['/api/nope', '/', '/admin']) {
      const res = await app.request(path, {}, {});
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found', message: `No route for ${path}` });
    }
  });
});

describe('CORS', () => {
  it('parses CORS_ORIGINS, trimming blanks', () => {
    expect(parseOrigins(' https://a.hu ,, https://b.hu ')).toEqual([
      'https://a.hu',
      'https://b.hu',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('allows a listed origin', async () => {
    const res = await app.request(
      '/api/health',
      { headers: { Origin: 'https://admin.example.hu' } },
      env,
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('https://admin.example.hu');
  });

  it('sends no CORS headers to any other origin', async () => {
    const res = await app.request(
      '/api/health',
      { headers: { Origin: 'https://evil.example' } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers a preflight from a listed origin with 204', async () => {
    const res = await app.request(
      '/api/orders',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:4321',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type,Authorization');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
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
