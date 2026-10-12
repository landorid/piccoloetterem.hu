/*
 * An item's image against a real database, with the in-memory bucket. Runs only when
 * DATABASE_URL is set in the shell. It creates its own two items (an inactive dessert and a
 * weekly soup) and deletes them afterwards; the whole-list save it sends is the list it read, so
 * every other permanent item stays as it was.
 */
import { randomUUID } from 'node:crypto';
import type { MenuItem } from '@piccolo/core';
import { createDb, eq, inArray, menuItems } from '@piccolo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleError } from '../app';
import type { AppEnv } from '../env';
import { adminMenuRoutes } from '../menu/admin.routes';
import type { MenuCache } from '../menu/cache';
import { memoryR2 } from './memoryR2';

const url = process.env.DATABASE_URL;

// biome-ignore lint/suspicious/noExplicitAny: response bodies are checked by the assertions
type Json = any;

describe.skipIf(!url)('item images against DATABASE_URL', () => {
  const db = createDb(url ?? '');
  const dessertId = randomUUID();
  const soupId = randomUUID();

  let bucket = memoryR2();
  const cache: MenuCache = {
    async purgeWeek(year, week) {
      bucket.log.push(`purge ${year}/${week}`);
    },
    async purgeAll() {
      bucket.log.push('purge all');
    },
  };
  const api = new Hono<AppEnv>().route(
    '/',
    adminMenuRoutes(() => cache),
  );
  api.onError(handleError);
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  async function send(
    method: string,
    path: string,
    body?: FormData | object,
  ): Promise<[number, Json]> {
    const res = await api.request(
      path,
      body instanceof FormData || body === undefined
        ? { method, body }
        : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      { DATABASE_URL: url, RESTAURANT: 'piccolo', ITEM_IMAGES: bucket },
      ctx,
    );
    return [res.status, await res.json()];
  }

  const jpeg = (marker: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, marker, 1, 2, 3]);
  const upload = (id: string, marker = 1) => {
    const body = new FormData();
    body.append('large', new File([jpeg(marker), jpeg(marker)], 'large.jpg'));
    body.append('thumb', new File([jpeg(marker)], 'thumb.jpg'));
    return send('PUT', `/items/${id}/image`, body);
  };
  const versionOf = async (id: string) => {
    const [row] = await db
      .select({ imageVersion: menuItems.imageVersion })
      .from(menuItems)
      .where(eq(menuItems.id, id));
    return row?.imageVersion;
  };
  const keys = () => [...bucket.data.keys()].sort();
  const keysOf = (id: string, version: string) => [
    `${id}/${version}/large`,
    `${id}/${version}/thumb`,
  ];

  const item = (id: string, category: 'dessert' | 'daily_soup', name: string) => ({
    id,
    category,
    name,
    priceWeekday: 690,
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
    soldOut: false,
    active: false,
    sortOrder: 999,
  });

  beforeAll(async () => {
    await db
      .insert(menuItems)
      .values([
        item(dessertId, 'dessert', 'IMG teszt desszert'),
        item(soupId, 'daily_soup', 'IMG teszt leves'),
      ]);
  });

  beforeEach(async () => {
    bucket = memoryR2();
    await db.update(menuItems).set({ imageVersion: null }).where(eq(menuItems.id, dessertId));
  });

  afterAll(async () => {
    await db.delete(menuItems).where(inArray(menuItems.id, [dessertId, soupId]));
    await db.$client.end();
  });

  it('stores both renditions, then points the item at them and purges every week', async () => {
    const [status, body] = await upload(dessertId);
    const version = body.item.imageVersion;

    expect(status).toBe(200);
    expect(body.item).toMatchObject({ id: dessertId, category: 'dessert' });
    expect(await versionOf(dessertId)).toBe(version);
    expect(keys()).toEqual(keysOf(dessertId, version));
    expect(bucket.log.at(-1)).toBe('purge all');
  });

  it('replaces: the new version is committed, purged, and only then the old one deleted', async () => {
    const [, first] = await upload(dessertId, 1);
    const [status, second] = await upload(dessertId, 2);
    const old = first.item.imageVersion;
    const current = second.item.imageVersion;

    expect(status).toBe(200);
    expect(current).not.toBe(old);
    expect(await versionOf(dessertId)).toBe(current);
    expect(keys()).toEqual(keysOf(dessertId, current));
    expect(bucket.log.slice(-3)).toEqual([
      'purge all',
      `delete ${dessertId}/${old}/large`,
      `delete ${dessertId}/${old}/thumb`,
    ]);
  });

  it('refuses a weekly item under `item` and keeps nothing it stored', async () => {
    const [status, body] = await upload(soupId);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'validation', fields: { item: 'not_permanent' } });
    expect(bucket.data.size).toBe(0);
    expect(bucket.log).not.toContain('purge all');
    expect(await versionOf(soupId)).toBeNull();
  });

  it('answers 404 for an unknown item and keeps nothing it stored', async () => {
    const [status, body] = await upload(randomUUID());

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: 'item_not_found' });
    expect(bucket.data.size).toBe(0);
  });

  it('leaves the item on its old image when storing the new one fails', async () => {
    const [, first] = await upload(dessertId);
    bucket.failPut(1);
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});

    const [status] = await upload(dessertId, 2);

    expect(status).toBe(500);
    expect(await versionOf(dessertId)).toBe(first.item.imageVersion);
    expect(keys()).toEqual(keysOf(dessertId, first.item.imageVersion));
  });

  it('succeeds when deleting the old image fails, leaving it as garbage', async () => {
    await upload(dessertId, 1);
    bucket.failDeletes();
    const warn = vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    const [status, body] = await upload(dessertId, 2);

    expect(status).toBe(200);
    expect(await versionOf(dessertId)).toBe(body.item.imageVersion);
    expect(bucket.data.size).toBe(4);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('removes the image, its objects and the cached menus; removing again changes nothing', async () => {
    const [, uploaded] = await upload(dessertId);
    const [status, body] = await send('DELETE', `/items/${dessertId}/image`);

    expect(status).toBe(200);
    expect(body.item.id).toBe(dessertId);
    expect(body.item).not.toHaveProperty('imageVersion');
    expect(await versionOf(dessertId)).toBeNull();
    expect(bucket.data.size).toBe(0);
    expect(bucket.log.slice(-3)).toEqual([
      'purge all',
      `delete ${dessertId}/${uploaded.item.imageVersion}/large`,
      `delete ${dessertId}/${uploaded.item.imageVersion}/thumb`,
    ]);

    const before = bucket.log.length;
    const [again, same] = await send('DELETE', `/items/${dessertId}/image`);
    expect(again).toBe(200);
    expect(same.item).toEqual(body.item);
    expect(bucket.log.length).toBe(before);
  });

  it('keeps the image through a whole-list save, even one that sends another version', async () => {
    const [, uploaded] = await upload(dessertId);
    const version = uploaded.item.imageVersion;
    const [, menu] = await send('GET', '/items');
    const hostile = {
      ...menu,
      desserts: menu.desserts.map((dessert: MenuItem) =>
        dessert.id === dessertId ? { ...dessert, imageVersion: randomUUID() } : dessert,
      ),
    };

    const [status, saved] = await send('PUT', '/items', hostile);

    expect(status).toBe(200);
    expect(saved.desserts.find((dessert: MenuItem) => dessert.id === dessertId)).toMatchObject({
      imageVersion: version,
    });
    expect(await versionOf(dessertId)).toBe(version);
  });

  it('cannot give a weekly item an image or store a version that is not a UUID (CHECKs)', async () => {
    await expect(
      db.update(menuItems).set({ imageVersion: randomUUID() }).where(eq(menuItems.id, soupId)),
    ).rejects.toThrow();
    await expect(
      db.update(menuItems).set({ imageVersion: 'nope' }).where(eq(menuItems.id, dessertId)),
    ).rejects.toThrow();
  });
});
