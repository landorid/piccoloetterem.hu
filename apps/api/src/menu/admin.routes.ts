import {
  checkReorder,
  isoWeekOf,
  isWeeklyCategory,
  type MenuItem,
  parseIsoDate,
  planWeek,
  validateMenuItem,
  weekDraftIds,
} from '@piccolo/core';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../env';
import { HttpError } from '../errors';
import { withConfig, withDb } from '../middleware';
import { validate, validationFailed } from '../validation';
import type { MenuCache } from './cache';
import {
  addClosedDate,
  applyOrder,
  categoryMembers,
  deactivateItem,
  getMenuItem,
  getMenuItems,
  type IsoWeek,
  insertPermanentItem,
  listClosedDates,
  listPermanentItems,
  publishWeek,
  readWeek,
  removeClosedDate,
  setSoldOut,
  updatePermanentItem,
  weeksOfItems,
  writeWeek,
} from './repo';
import {
  closedDateBody,
  closedDateParams,
  closedDateRangeQuery,
  itemParams,
  itemPatchBody,
  itemsQuery,
  newItemBody,
  reorderBody,
  soldOutBody,
  weekBody,
  weekParams,
} from './schemas';

/**
 * Staff menu management, mounted at `/api/admin/menu` behind `requireStaff`.
 *
 * Every write that changes what guests see purges the public menu cache after it commits:
 * - a week's items or schedule, publishing it, closing or reopening one of its dates → that week;
 * - a weekly item's sold-out flag → every week it is scheduled on;
 * - anything about a permanent item (create, edit, deactivate, reorder, sold out) → every week,
 *   because permanent items appear on every week's menu.
 * Purging is idempotent, so a repeated request purges again even when it changed nothing.
 */
export function adminMenuRoutes(cacheFor: (env: Bindings) => MenuCache) {
  return (
    new Hono<AppEnv>()
      .use(withConfig, withDb)

      // ---- Permanent items ----

      .get('/items', validate('query', itemsQuery), async (c) => {
        const { category } = c.req.valid('query');
        return c.json({ items: await listPermanentItems(c.get('db'), category) });
      })

      .post('/items', validate('json', newItemBody), async (c) => {
        const { category, ...content } = c.req.valid('json');
        const errors = validateMenuItem({
          ...content,
          category,
          soldOut: false,
          active: true,
          sortOrder: 0,
        });
        if (errors) {
          return validationFailed(c, errors);
        }
        const item = await insertPermanentItem(c.get('db'), category, content);
        await cacheFor(c.env).purgeAll();
        return c.json({ item }, 201);
      })

      .post('/items/reorder', validate('json', reorderBody), async (c) => {
        const { ids } = c.req.valid('json');
        const db = c.get('db');
        const result = checkReorder(ids, await categoryMembers(db, ids));
        if (!result.ok) {
          return validationFailed(c, { ids: result.code });
        }
        await applyOrder(db, ids);
        await cacheFor(c.env).purgeAll();
        return c.json({ items: await listPermanentItems(db, result.category) });
      })

      .patch(
        '/items/:id',
        validate('param', itemParams),
        validate('json', itemPatchBody),
        async (c) => {
          const { id } = c.req.valid('param');
          const db = c.get('db');
          const current = permanentOrNotFound(await getMenuItem(db, id), id);
          const next = { ...current, ...c.req.valid('json') };
          const errors = validateMenuItem(next);
          if (errors) {
            return validationFailed(c, errors);
          }
          const item = await updatePermanentItem(db, id, next, next.category !== current.category);
          await cacheFor(c.env).purgeAll();
          return c.json({ item: permanentOrNotFound(item, id) });
        },
      )

      .post('/items/:id/deactivate', validate('param', itemParams), async (c) => {
        const { id } = c.req.valid('param');
        const db = c.get('db');
        permanentOrNotFound(await getMenuItem(db, id), id);
        const item = await deactivateItem(db, id);
        await cacheFor(c.env).purgeAll();
        return c.json({ item: permanentOrNotFound(item, id) });
      })

      // Weekly and permanent items alike.
      .post(
        '/items/:id/sold-out',
        validate('param', itemParams),
        validate('json', soldOutBody),
        async (c) => {
          const { id } = c.req.valid('param');
          const db = c.get('db');
          const item = await setSoldOut(db, id, c.req.valid('json').soldOut);
          if (!item) {
            throw new HttpError(404, 'item_not_found', `No menu item ${id}`);
          }
          const cache = cacheFor(c.env);
          if (isWeeklyCategory(item.category)) {
            await purgeWeeks(cache, await weeksOfItems(db, [id]));
          } else {
            await cache.purgeAll();
          }
          return c.json({ item });
        },
      )

      // ---- Weeks ----

      .get('/weeks/:year/:week', validate('param', weekParams), async (c) => {
        const { year, week } = c.req.valid('param');
        return c.json(await readWeek(c.get('db'), year, week));
      })

      .put(
        '/weeks/:year/:week',
        validate('param', weekParams),
        validate('json', weekBody),
        async (c) => {
          const { year, week } = c.req.valid('param');
          const draft = c.req.valid('json');
          const db = c.get('db');
          const stored = await getMenuItems(db, weekDraftIds(draft));
          const result = planWeek(draft, new Map(stored.map((item) => [item.id, item])));
          if (!result.ok) {
            return validationFailed(c, result.fields);
          }
          await writeWeek(db, year, week, result.plan);
          // An edited item may also be on other weeks.
          const edited = result.plan.items.flatMap((item) =>
            item.id !== null && item.changed ? [item.id] : [],
          );
          await purgeWeeks(cacheFor(c.env), [
            { isoYear: year, isoWeek: week },
            ...(await weeksOfItems(db, edited)),
          ]);
          return c.json(await readWeek(db, year, week));
        },
      )

      .post('/weeks/:year/:week/publish', validate('param', weekParams), async (c) => {
        const { year, week } = c.req.valid('param');
        const publishedAt = await publishWeek(c.get('db'), year, week);
        if (!publishedAt) {
          throw new HttpError(404, 'week_not_found', `No menu for ${year}/${week}; save it first`);
        }
        await cacheFor(c.env).purgeWeek(year, week);
        return c.json({ week: { isoYear: year, isoWeek: week, publishedAt } });
      })

      // ---- Closed dates ----

      .get('/closed-dates', validate('query', closedDateRangeQuery), async (c) => {
        const { from, to } = c.req.valid('query');
        return c.json({ dates: await listClosedDates(c.get('db'), from, to) });
      })

      // Orders already placed for the date are left as they are; only new submissions are refused.
      .post('/closed-dates', validate('json', closedDateBody), async (c) => {
        const { date } = c.req.valid('json');
        const created = await addClosedDate(c.get('db'), date);
        const { isoYear, isoWeek } = isoWeekOf(parseIsoDate(date, c.get('config').timezone));
        await cacheFor(c.env).purgeWeek(isoYear, isoWeek);
        return c.json({ date, created });
      })

      .delete('/closed-dates/:date', validate('param', closedDateParams), async (c) => {
        const { date } = c.req.valid('param');
        const deleted = await removeClosedDate(c.get('db'), date);
        const { isoYear, isoWeek } = isoWeekOf(parseIsoDate(date, c.get('config').timezone));
        await cacheFor(c.env).purgeWeek(isoYear, isoWeek);
        return c.json({ date, deleted });
      })
  );
}

/** Weekly items are edited through their week, so `/items/:id` knows only permanent ones. */
function permanentOrNotFound(item: MenuItem | null, id: string): MenuItem {
  if (!item || isWeeklyCategory(item.category)) {
    throw new HttpError(404, 'item_not_found', `No permanent menu item ${id}`);
  }
  return item;
}

async function purgeWeeks(cache: MenuCache, weeks: readonly IsoWeek[]): Promise<void> {
  const unique = new Map(weeks.map((week) => [`${week.isoYear}-${week.isoWeek}`, week]));
  for (const { isoYear, isoWeek } of unique.values()) {
    await cache.purgeWeek(isoYear, isoWeek);
  }
}
