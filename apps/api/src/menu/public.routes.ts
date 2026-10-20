import {
  firstOrderableDay,
  type IsPublished,
  isoDate,
  isoWeekOf,
  type OrderWindow,
  orderWindow,
  type PublicMenu,
} from '@piccolo/core';
import { Hono } from 'hono';
import { etag, RETAINED_304_HEADERS } from 'hono/etag';
import type { AppEnv, Bindings } from '../env';
import { HttpError } from '../errors';
import { withConfig, withDb } from '../middleware';
import { validate } from '../validation';
import type { PublicMenuCache } from './cache';
import { publicWeek } from './public';
import { publicMenuQuery } from './schemas';

/**
 * `GET /api/menu`, mounted at `/api/menu`. Anonymous, and the same for every guest at a given
 * moment. A cached week costs no database query (docs/STACK.md rule 4).
 *
 * The response is revalidated on every request (`Cache-Control: no-cache`, `ETag`): the browser
 * may keep it, but `orderableDates` changes at the cutoff, so it must ask each time. A matching
 * `If-None-Match` gets 304. Outside production `X-Db-Queries` counts the database queries.
 *
 * `now` is the request time; tests pass a fixed clock.
 */
export function publicMenuRoutes(
  cacheFor: (env: Bindings) => PublicMenuCache,
  now: () => Date = () => new Date(),
) {
  return new Hono<AppEnv>().use(withConfig, withDb).get(
    '/',
    etag({
      retainedHeaders: [...RETAINED_304_HEADERS, 'access-control-allow-origin', 'x-db-queries'],
    }),
    validate('query', publicMenuQuery),
    async (c) => {
      const at = now();
      const config = c.get('config');
      // `orderWindow` reads one week only: the week of the first orderable day.
      const windowWeek = isoWeekOf(firstOrderableDay(at, config));
      const { week: requested } = c.req.valid('query');
      const { isoYear, isoWeek } = requested ?? windowWeek;
      const week = await publicWeek(cacheFor(c.env), c.get('db'), config, isoYear, isoWeek);

      c.header('Cache-Control', 'no-cache');
      if (c.env.ENVIRONMENT !== 'production') {
        c.header('X-Db-Queries', String(c.get('dbQueries')()));
      }

      const isPublished: IsPublished = (year, number) => {
        if (year !== isoYear || number !== isoWeek) {
          throw new Error(
            `orderWindow asked about ${year}/${number}, but ${isoYear}/${isoWeek} was loaded`,
          );
        }
        return week.published;
      };
      // A requested week other than the window's has no orderable day now.
      const window =
        isoYear === windowWeek.isoYear && isoWeek === windowWeek.isoWeek
          ? orderWindow(at, config, isPublished, week.published ? week.closedDates : [])
          : null;

      if (requested) {
        if (!week.published) {
          throw new HttpError(
            404,
            'week_not_published',
            `No published menu for ${isoYear}/${isoWeek}`,
          );
        }
        return c.json(open(week.menu, window?.kind === 'open' ? window : null));
      }
      if (window?.kind === 'open' && week.published) {
        return c.json(open(week.menu, window));
      }
      if (window?.kind === 'next_week_not_published') {
        // The guest-facing text is the web app's (apps/web/src/strings.ts), not the API's.
        return c.json({ state: 'next_week_not_published' as const });
      }
      return c.json({ state: 'closed' as const });
    },
  );
}

type OpenWindow = Extract<OrderWindow, { kind: 'open' }>;

/** `window` is `null` for a requested week other than the window's: nothing to order in it now. */
function open(menu: PublicMenu, window: OpenWindow | null) {
  return {
    state: 'open' as const,
    menu,
    /** `YYYY-MM-DD`, ascending, all in `menu`'s week. */
    orderableDates: (window?.dates ?? []).map(isoDate),
    /** Days staff closed that could otherwise still be ordered: `YYYY-MM-DD`, ascending. */
    closedDates: (window?.closed ?? []).map(isoDate),
    weekLabel: menu.weekLabel,
  };
}
