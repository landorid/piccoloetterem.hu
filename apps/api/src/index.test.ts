import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { app, handleError, parseOrigins } from './app';
import type { AppEnv } from './env';
import { HttpError } from './errors';
import { validate } from './validation';

const { authenticateRequest, createClerkClient } = vi.hoisted(() => {
  const authenticateRequest = vi.fn(async (request: Request) => {
    const authorization = request.headers.get('authorization');
    if (authorization === 'Bearer member') {
      return {
        isAuthenticated: true as const,
        toAuth: () => ({ userId: 'user_member', orgId: 'org_piccolo' }),
      };
    }
    if (authorization === 'Bearer stranger') {
      return {
        isAuthenticated: true as const,
        toAuth: () => ({ userId: 'user_stranger', orgId: 'org_other' }),
      };
    }
    if (authorization === 'Bearer no-org') {
      return {
        isAuthenticated: true as const,
        toAuth: () => ({ userId: 'user_no_org', orgId: undefined }),
      };
    }
    return {
      isAuthenticated: false as const,
      toAuth: () => ({ userId: null, orgId: null }),
    };
  });
  return {
    authenticateRequest,
    createClerkClient: vi.fn(() => ({ authenticateRequest })),
  };
});

vi.mock('@clerk/backend', () => ({ createClerkClient }));

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const env = { CORS_ORIGINS: 'http://localhost:4321, https://admin.example.hu' };

const staffEnv = {
  ...env,
  CLERK_SECRET_KEY: 'sk_test_example',
  CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_ORG_ID: 'org_piccolo',
  CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173',
};

describe('GET /api/admin/ping', () => {
  beforeEach(() => {
    authenticateRequest.mockClear();
    createClerkClient.mockClear();
  });

  it('returns 401 when there is no session, without calling Clerk', async () => {
    const res = await app.request('/api/admin/ping', {}, staffEnv);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(createClerkClient).not.toHaveBeenCalled();
  });

  it('verifies a presented bearer token with authenticateRequest', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer nope' } },
      staffEnv,
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(createClerkClient).toHaveBeenCalledWith({
      secretKey: 'sk_test_example',
      publishableKey: 'pk_test_example',
    });
    expect(authenticateRequest).toHaveBeenCalledWith(expect.any(Request), {
      authorizedParties: ['http://localhost:5173'],
      acceptsToken: 'session_token',
    });
  });

  it('returns 401 for an unknown admin path without a session', async () => {
    const res = await app.request('/api/admin/nope', {}, staffEnv);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('returns 404 JSON for an unknown admin path once the session is a member', async () => {
    const res = await app.request(
      '/api/admin/nope',
      { headers: { Authorization: 'Bearer member' } },
      staffEnv,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'not_found',
      message: 'No route for /api/admin/nope',
    });
  });

  it('returns 200 with userId for a member of CLERK_ORG_ID', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer member' } },
      staffEnv,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_member' });
  });

  it('returns 403 when the session belongs to another organization', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer stranger' } },
      staffEnv,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when the session token has no org id', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer no-org' } },
      staffEnv,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when CLERK_ORG_ID is not configured', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer member' } },
      { ...staffEnv, CLERK_ORG_ID: undefined },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('fails closed when CLERK_AUTHORIZED_PARTIES is empty', async () => {
    const res = await app.request(
      '/api/admin/ping',
      { headers: { Authorization: 'Bearer member' } },
      { ...staffEnv, CLERK_AUTHORIZED_PARTIES: '  , ' },
      ctx,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal', eventId: expect.any(String) });
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
