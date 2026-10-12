import type { AppType } from '@piccolo/api/types';
import { hc } from 'hono/client';

type ImageRoute = ReturnType<typeof hc<AppType>>['api']['images'][':id'][':version'][':rendition'];

/** The renditions the image route serves, taken from its own `rendition` parameter. */
export type ItemImageRendition = NonNullable<
  Parameters<ImageRoute['$url']>[0]
>['param']['rendition'];

/**
 * The URL of an item's image, or `null` when it has none or the frontend knows no API origin.
 * Built from the route's own definition, so no frontend spells the URL scheme; `baseUrl` is the
 * API origin the frontend already knows, because the cached menu JSON carries no host.
 */
export function itemImageUrl(
  baseUrl: string | undefined,
  item: { id: string; imageVersion?: string | undefined },
  rendition: ItemImageRendition,
): string | null {
  if (!baseUrl || item.imageVersion === undefined) {
    return null;
  }
  return hc<AppType>(baseUrl)
    .api.images[':id'][':version'][':rendition'].$url({
      param: { id: item.id, version: item.imageVersion, rendition },
    })
    .toString();
}
