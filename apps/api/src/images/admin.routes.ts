import { byRendition, checkImageUpload, imageRenditions, sniffBytes } from '@piccolo/core';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv, Bindings } from '../env';
import { HttpError } from '../errors';
import type { MenuCache } from '../menu/cache';
import { type ImageSwap, swapItemImage } from '../menu/repo';
import { itemParams } from '../menu/schemas';
import { validate, validationFailed } from '../validation';
import { imageForm, imageUploadMaxBodyBytes } from './schemas';
import { itemImagesFor } from './store';

/**
 * A permanent item's image, mounted by `adminMenuRoutes` at `/items`, under its `withDb`:
 *
 *   PUT    /:id/image   multipart, one file per rendition; uploads or replaces the image
 *   DELETE /:id/image   removes it; an item without one answers 200 as well
 *
 * Both answer `{ item }`. The order of effects is the crash story:
 *   1. store.put      the new version's objects. A failure or crash leaves objects nobody reads.
 *   2. swapItemImage  the commit point, under the row lock.
 *   3. purgeAll       before step 4, so no menu cached from now on names a deleted version.
 *   4. store.discard  the previous version, best effort.
 */
export function itemImageRoutes(cacheFor: (env: Bindings) => MenuCache) {
  const published = async (c: Context<AppEnv>, id: string, swap: ImageSwap) => {
    if (!swap.ok) {
      if (swap.reason === 'item_not_found') {
        throw new HttpError(404, 'item_not_found', `No menu item ${id}`);
      }
      return validationFailed(c, { item: swap.reason });
    }
    // Removing an image that is not there changes nothing guests see.
    if (swap.previous !== (swap.item.imageVersion ?? null)) {
      await cacheFor(c.env).purgeAll();
      if (swap.previous !== null) {
        await itemImagesFor(c.env).discard(id, swap.previous);
      }
    }
    return c.json({ item: swap.item });
  };

  return new Hono<AppEnv>()
    .put(
      '/:id/image',
      bodyLimit({
        maxSize: imageUploadMaxBodyBytes,
        onError: (c) =>
          c.json(
            {
              error: 'payload_too_large' as const,
              message: `The body is over ${imageUploadMaxBodyBytes} bytes`,
            },
            413,
          ),
      }),
      validate('param', itemParams),
      validate('form', imageForm),
      async (c) => {
        const { id } = c.req.valid('param');
        const form = c.req.valid('form');
        const heads = new Map(
          await Promise.all(
            imageRenditions.map(
              async (rendition) =>
                [
                  rendition,
                  new Uint8Array(await form[rendition].slice(0, sniffBytes).arrayBuffer()),
                ] as const,
            ),
          ),
        );
        const checked = checkImageUpload(
          byRendition((rendition) => ({
            size: form[rendition].size,
            head: heads.get(rendition) ?? new Uint8Array(),
          })),
        );
        if (!checked.ok) {
          return validationFailed(c, checked.fields);
        }
        const store = itemImagesFor(c.env);
        const version = await store.put(
          id,
          byRendition((rendition) => ({ bytes: form[rendition], mime: checked.mimes[rendition] })),
        );
        let swap: ImageSwap;
        try {
          swap = await swapItemImage(c.get('db'), id, version);
        } catch (error) {
          await store.discard(id, version);
          throw error;
        }
        if (!swap.ok) {
          await store.discard(id, version);
        }
        return published(c, id, swap);
      },
    )

    .delete('/:id/image', validate('param', itemParams), async (c) => {
      const { id } = c.req.valid('param');
      return published(c, id, await swapItemImage(c.get('db'), id, null));
    });
}
