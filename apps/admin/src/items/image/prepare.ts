import {
  byRendition,
  type ImageMime,
  type ImageRendition,
  imageMimes,
  imageRenditions,
  maxSourceBytes,
  planRenditions,
  type Rect,
  renditionSpecs,
  type Size,
} from '@piccolo/core';
import { browserImageIo } from './browserIo';

/*
 * Turns the file staff pick into the renditions the API stores, in the browser. Which renditions,
 * how big and how cropped is core's registry; this is the procedure that applies it through an
 * `ImageIo`, the one seam to the canvas, so it runs in jsdom against a fake. Re-encoding through
 * a canvas also drops the photo's EXIF, GPS position included.
 */

export type PrepareFailure =
  /** Over `maxSourceBytes`; refused before decoding, so a huge file cannot exhaust memory. */
  | 'source_too_big'
  /** Not an image, or one this browser cannot decode (HEIC on desktop Chrome). */
  | 'undecodable'
  /** The browser encodes neither WebP nor JPEG. */
  | 'encode_failed'
  /** Still over a rendition's byte cap at the lowest quality. */
  | 'result_too_big';

/** Thrown by `prepareItemImage`; `describeError` shows `code` from strings.errors.byCode. */
export class ImagePrepareError extends Error {
  constructor(readonly code: PrepareFailure) {
    super(`Could not prepare the image: ${code}`);
    this.name = 'ImagePrepareError';
  }
}

/** Something the IO can draw from: a decoded file, or a picture it drew earlier. */
export type Picture = Readonly<Size>;

/** A picture holding a bitmap or canvas until `release`, called once nothing draws or encodes it. */
export interface HeldPicture extends Picture {
  release(): void;
}

export interface ImageIo {
  /** Decodes with the photo's EXIF orientation applied. Rejects when the browser cannot. */
  decode(file: Blob): Promise<HeldPicture>;
  /** A new picture of `size` on white, with `crop` of `source` (`null`: all of it) scaled into it. */
  draw(source: Picture, crop: Rect | null, size: Size): HeldPicture;
  /**
   * The encoded picture, or `null`. A browser that cannot encode `mime` may answer with a PNG
   * instead (Safari and WebP), so callers compare the blob's type with what they asked for.
   */
  encode(picture: Picture, mime: ImageMime, quality: number): Promise<Blob | null>;
}

/** The multipart body: one file per rendition of the registry. */
export type PreparedImage = Record<ImageRendition, File>;

/** Tried in order until the file fits its rendition's cap. */
export const qualityLadder = [0.85, 0.75, 0.6, 0.45] as const;

const extensions: Record<ImageMime, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

/**
 * Reads, crops, scales and encodes `file` into every rendition, all in the first format of
 * `imageMimes` this browser really produces. Throws `ImagePrepareError`.
 */
export async function prepareItemImage(
  file: Blob,
  io: ImageIo = browserImageIo,
): Promise<PreparedImage> {
  if (file.size > maxSourceBytes) {
    throw new ImagePrepareError('source_too_big');
  }
  const decoded = await io.decode(file).catch(() => {
    throw new ImagePrepareError('undecodable');
  });
  let pictures: Record<ImageRendition, HeldPicture>;
  try {
    const plans = planRenditions(decoded);
    if (!plans) {
      throw new ImagePrepareError('undecodable');
    }
    pictures = byRendition((rendition) =>
      io.draw(decoded, plans[rendition].crop, plans[rendition].size),
    );
  } finally {
    decoded.release();
  }

  try {
    const smallest = imageRenditions
      .map((rendition) => pictures[rendition])
      .reduce((a, b) => (a.width * a.height <= b.width * b.height ? a : b));
    const probe = await supportedEncoding(io, smallest);
    const blobs = await Promise.all(
      imageRenditions.map((rendition) =>
        encodeWithin(
          io,
          pictures[rendition],
          probe.mime,
          renditionSpecs[rendition].maxBytes,
          pictures[rendition] === smallest ? probe.blob : null,
        ),
      ),
    );
    return byRendition((rendition) => {
      const blob = blobs[imageRenditions.indexOf(rendition)] as Blob;
      return new File([blob], `${rendition}.${extensions[probe.mime]}`, { type: probe.mime });
    });
  } finally {
    for (const rendition of imageRenditions) {
      pictures[rendition].release();
    }
  }
}

/** The first of `imageMimes` that `io` really encodes, probed on `probe` at the top quality. */
async function supportedEncoding(
  io: ImageIo,
  probe: Picture,
): Promise<{ mime: ImageMime; blob: Blob }> {
  for (const mime of imageMimes) {
    const blob = await io.encode(probe, mime, qualityLadder[0]);
    if (blob?.type === mime) {
      return { mime, blob };
    }
  }
  throw new ImagePrepareError('encode_failed');
}

/**
 * `picture` at the highest quality of the ladder that fits `maxBytes`. `top` is the picture
 * already encoded at the ladder's first quality, when the format probe did that.
 */
async function encodeWithin(
  io: ImageIo,
  picture: Picture,
  mime: ImageMime,
  maxBytes: number,
  top: Blob | null,
): Promise<Blob> {
  for (const quality of qualityLadder) {
    const blob =
      quality === qualityLadder[0] && top ? top : await io.encode(picture, mime, quality);
    if (blob?.type === mime && blob.size <= maxBytes) {
      return blob;
    }
  }
  throw new ImagePrepareError('result_too_big');
}
