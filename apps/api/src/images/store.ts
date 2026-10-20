import { type ImageMime, type ImageRendition, imageKey, imageRenditions } from '@piccolo/core';
import type { Bindings, R2Store } from '../env';

/*
 * The only module that writes the bucket, and the only one that mints a version. The bucket is
 * served publicly from its own domain (`https://img.<domain>`), keys being core's `imageKey`. A
 * version is immutable: its objects are never overwritten, so an image URL can be cached for a
 * year. A replace writes a new version, points the item at it, then discards the old one; the
 * database pointer is the commit point.
 */

declare const stored: unique symbol;

/**
 * A version whose renditions are all in the bucket. `ItemImageStore.put` is its only producer and
 * `swapItemImage` takes nothing else, so an item cannot point at an upload that did not finish.
 */
export type StoredImageVersion = string & { readonly [stored]: true };

export interface ImagePart {
  bytes: Blob;
  /** Sniffed by `checkImageUpload`; becomes the object's `Content-Type`. */
  mime: ImageMime;
}

export interface ItemImageStore {
  /**
   * Writes every rendition under a new version and returns it. All or nothing: when a write
   * fails, the version is discarded and the error thrown.
   */
  put(
    itemId: string,
    parts: Readonly<Record<ImageRendition, ImagePart>>,
  ): Promise<StoredImageVersion>;
  /**
   * Deletes every rendition of exactly this version; never "everything but", which would delete
   * an upload of the same item still in flight. Idempotent, and never throws: it runs once
   * nothing points at the version, so a failure only leaves garbage.
   */
  discard(itemId: string, version: string): Promise<void>;
}

/**
 * Stored with every object and served as-is by the bucket's public domain; the domain's
 * Transform Rule sets the same value (apps/api/README.md, "Item images").
 */
const immutableCacheControl = 'public, max-age=31536000, immutable';

export function r2ItemImages(bucket: R2Store): ItemImageStore {
  const discard: ItemImageStore['discard'] = async (itemId, version) => {
    try {
      await bucket.delete(imageRenditions.map((rendition) => imageKey(itemId, version, rendition)));
    } catch (error) {
      console.warn(`Item images: could not discard ${itemId}/${version}`, error);
    }
  };

  return {
    async put(itemId, parts) {
      const version = crypto.randomUUID();
      const writes = await Promise.allSettled(
        imageRenditions.map((rendition) =>
          bucket.put(imageKey(itemId, version, rendition), parts[rendition].bytes, {
            httpMetadata: {
              contentType: parts[rendition].mime,
              cacheControl: immutableCacheControl,
            },
          }),
        ),
      );
      const failed = writes.find((write) => write.status === 'rejected');
      if (failed) {
        await discard(itemId, version);
        throw failed.reason;
      }
      return version as StoredImageVersion;
    },

    discard,
  };
}

/** The store of this deployment: the `ITEM_IMAGES` bucket. */
export function itemImagesFor(env: Bindings): ItemImageStore {
  // `r2_buckets` is not inherited by named wrangler environments, and the type cannot know.
  if (!env.ITEM_IMAGES) {
    throw new Error('ITEM_IMAGES is not bound: add its r2_buckets block to wrangler.toml');
  }
  return r2ItemImages(env.ITEM_IMAGES);
}
