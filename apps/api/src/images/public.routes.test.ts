import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { memoryR2 } from './memoryR2';
import { r2ItemImages } from './store';

const itemId = '00000000-0000-4000-8000-000000000107';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/** The whole app, so the mount point is tested too. No database URL: none must be needed. */
async function served() {
  const bucket = memoryR2();
  const version = await r2ItemImages(bucket).put(itemId, {
    large: { bytes: new Blob([jpeg, jpeg]), mime: 'image/jpeg' },
    thumb: { bytes: new Blob([jpeg]), mime: 'image/jpeg' },
  });
  const get = (path: string) => app.request(`/api/images/${path}`, {}, { ITEM_IMAGES: bucket });
  return { version, get, bucket };
}

describe('GET /api/images/:id/:version/:rendition', () => {
  it('serves the stored bytes for good, as an image that cannot be anything else', async () => {
    const { version, get } = await served();
    const res = await get(`${itemId}/${version}/thumb`);

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(jpeg);
    expect(Object.fromEntries(res.headers)).toMatchObject({
      'content-type': 'image/jpeg',
      'content-length': '7',
      etag: `"${itemId}/${version}/thumb"`,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'cross-origin',
    });
  });

  it('serves each rendition under its own name', async () => {
    const { version, get } = await served();
    expect((await get(`${itemId}/${version}/large`)).headers.get('content-length')).toBe('14');
  });

  it('answers 404 that no one caches for an image this bucket does not have', async () => {
    const { get } = await served();
    const res = await get(`${itemId}/9b1f6d8e-0000-4000-8000-000000000000/thumb`);

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ error: 'image_not_found' });
  });

  it.each([
    [
      'a non-UUID item',
      'nope/9b1f6d8e-0000-4000-8000-000000000000/thumb',
      { id: 'invalid_format' },
    ],
    ['a non-UUID version', `${itemId}/..%2F..%2Fsecret/thumb`, { version: 'invalid_format' }],
    [
      'a rendition the registry does not name',
      `${itemId}/9b1f6d8e-0000-4000-8000-000000000000/original`,
      { rendition: 'invalid_value' },
    ],
  ])('refuses %s before it becomes an R2 key', async (_name, path, fields) => {
    const { get, bucket } = await served();
    const res = await get(path);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'validation', fields });
    expect(bucket.reads).toEqual([]);
  });
});
