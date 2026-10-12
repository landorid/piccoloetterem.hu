import { renditionSpecs } from '@piccolo/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { app, handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from '../menu/admin.routes';
import { noopMenuCache } from '../menu/cache';
import { memoryR2 } from './memoryR2';
import { imageUploadMaxBodyBytes } from './schemas';

const id = '00000000-0000-4000-8000-000000000107';
const webp = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([...'RIFF'].map((c) => c.charCodeAt(0)));
  bytes.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  return bytes;
};
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
]);

const form = (parts: Record<string, Blob | string>) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(parts)) {
    body.append(name, value);
  }
  return body;
};
const file = (bytes: Uint8Array, name = 'x.webp') =>
  new File([bytes], name, { type: 'image/webp' });

describe('/api/admin/menu/items/:id/image without a Clerk session', () => {
  it.each(['PUT', 'DELETE'])('%s is 401', async (method) => {
    const res = await app.request(`/api/admin/menu/items/${id}/image`, { method }, {});
    expect(res.status).toBe(401);
  });
});

/*
 * Rejected before any query: the database URL points nowhere, so a request that reached the
 * database would be a 500, and the bucket must stay empty.
 */
describe('PUT /api/admin/menu/items/:id/image request validation', () => {
  const api = new Hono<AppEnv>().route(
    '/',
    adminMenuRoutes(() => noopMenuCache),
  );
  api.onError(handleError);
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const put = async (body: FormData | string, path = `/items/${id}/image`) => {
    const bucket = memoryR2();
    const res = await api.request(
      path,
      { method: 'PUT', body },
      {
        DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
        RESTAURANT: 'piccolo',
        ITEM_IMAGES: bucket,
      },
      ctx,
    );
    expect(bucket.data.size).toBe(0);
    return res;
  };

  it.each<[string, () => FormData, Record<string, string>]>([
    ['a missing rendition', () => form({ large: file(webp()) }), { thumb: 'invalid_type' }],
    [
      'a text part posing as a file',
      () => form({ large: file(webp()), thumb: 'RIFF....WEBP' }),
      { thumb: 'invalid_type' },
    ],
    [
      'a PNG',
      () => form({ large: file(png, 'x.png'), thumb: file(webp()) }),
      { large: 'unsupported_type' },
    ],
    [
      'an empty file',
      () => form({ large: file(webp()), thumb: file(new Uint8Array()) }),
      { thumb: 'empty' },
    ],
    [
      'a thumbnail over its cap',
      () => form({ large: file(webp()), thumb: file(webp(renditionSpecs.thumb.maxBytes + 1)) }),
      { thumb: 'too_big' },
    ],
  ])('refuses %s with the field it is about', async (_name, body, fields) => {
    const res = await put(body());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields });
  });

  it('refuses a non-UUID id', async () => {
    const res = await put(form({ large: file(webp()), thumb: file(webp()) }), '/items/nope/image');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields: { id: 'invalid_format' } });
  });

  it('answers 413 to a body over the sum of the caps', async () => {
    const res = await put(
      form({ large: file(webp(imageUploadMaxBodyBytes)), thumb: file(webp()) }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: 'payload_too_large' });
  });
});
