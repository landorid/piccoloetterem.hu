import { buildPublicMenu, type RestaurantConfig } from '@piccolo/core';
import type { Db } from '@piccolo/db';
import type { CachedWeek, PublicMenuCache } from './cache';
import { readPublishedWeek } from './repo';

/** One week as guests see it: from the cache, or read from the database and cached. */
export function publicWeek(
  cache: PublicMenuCache,
  db: Db,
  config: RestaurantConfig,
  isoYear: number,
  isoWeek: number,
): Promise<CachedWeek> {
  return cache.week(isoYear, isoWeek, async () => {
    const source = await readPublishedWeek(db, isoYear, isoWeek, config.timezone);
    if (!source) {
      return { published: false };
    }
    return {
      published: true,
      closedDates: source.closedDates,
      menu: buildPublicMenu(source.week, source.schedule, source.items, config),
    };
  });
}
