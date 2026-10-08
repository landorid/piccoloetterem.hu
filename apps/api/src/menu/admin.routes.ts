import {
  groupPermanentItems,
  isoWeekOf,
  isWeeklyCategory,
  parseIsoDate,
  permanentDraftIds,
  planPermanentItems,
  planWeek,
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
  getMenuItems,
  type IsoWeek,
  listClosedDates,
  listPermanentItems,
  publishWeek,
  readWeek,
  removeClosedDate,
  setSoldOut,
  weeksOfItems,
  writePermanentItems,
  writeWeek,
} from './repo';
import {
  closedDateBody,
  closedDateParams,
  closedDateRangeQuery,
  itemParams,
  permanentItemsBody,
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
 * - saving the permanent menu, or a permanent item's sold-out flag → every week (once per request),
 *   because permanent items appear on every week's menu.
 * Purging is idempotent, so a repeated request purges again even when it changed nothing.
 */
export function adminMenuRoutes(cacheFor: (env: Bindings) => MenuCache) {
  return (
    new Hono<AppEnv>()
      .use(withConfig, withDb)

      // ---- Permanent items ----

      .get('/items', async (c) => {
        return c.json(groupPermanentItems(await listPermanentItems(c.get('db'))));
      })

      .put('/items', validate('json', permanentItemsBody), async (c) => {
        const draft = c.req.valid('json');
        const db = c.get('db');
        const stored = await getMenuItems(db, permanentDraftIds(draft));
        const result = planPermanentItems(draft, new Map(stored.map((item) => [item.id, item])));
        if (!result.ok) {
          return validationFailed(c, result.fields);
        }
        await writePermanentItems(db, result.plan);
        await cacheFor(c.env).purgeAll();
        return c.json(groupPermanentItems(await listPermanentItems(db)));
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

async function purgeWeeks(cache: MenuCache, weeks: readonly IsoWeek[]): Promise<void> {
  const unique = new Map(weeks.map((week) => [`${week.isoYear}-${week.isoWeek}`, week]));
  for (const { isoYear, isoWeek } of unique.values()) {
    await cache.purgeWeek(isoYear, isoWeek);
  }
}
