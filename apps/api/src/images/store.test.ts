import { describe, expect, it, vi } from 'vitest';
import type { Bindings, R2Store } from '../env';
import { memoryR2 } from './memoryR2';
import { itemImagesFor, r2ItemImages } from './store';

const itemId = '00000000-0000-4000-8000-000000000107';
const parts = {
  large: { bytes: new Blob(['large bytes']), mime: 'image/webp' as const },
  thumb: { bytes: new Blob(['thumb']), mime: 'image/jpeg' as const },
};

describe('r2ItemImages', () => {
  // A type-level check, enforced by `pnpm typecheck`: the real binding fits `R2Store`.
  it('accepts an R2 bucket', () => {
    const fits = (bucket: R2Bucket): R2Store => bucket;
    expect(fits).toBeTypeOf('function');
  });

  it('writes every rendition under <item>/<version>/<rendition> with its content type', async () => {
    const bucket = memoryR2();
    const version = await r2ItemImages(bucket).put(itemId, parts);

    expect(version).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      [...bucket.data].map(([key, object]) => [key, object.contentType, object.bytes.size]),
    ).toEqual([
      [`${itemId}/${version}/large`, 'image/webp', 11],
      [`${itemId}/${version}/thumb`, 'image/jpeg', 5],
    ]);
  });

  it('mints a new version for every put', async () => {
    const images = r2ItemImages(memoryR2());
    expect(await images.put(itemId, parts)).not.toBe(await images.put(itemId, parts));
  });

  it('serves a stored rendition with its type, size and ETag, and null for anything else', async () => {
    const images = r2ItemImages(memoryR2());
    const version = await images.put(itemId, parts);

    const thumb = await images.get(itemId, version, 'thumb');
    expect(thumb && { ...thumb, body: await new Response(thumb.body).text() }).toEqual({
      body: 'thumb',
      size: 5,
      contentType: 'image/jpeg',
      etag: `"${itemId}/${version}/thumb"`,
    });
    expect(await images.get(itemId, '9b1f6d8e-0000-4000-8000-000000000000', 'thumb')).toBeNull();
  });

  it('is all or nothing: a failed write leaves no object behind and throws', async () => {
    const bucket = memoryR2();
    bucket.failPut(2);

    await expect(r2ItemImages(bucket).put(itemId, parts)).rejects.toThrow('R2 put failed');
    expect(bucket.data.size).toBe(0);
  });

  it('discards exactly one version and leaves the others', async () => {
    const bucket = memoryR2();
    const images = r2ItemImages(bucket);
    const old = await images.put(itemId, parts);
    const current = await images.put(itemId, parts);

    await images.discard(itemId, old);
    await images.discard(itemId, old);

    expect([...bucket.data.keys()]).toEqual([
      `${itemId}/${current}/large`,
      `${itemId}/${current}/thumb`,
    ]);
  });

  it('never throws from discard: a failed delete only leaves garbage', async () => {
    const bucket = memoryR2();
    const images = r2ItemImages(bucket);
    const version = await images.put(itemId, parts);
    bucket.failDeletes();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(images.discard(itemId, version)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('itemImagesFor', () => {
  it('names the missing r2_buckets block instead of failing on undefined', () => {
    expect(() => itemImagesFor({} as Bindings)).toThrow(/ITEM_IMAGES is not bound/);
  });
});
