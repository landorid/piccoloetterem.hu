import type { PublicMenu } from '@piccolo/core';
import type { Bindings, KvStore } from '../env';

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

/** Everything `GET /api/menu` reads about one ISO week, so a cached week costs no query. */
export type CachedWeek =
  | { published: false }
  | {
      published: true;
      /** The week's closed dates, `YYYY-MM-DD`. */
      closedDates: string[];
      menu: PublicMenu;
    };

/** The cache as the public menu reads it. */
export interface PublicMenuCache extends MenuCache {
  /** The cached week; on a miss, the result of `load`, stored for the next request. */
  week(isoYear: number, isoWeek: number, load: () => Promise<CachedWeek>): Promise<CachedWeek>;
}

/**
 * Bump whenever the shape or the meaning of `CachedWeek` (and so of `PublicMenu`) changes.
 * Entries never expire, so without a bump a deploy would keep serving the old ones.
 */
export const CACHE_FORMAT = 1;

/** Caches nothing, so there is nothing to purge. */
export const noopMenuCache: PublicMenuCache = {
  async purgeWeek() {},
  async purgeAll() {},
  week: (_isoYear, _isoWeek, load) => load(),
};

const weekKey = (isoYear: number, isoWeek: number) => `menu:${isoYear}-${isoWeek}`;
const weekVersionKey = (isoYear: number, isoWeek: number) => `menu-version:${isoYear}-${isoWeek}`;
const allVersionKey = 'menu-version:all';

interface Entry {
  version: string;
  week: CachedWeek;
}

/**
 * `PublicMenuCache` on Workers KV. Each week is stored under `menu:<isoYear>-<isoWeek>` without
 * expiry, together with the version it was loaded under.
 *
 * A purge does not delete entries. It writes a new random version: `menu-version:<y>-<w>` for one
 * week, `menu-version:all` for every week, and an entry is used only while both still match it.
 * Deleting would not be enough:
 * - A guest whose database read ran just before a write committed would store the old week
 *   after the purge, and with no expiry it would stay. Its entry carries the version read
 *   before that database read, which the purge has already replaced.
 * - `list` is eventually consistent, so listing the entries to delete could miss one stored
 *   elsewhere a moment before.
 *
 * KV is eventually consistent: a purge is visible at once in the location that made it, and
 * within about a minute everywhere else. KV also allows about one write per second per key:
 * a guest's store that fails is skipped (the next request tries again), and a purge retries.
 */
export function kvMenuCache(kv: KvStore, options: { retryDelayMs?: number } = {}): PublicMenuCache {
  const retryDelayMs = options.retryDelayMs ?? 1000;

  /** Writes a new version, retrying twice: the admin's write has committed and must not stay cached. */
  async function bump(key: string): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await kv.put(key, crypto.randomUUID());
        return;
      } catch (err) {
        if (attempt === 3) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  return {
    async purgeWeek(isoYear, isoWeek) {
      await bump(weekVersionKey(isoYear, isoWeek));
    },

    async purgeAll() {
      await bump(allVersionKey);
    },

    async week(isoYear, isoWeek, load) {
      const key = weekKey(isoYear, isoWeek);
      const [stored, weekVersion, allVersion] = await Promise.all([
        kv.get(key, 'text'),
        kv.get(weekVersionKey(isoYear, isoWeek), 'text'),
        kv.get(allVersionKey, 'text'),
      ]);
      // Read before `load`: a purge that lands while it runs changes it.
      const version = `${CACHE_FORMAT}/${allVersion ?? ''}/${weekVersion ?? ''}`;
      const entry = stored === null ? null : (JSON.parse(stored) as Entry);
      if (entry?.version === version) {
        return entry.week;
      }

      const week = await load();
      try {
        await kv.put(key, JSON.stringify({ version, week } satisfies Entry));
      } catch (err) {
        // Most likely another request stored the same week within the same second.
        console.warn(`Menu cache: could not store ${key}`, err);
      }
      return week;
    },
  };
}

/** The cache of this deployment: the `MENU_CACHE` KV namespace. */
export function menuCacheFor(env: Bindings): PublicMenuCache {
  return kvMenuCache(env.MENU_CACHE);
}
