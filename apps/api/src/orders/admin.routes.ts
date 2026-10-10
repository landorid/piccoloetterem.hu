import { isoDate, staffOrdersDay } from '@piccolo/core';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { HttpError } from '../errors';
import { withConfig, withDb } from '../middleware';
import { validate } from '../validation';
import { changeStatus, daySummary, deliveryList, listOrders, readOrder } from './admin.repo';
import { dateQuery, orderListQuery, orderParams, statusBody } from './admin.schemas';

/**
 * Staff order work, mounted at `/api/admin/orders` behind `requireStaff`. Orders are never edited
 * or deleted here: the only write is a status change, and it sends no e-mail.
 *
 * `now` is the request time; tests pass a fixed clock.
 */
export function adminOrderRoutes(now: () => Date = () => new Date()) {
  return (
    new Hono<AppEnv>()
      .use(withDb)

      .get('/', validate('query', orderListQuery), async (c) => {
        return c.json(await listOrders(c.get('db'), c.req.valid('query')));
      })

      // Before `/:id`, which would otherwise take these paths.

      // The day the order list opens on: today until the cutoff, then the next operating day.
      // Reads the config, never the database.
      .get('/default-date', withConfig, (c) =>
        c.json({ date: isoDate(staffOrdersDay(now(), c.get('config'))) }),
      )

      .get('/summary', validate('query', dateQuery), async (c) => {
        return c.json(await daySummary(c.get('db'), c.req.valid('query').date));
      })

      .get('/delivery-list', validate('query', dateQuery), async (c) => {
        return c.json(await deliveryList(c.get('db'), c.req.valid('query').date));
      })

      .get('/:id', validate('param', orderParams), async (c) => {
        const { id } = c.req.valid('param');
        const order = await readOrder(c.get('db'), id);
        if (!order) {
          throw new HttpError(404, 'order_not_found', `No order ${id}`);
        }
        return c.json(order);
      })

      .post(
        '/:id/status',
        validate('param', orderParams),
        validate('json', statusBody),
        async (c) => {
          const { id } = c.req.valid('param');
          const to = c.req.valid('json').status;
          const result = await changeStatus(c.get('db'), id, to);
          if (result.ok) {
            return c.json({ order: result.order });
          }
          if (result.current === null) {
            throw new HttpError(404, 'order_not_found', `No order ${id}`);
          }
          return c.json(
            {
              error: 'invalid_transition' as const,
              status: result.current,
              message: `A ${result.current} order cannot become ${to}`,
            },
            409,
          );
        },
      )
  );
}
