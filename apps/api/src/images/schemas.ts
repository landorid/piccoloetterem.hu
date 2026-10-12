import { type ImageRendition, imageRenditions, renditionSpecs } from '@piccolo/core';
import { z } from 'zod';

/*
 * The image API on the wire. Shape only: byte caps and formats are core's `checkImageUpload`.
 */

/**
 * `PUT /api/admin/menu/items/:id/image`: one multipart file per rendition of the registry. The
 * `satisfies` fails the build when the registry gains a rendition this schema lacks, and the
 * admin's `form` argument is typed from it.
 */
export const imageForm = z.object({
  large: z.instanceof(File),
  thumb: z.instanceof(File),
}) satisfies z.ZodObject<Record<ImageRendition, z.ZodType<File>>>;

/** Multipart framing on top of the files themselves. */
const multipartOverheadBytes = 64 * 1024;

/** The whole request's cap: every rendition at its largest, plus framing. */
export const imageUploadMaxBodyBytes =
  imageRenditions.reduce((sum, rendition) => sum + renditionSpecs[rendition].maxBytes, 0) +
  multipartOverheadBytes;

/** `GET /api/images/:id/:version/:rendition`. Strict, because the segments become an R2 key. */
export const imageParams = z.object({
  id: z.uuid(),
  version: z.uuid(),
  rendition: z.enum(imageRenditions),
});
