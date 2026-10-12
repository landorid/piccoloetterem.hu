import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validate } from '../validation';
import { imageParams } from './schemas';
import { itemImagesFor } from './store';

/**
 * `GET /api/images/:id/:version/:rendition`: anonymous, and the API's only binary response. It
 * touches neither the database nor the config, so an `<img>` per dish never wakes Neon. A version
 * never changes, so the answer is cacheable for good. Not under `/api/admin`, because an
 * `<img src>` cannot send a Bearer token.
 *
 * Unknown object: 404 `image_not_found`, `no-store`. That is also the answer on a machine whose
 * local R2 lacks an image the shared development database names.
 */
export function publicImageRoutes() {
  return new Hono<AppEnv>().get(
    '/:id/:version/:rendition',
    validate('param', imageParams),
    async (c) => {
      const { id, version, rendition } = c.req.valid('param');
      const image = await itemImagesFor(c.env).get(id, version, rendition);
      if (!image) {
        return c.json(
          { error: 'image_not_found' as const, message: `No image ${id}/${version}/${rendition}` },
          404,
          { 'Cache-Control': 'no-store' },
        );
      }
      return c.body(image.body, 200, {
        'Content-Type': image.contentType,
        'Content-Length': String(image.size),
        ETag: image.etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        // Served from the API's origin: should a stored file ever not be an image, it cannot run.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
    },
  );
}
