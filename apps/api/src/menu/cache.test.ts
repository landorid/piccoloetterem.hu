import { buildPublicMenu, loadConfig, type MenuItem } from '@piccolo/core';
import { describe, expect, it, vi } from 'vitest';
import type { KvStore } from '../env';
import { CACHE_FORMAT, type CachedWeek, kvMenuCache, noopMenuCache } from './cache';
import { memoryKv } from './memoryKv';

const config = loadConfig({ RESTAURANT: 'piccolo' });

const soup: MenuItem = {
  id: '00000000-0000-4000-8000-000000000001',
  category: 'daily_soup',
  name: 'Gulyásleves',
  description: null,
  priceWeekday: 0,
  priceWeekend: null,
  variations: [],
  allergens: ['celery'],
  soupIncluded: false,
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
};

const published = (isoWeek: number, name = soup.name): CachedWeek => ({
  published: true,
  closedDates: [],
  menu: buildPublicMenu(
    { isoYear: 2026, isoWeek, publishedAt: new Date('2026-10-01T18:00:00Z') },
    [{ isoYear: 2026, isoWeek, day: 1, menuItemId: soup.id, sortOrder: 0 }],
    [{ ...soup, name }],
    config,
  ),
});

const loads = (week: CachedWeek) => vi.fn(async () => week);

describe('kvMenuCache', () => {
  // A type-level check, enforced by `pnpm typecheck`: the real binding fits `KvStore`.
  it('accepts a Workers KV namespace', () => {
    const fits = (kv: KVNamespace): KvStore => kv;
    expect(fits).toBeTypeOf('function');
  });

  it('loads a week once, then serves it from KV under menu:<isoYear>-<isoWeek>', async () => {
    const kv = memoryKv();
    const cache = kvMenuCache(kv);
    const load = loads(published(41));

    expect(await cache.week(2026, 41, load)).toEqual(published(41));
    expect(await cache.week(2026, 41, load)).toEqual(published(41));
    expect(load).toHaveBeenCalledTimes(1);
    expect([...kv.data.keys()]).toEqual(['menu:2026-41']);
  });

  it('caches an unpublished week too', async () => {
    const cache = kvMenuCache(memoryKv());
    const load = loads({ published: false });

    await cache.week(2026, 42, load);
    expect(await cache.week(2026, 42, load)).toEqual({ published: false });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('purgeWeek reloads that week only', async () => {
    const cache = kvMenuCache(memoryKv());
    const week41 = loads(published(41));
    const week42 = loads(published(42));
    await cache.week(2026, 41, week41);
    await cache.week(2026, 42, week42);

    await cache.purgeWeek(2026, 41);
    await cache.week(2026, 41, week41);
    await cache.week(2026, 42, week42);
    expect(week41).toHaveBeenCalledTimes(2);
    expect(week42).toHaveBeenCalledTimes(1);
  });

  it('purgeAll reloads every week', async () => {
    const cache = kvMenuCache(memoryKv());
    const week41 = loads(published(41));
    const week42 = loads(published(42));
    await cache.week(2026, 41, week41);
    await cache.week(2026, 42, week42);

    await cache.purgeAll();
    await cache.week(2026, 41, week41);
    await cache.week(2026, 42, week42);
    expect(week41).toHaveBeenCalledTimes(2);
    expect(week42).toHaveBeenCalledTimes(2);
  });

  it('does not keep a week loaded before a purge that landed while it loaded', async () => {
    const cache = kvMenuCache(memoryKv());
    // The guest reads the database, then staff publish and purge, then the guest stores.
    const stale = vi.fn(async () => {
      await cache.purgeWeek(2026, 41);
      return { published: false } as const;
    });
    expect(await cache.week(2026, 41, stale)).toEqual({ published: false });

    const fresh = loads(published(41));
    expect(await cache.week(2026, 41, fresh)).toEqual(published(41));
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('ignores an entry stored by another CACHE_FORMAT', async () => {
    const kv = memoryKv();
    kv.data.set(
      'menu:2026-41',
      JSON.stringify({ version: `${CACHE_FORMAT - 1}//`, week: { published: false } }),
    );
    const load = loads(published(41));

    expect(await kvMenuCache(kv).week(2026, 41, load)).toEqual(published(41));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('still answers when KV rejects the store, and loads again next time', async () => {
    const kv = memoryKv();
    const cache = kvMenuCache(kv);
    const load = loads(published(41));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    kv.failNextWrites(1);
    expect(await cache.week(2026, 41, load)).toEqual(published(41));
    expect(warn).toHaveBeenCalledOnce();
    await cache.week(2026, 41, load);
    await cache.week(2026, 41, load);
    expect(load).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('retries a purge KV rejects, and gives up after three attempts', async () => {
    const kv = memoryKv();
    const cache = kvMenuCache(kv, { retryDelayMs: 0 });
    const load = loads(published(41));
    await cache.week(2026, 41, load);

    kv.failNextWrites(2);
    kv.stats.writes = 0;
    await cache.purgeWeek(2026, 41);
    expect(kv.stats.writes).toBe(3);
    await cache.week(2026, 41, load);
    expect(load).toHaveBeenCalledTimes(2);

    kv.failNextWrites(3);
    await expect(cache.purgeAll()).rejects.toThrow('429');
  });

  /*
   * Entries never expire, so a deploy that changes their shape would keep serving the old one.
   * When this fails, bump CACHE_FORMAT in cache.ts, then update the expected keys.
   */
  it('stores the shape CACHE_FORMAT stands for', () => {
    const week = published(41);
    if (!week.published) {
      throw new Error('unreachable');
    }
    expect(CACHE_FORMAT).toBe(1);
    expect({
      week: Object.keys(week),
      menu: Object.keys(week.menu),
      day: Object.keys(week.menu.days[1]),
      permanent: Object.keys(week.menu.permanent),
      item: Object.keys(week.menu.days[1].soups[0] ?? {}),
    }).toEqual({
      week: ['published', 'closedDates', 'menu'],
      menu: ['isoYear', 'isoWeek', 'weekLabel', 'days', 'featured', 'permanent'],
      day: ['date', 'soups', 'mains'],
      permanent: ['allWeek', 'desserts', 'pickles', 'sides', 'sideExtras'],
      item: [
        'id',
        'category',
        'name',
        'description',
        'priceWeekday',
        'priceWeekend',
        'variations',
        'allergens',
        'soupIncluded',
        'requiresSide',
        'soldOut',
        'active',
        'sortOrder',
      ],
    });
  });
});

describe('noopMenuCache', () => {
  it('loads on every read', async () => {
    const load = loads({ published: false });
    await noopMenuCache.week(2026, 41, load);
    await noopMenuCache.week(2026, 41, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
