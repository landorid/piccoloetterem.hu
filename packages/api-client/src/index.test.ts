import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient, unwrap } from './index';

function jsonResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('calls baseUrl through the given fetch and headers', async () => {
    const requests: { url: string; authorization: string | null }[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.example.hu',
      headers: async () => ({ Authorization: 'Bearer token' }),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get('authorization'),
        });
        return jsonResponse(200, { ok: true, version: '1.2.3' });
      },
    });

    const health = await unwrap(await client.api.health.$get());

    expect(health).toEqual({ ok: true, version: '1.2.3' });
    expect(requests).toEqual([
      { url: 'https://api.example.hu/api/health', authorization: 'Bearer token' },
    ]);
  });
});

describe('unwrap', () => {
  it('returns the JSON body of a 2xx response', async () => {
    const body = await unwrap(jsonResponse(200, { ok: true, version: '0.0.0' }));
    expect(body).toEqual({ ok: true, version: '0.0.0' });
  });

  it('throws ApiError with validation fields', async () => {
    const response = jsonResponse(400, {
      error: 'validation',
      fields: { 'items.0.quantity': 'too_small' },
    });
    await expect(unwrap(response)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'validation',
      fields: { 'items.0.quantity': 'too_small' },
    });
    await expect(
      unwrap(jsonResponse(400, { error: 'validation', fields: {} })),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('uses the error code and message from the API body', async () => {
    const response = jsonResponse(
      404,
      { error: 'not_found', message: 'No route for /api/missing' },
      'Not Found',
    );
    await expect(unwrap(response)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'No route for /api/missing',
      fields: undefined,
    });
  });

  it('keeps statusText when the body is not JSON', async () => {
    const response = new Response('nope', { status: 502, statusText: 'Bad Gateway' });
    await expect(unwrap(response)).rejects.toMatchObject({
      status: 502,
      code: 'unknown',
      message: 'Bad Gateway',
      fields: undefined,
    });
  });

  it('reads an error code that has no message', async () => {
    const response = jsonResponse(
      500,
      { error: 'internal', eventId: 'evt_1' },
      'Internal Server Error',
    );
    await expect(unwrap(response)).rejects.toMatchObject({
      status: 500,
      code: 'internal',
      message: 'Internal Server Error',
      fields: undefined,
    });
  });

  it('ignores fields that are not a string map', async () => {
    const response = jsonResponse(400, { error: 'validation', fields: { quantity: 1 } });
    await expect(unwrap(response)).rejects.toMatchObject({
      code: 'validation',
      fields: undefined,
    });
  });
});
