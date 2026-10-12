/*
 * Étlap images: what an image is. One registry (`renditionSpecs`) names the renditions of an
 * item's image and their limits. The admin that produces them (client resize), the API that
 * accepts them (byte caps, multipart field names, body limit) and the route that serves them all
 * read it, so none of them keeps a list of its own.
 *
 * Only permanent items carry an image (a CHECK on `menu_items`), and both renditions are always
 * stored together or not at all.
 */

/** How a rendition is cut from the source. */
export type RenditionFit =
  /** Scaled to fit an `edge` × `edge` box, aspect ratio kept, never enlarged. */
  | 'inside'
  /** Centre-cropped to a square of at most `edge` × `edge`, never enlarged. */
  | 'square';

export interface RenditionSpec {
  fit: RenditionFit;
  /** Pixels. The longest edge of an `inside` rendition, the side of a `square` one. */
  edge: number;
  /** Largest encoded file, bytes. The server refuses more; the admin lowers the quality to fit. */
  maxBytes: number;
}

/** The registry. Adding a rendition is adding a key here; the build then points at every list. */
export const renditionSpecs = {
  large: { fit: 'inside', edge: 1200, maxBytes: 1_500_000 },
  thumb: { fit: 'square', edge: 192, maxBytes: 80_000 },
} as const satisfies Record<string, RenditionSpec>;

export type ImageRendition = keyof typeof renditionSpecs;

export const imageRenditions = Object.keys(renditionSpecs) as [ImageRendition, ...ImageRendition[]];

/** A record with one entry per rendition of the registry. */
export function byRendition<T>(value: (rendition: ImageRendition) => T): Record<ImageRendition, T> {
  return Object.fromEntries(
    imageRenditions.map((rendition) => [rendition, value(rendition)]),
  ) as Record<ImageRendition, T>;
}

/** What the browser's encoder is asked for and the server accepts, in order of preference. */
export const imageMimes = ['image/webp', 'image/jpeg'] as const;
export type ImageMime = (typeof imageMimes)[number];

/** The admin refuses a source file bigger than this before it tries to decode it. */
export const maxSourceBytes = 30_000_000;

/** How many leading bytes of a file `sniffImageMime` needs. */
export const sniffBytes = 16;

export interface Size {
  width: number;
  height: number;
}

/** A rectangle of the source image, in source pixels. */
export interface Rect extends Size {
  x: number;
  y: number;
}

/** What to draw for one rendition: `crop` of the source (`null`: all of it), scaled to `size`. */
export interface RenditionPlan {
  crop: Rect | null;
  size: Size;
}

/**
 * The plan for every rendition of a source of `source` pixels; `null` when it has no area.
 * No rendition is larger than the source; an `inside` plan keeps the aspect ratio (to rounding);
 * a `square` plan crops the centred largest square, then scales it down to at most `edge`.
 */
export function planRenditions(source: Size): Record<ImageRendition, RenditionPlan> | null {
  const { width, height } = source;
  if (!(width >= 1 && height >= 1)) {
    return null;
  }
  const plan = (spec: RenditionSpec): RenditionPlan => {
    if (spec.fit === 'inside') {
      const scale = Math.min(1, spec.edge / Math.max(width, height));
      return {
        crop: null,
        size: {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
        },
      };
    }
    const side = Math.min(width, height);
    const edge = Math.min(spec.edge, side);
    return {
      crop: {
        x: Math.floor((width - side) / 2),
        y: Math.floor((height - side) / 2),
        width: side,
        height: side,
      },
      size: { width: edge, height: edge },
    };
  };
  return byRendition((rendition) => plan(renditionSpecs[rendition]));
}

const startsWith = (bytes: Uint8Array, at: number, magic: readonly number[]) =>
  magic.every((byte, i) => bytes[at + i] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * The format of an encoded image by its magic bytes (the first `sniffBytes` are enough), `null`
 * for anything else. The declared type of an upload is never trusted: the files are served from
 * the API's own origin.
 */
export function sniffImageMime(head: Uint8Array): ImageMime | null {
  if (startsWith(head, 0, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(head, 0, ascii('RIFF')) && startsWith(head, 8, ascii('WEBP'))) {
    return 'image/webp';
  }
  return null;
}

export type ImageUploadErrorCode =
  /** A rendition with no bytes. */
  | 'empty'
  /** Over the rendition's `maxBytes`. */
  | 'too_big'
  /** Not WebP or JPEG. */
  | 'unsupported_type'
  /** The item is weekly; only permanent items carry an image. */
  | 'not_permanent';

/** Rendition name (or `item`) → the first rule it breaks. The API's `fields` for `validation`. */
export type ImageUploadErrors = Partial<Record<ImageRendition | 'item', ImageUploadErrorCode>>;

/** What the check needs of one uploaded file: its size and its first `sniffBytes` bytes. */
export interface ImageFileFacts {
  size: number;
  head: Uint8Array;
}

export type ImageUploadCheck =
  | { ok: true; mimes: Readonly<Record<ImageRendition, ImageMime>> }
  | { ok: false; fields: ImageUploadErrors };

/**
 * Checks the files of an upload: every rendition present, within its byte cap, WebP or JPEG.
 * On success it carries the sniffed type of each, which the store records as the object's
 * `Content-Type`.
 *
 * Pixel dimensions are deliberately not checked: the byte caps bound what a guest downloads, a
 * wrong-sized file is only a layout matter, and parsing image headers would be a second source
 * of truth for `renditionSpecs`. Whether the item may carry an image is the database's call
 * (`not_permanent`), made under the row lock when the image is attached.
 */
export function checkImageUpload(
  parts: Readonly<Record<ImageRendition, ImageFileFacts>>,
): ImageUploadCheck {
  const fields: ImageUploadErrors = {};
  const mimes: Partial<Record<ImageRendition, ImageMime>> = {};
  for (const rendition of imageRenditions) {
    const { size, head } = parts[rendition];
    const mime = sniffImageMime(head);
    if (size === 0) {
      fields[rendition] = 'empty';
    } else if (size > renditionSpecs[rendition].maxBytes) {
      fields[rendition] = 'too_big';
    } else if (mime === null) {
      fields[rendition] = 'unsupported_type';
    } else {
      mimes[rendition] = mime;
    }
  }
  return Object.keys(fields).length === 0
    ? { ok: true, mimes: mimes as Record<ImageRendition, ImageMime> }
    : { ok: false, fields };
}
