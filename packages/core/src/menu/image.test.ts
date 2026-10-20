import { describe, expect, it } from 'vitest';
import {
  checkImageUpload,
  type ImageFileFacts,
  imageRenditions,
  itemImageUrl,
  planRenditions,
  renditionSpecs,
  sniffImageMime,
} from './image';

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(
    values.flatMap((value) =>
      typeof value === 'string' ? [...value].map((char) => char.charCodeAt(0)) : [value],
    ),
  );

const jpegHead = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 'JFIF', 0, 1, 1, 0, 0, 1);
const webpHead = bytes('RIFF', 0x24, 0x1a, 0, 0, 'WEBP', 'VP8 ');
const pngHead = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 'IHDR');

describe('planRenditions', () => {
  it('fits large inside 1200 px keeping the aspect ratio, and crops thumb to a centred square', () => {
    expect(planRenditions({ width: 4000, height: 3000 })).toEqual({
      large: { crop: null, size: { width: 1200, height: 900 } },
      thumb: {
        crop: { x: 500, y: 0, width: 3000, height: 3000 },
        size: { width: 192, height: 192 },
      },
    });
  });

  it('crops a portrait source from its vertical centre', () => {
    expect(planRenditions({ width: 1000, height: 1501 })?.thumb.crop).toEqual({
      x: 0,
      y: 250,
      width: 1000,
      height: 1000,
    });
  });

  it('never enlarges a source smaller than a rendition', () => {
    expect(planRenditions({ width: 150, height: 100 })).toEqual({
      large: { crop: null, size: { width: 150, height: 100 } },
      thumb: { crop: { x: 25, y: 0, width: 100, height: 100 }, size: { width: 100, height: 100 } },
    });
  });

  it('keeps a sliver at least one pixel wide', () => {
    expect(planRenditions({ width: 6000, height: 2 })?.large.size).toEqual({
      width: 1200,
      height: 1,
    });
  });

  it.each([
    { width: 0, height: 100 },
    { width: 100, height: 0 },
    { width: Number.NaN, height: 100 },
  ])('has no plan for a source with no area (%o)', (size) => {
    expect(planRenditions(size)).toBeNull();
  });

  it('plans every rendition of the registry and nothing else', () => {
    expect(Object.keys(planRenditions({ width: 10, height: 10 }) ?? {})).toEqual(
      Object.keys(renditionSpecs),
    );
  });
});

describe('sniffImageMime', () => {
  it('recognises JPEG and WebP by their magic bytes', () => {
    expect(sniffImageMime(jpegHead)).toBe('image/jpeg');
    expect(sniffImageMime(webpHead)).toBe('image/webp');
  });

  it.each([
    ['PNG', pngHead],
    ['GIF', bytes('GIF89a')],
    ['SVG', bytes('<svg xmlns="http')],
    ['HTML', bytes('<!doctype html>')],
    ['a RIFF that is not WebP', bytes('RIFF', 0, 0, 0, 0, 'WAVE')],
    ['nothing', bytes()],
  ])('refuses %s', (_name, head) => {
    expect(sniffImageMime(head)).toBeNull();
  });
});

describe('checkImageUpload', () => {
  const file = (head: Uint8Array, size = 1000): ImageFileFacts => ({ size, head });

  it('accepts a WebP pair and a JPEG pair and reports what each file is', () => {
    expect(checkImageUpload({ large: file(webpHead), thumb: file(jpegHead) })).toEqual({
      ok: true,
      mimes: { large: 'image/webp', thumb: 'image/jpeg' },
    });
  });

  it('names the first rule each rendition breaks', () => {
    expect(
      checkImageUpload({
        large: file(pngHead),
        thumb: file(jpegHead, renditionSpecs.thumb.maxBytes + 1),
      }),
    ).toEqual({ ok: false, fields: { large: 'unsupported_type', thumb: 'too_big' } });
    expect(checkImageUpload({ large: file(bytes(), 0), thumb: file(webpHead) })).toEqual({
      ok: false,
      fields: { large: 'empty' },
    });
  });

  it('allows each rendition exactly its cap', () => {
    const atCap = Object.fromEntries(
      imageRenditions.map((rendition) => [
        rendition,
        file(jpegHead, renditionSpecs[rendition].maxBytes),
      ]),
    ) as Record<(typeof imageRenditions)[number], ImageFileFacts>;
    expect(checkImageUpload(atCap).ok).toBe(true);
  });
});

describe('itemImageUrl', () => {
  const item = {
    id: '00000000-0000-4000-8000-000000000107',
    imageVersion: '7d3f0c52-58a1-4b1e-9a43-0d9a1c3e2b10',
  };

  it('is the object key under the images origin', () => {
    expect(itemImageUrl('https://img-dev.piccoloetterem.hu', item, 'thumb')).toBe(
      `https://img-dev.piccoloetterem.hu/${item.id}/${item.imageVersion}/thumb`,
    );
    expect(itemImageUrl('https://img.piccoloetterem.hu/', item, 'large')).toBe(
      `https://img.piccoloetterem.hu/${item.id}/${item.imageVersion}/large`,
    );
  });

  it('is null for an item without an image, or without an images origin', () => {
    expect(itemImageUrl('https://img.piccoloetterem.hu', { id: item.id }, 'thumb')).toBeNull();
    expect(itemImageUrl(undefined, item, 'thumb')).toBeNull();
    expect(itemImageUrl('', item, 'thumb')).toBeNull();
  });
});
