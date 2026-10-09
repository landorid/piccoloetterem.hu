import { describe, expect, it, vi } from 'vitest';
import { describeLoadError } from '../components/OrderingApp';
import { strings } from '../strings';
import { ApiError, createWebApi, loadMenu, loadPublicConfig, NetworkError } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('loadMenu', () => {
  it('sends a plain GET /api/menu: no headers of its own, the default cache mode', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      json({ state: 'closed' }),
    );
    const api = createWebApi('https://api.example.hu', fetch);

    expect(await loadMenu(api)).toEqual({ state: 'closed' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, init] = fetch.mock.calls[0] ?? [];
    const request = new Request(input as RequestInfo | URL, init);
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.example.hu/api/menu');
    // Anything beyond the safelisted headers would make the browser send a CORS preflight, and
    // `If-None-Match` is not allowed by the API at all: the browser revalidates by itself.
    expect([...request.headers.keys()]).toEqual([]);
    expect(request.cache).toBe('default');
  });

  it('throws ApiError with the API error code', async () => {
    const api = createWebApi('https://api.example.hu', async () =>
      json({ error: 'week_not_published', message: 'No published menu for 2026/41' }, 404),
    );
    await expect(loadMenu(api)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'week_not_published',
    });
  });

  it('throws NetworkError when the API cannot be reached', async () => {
    const api = createWebApi('https://api.example.hu', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(loadMenu(api)).rejects.toBeInstanceOf(NetworkError);
  });

  it('lets an abort through as it is', async () => {
    const api = createWebApi('https://api.example.hu', async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    await expect(loadMenu(api)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('loadPublicConfig', () => {
  it('reads GET /api/config/public', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      json({ name: 'Piccolo Club Étterem' }),
    );
    const api = createWebApi('https://api.example.hu', fetch);
    expect(await loadPublicConfig(api)).toEqual({ name: 'Piccolo Club Étterem' });
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://api.example.hu/api/config/public');
  });
});

describe('describeLoadError', () => {
  it('maps week_not_published to the empty-week copy', () => {
    expect(describeLoadError(new ApiError(404, 'week_not_published', ''))).toEqual({
      title: strings.errors.emptyWeekTitle,
      body: strings.errors.emptyWeekBody,
    });
  });

  it('maps anything else to the load failure', () => {
    for (const error of [new ApiError(500, 'internal', ''), new NetworkError(), new Error('x')]) {
      expect(describeLoadError(error)).toEqual({
        title: strings.errors.loadFailedTitle,
        body: strings.errors.loadFailedBody,
      });
    }
  });
});
