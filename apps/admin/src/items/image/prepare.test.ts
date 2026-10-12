import {
  type ImageMime,
  maxSourceBytes,
  type Rect,
  renditionSpecs,
  type Size,
} from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import {
  type ImageIo,
  ImagePrepareError,
  type Picture,
  prepareItemImage,
  qualityLadder,
} from './prepare';

type Drawn = Picture & { crop: Rect | null };

/**
 * A fake canvas. Encoded size grows with the pixels and the quality; `answers` replaces what the
 * browser hands back for a format (Safari answers a WebP request with a PNG).
 */
function fakeIo(
  source: Size,
  options: {
    bytesPerPixel?: number;
    answers?: Partial<Record<ImageMime, string | null>>;
    undecodable?: boolean;
  } = {},
) {
  const calls = { released: 0, draws: [] as Drawn[], encodes: [] as [Size, string, number][] };
  const io: ImageIo = {
    async decode() {
      if (options.undecodable) {
        throw new Error('cannot decode');
      }
      return { ...source, release: () => (calls.released += 1) };
    },
    draw(_from, crop, size) {
      const drawn = { ...size, crop };
      calls.draws.push(drawn);
      return drawn;
    },
    async encode(picture, mime, quality) {
      calls.encodes.push([{ width: picture.width, height: picture.height }, mime, quality]);
      const type = options.answers && mime in options.answers ? options.answers[mime] : mime;
      if (type === null || type === undefined) {
        return null;
      }
      const size = Math.round(
        picture.width * picture.height * (options.bytesPerPixel ?? 0.1) * quality,
      );
      return new Blob([new Uint8Array(size)], { type });
    },
  };
  return { io, calls };
}

const photo = new Blob(['photo'], { type: 'image/jpeg' });

const failure = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught);
  return error instanceof ImagePrepareError ? error.code : error;
};

describe('prepareItemImage', () => {
  it('draws every rendition from the registry plan and encodes both as WebP', async () => {
    const { io, calls } = fakeIo({ width: 4000, height: 3000 });

    const prepared = await prepareItemImage(photo, io);

    expect(calls.draws).toEqual([
      { width: 1200, height: 900, crop: null },
      { width: 192, height: 192, crop: { x: 500, y: 0, width: 3000, height: 3000 } },
    ]);
    expect(calls.released).toBe(1);
    expect(Object.entries(prepared).map(([name, file]) => [name, file.name, file.type])).toEqual([
      ['large', 'large.webp', 'image/webp'],
      ['thumb', 'thumb.webp', 'image/webp'],
    ]);
  });

  it('falls back to JPEG for both when the browser answers a WebP request with a PNG', async () => {
    const { io } = fakeIo({ width: 800, height: 600 }, { answers: { 'image/webp': 'image/png' } });

    const prepared = await prepareItemImage(photo, io);

    expect([prepared.large.type, prepared.thumb.type]).toEqual(['image/jpeg', 'image/jpeg']);
    expect(prepared.large.name).toBe('large.jpg');
  });

  it('lowers the quality until a rendition fits its cap', async () => {
    // 1200 × 900 × 1.6 bytes: 1.47 MB at 0.85 and 1.30 MB at 0.75, against a 1.5 MB cap.
    const { io, calls } = fakeIo({ width: 1200, height: 900 }, { bytesPerPixel: 1.6 });

    const prepared = await prepareItemImage(photo, io);

    expect(prepared.large.size).toBeLessThanOrEqual(renditionSpecs.large.maxBytes);
    expect(
      calls.encodes.filter(([size]) => size.width === 1200).map(([, , quality]) => quality),
    ).toEqual([qualityLadder[0]]);
    const { io: busier, calls: busierCalls } = fakeIo(
      { width: 1200, height: 900 },
      { bytesPerPixel: 1.8 },
    );
    await prepareItemImage(photo, busier);
    expect(
      busierCalls.encodes.filter(([size]) => size.width === 1200).map(([, , quality]) => quality),
    ).toEqual([0.85, 0.75]);
  });

  it('gives up when even the lowest quality is over the cap', async () => {
    const { io } = fakeIo({ width: 1200, height: 900 }, { bytesPerPixel: 10 });
    expect(await failure(prepareItemImage(photo, io))).toBe('result_too_big');
  });

  it('refuses a source over the limit before decoding it', async () => {
    const { io, calls } = fakeIo({ width: 10, height: 10 });
    const huge = { size: maxSourceBytes + 1 } as Blob;

    expect(await failure(prepareItemImage(huge, io))).toBe('source_too_big');
    expect(calls.draws).toEqual([]);
  });

  it('reports a file the browser cannot decode', async () => {
    const { io } = fakeIo({ width: 10, height: 10 }, { undecodable: true });
    expect(await failure(prepareItemImage(photo, io))).toBe('undecodable');
  });

  it('reports a decoded image with no area, and still frees it', async () => {
    const { io, calls } = fakeIo({ width: 0, height: 0 });
    expect(await failure(prepareItemImage(photo, io))).toBe('undecodable');
    expect(calls.released).toBe(1);
  });

  it('reports a browser that encodes neither format', async () => {
    const { io } = fakeIo(
      { width: 10, height: 10 },
      { answers: { 'image/webp': null, 'image/jpeg': 'image/png' } },
    );
    expect(await failure(prepareItemImage(photo, io))).toBe('encode_failed');
  });
});
