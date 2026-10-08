import type { Bindings } from '../env';

/**
 * The public menu cache (docs/STACK.md rule 4: no expiry, emptied when the menu changes). The
 * admin menu routes call it after every write that changes what guests see.
 */
export interface MenuCache {
  /** Drops the cached public menu of one ISO week. */
  purgeWeek(isoYear: number, isoWeek: number): Promise<void>;
  /** Drops every cached week. Permanent items appear on every week's menu. */
  purgeAll(): Promise<void>;
}

/** Caches nothing, so there is nothing to purge. */
export const noopMenuCache: MenuCache = {
  async purgeWeek() {},
  async purgeAll() {},
};

/** The cache of this deployment. A no-op until the public menu API (#25) implements one. */
export function menuCacheFor(_env: Bindings): MenuCache {
  return noopMenuCache;
}
