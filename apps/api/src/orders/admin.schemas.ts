import { orderStatuses, statusChanges } from '@piccolo/core';
import { z } from 'zod';

/** `GET /api/admin/orders` returns at most this many orders per page. */
export const orderPageSize = 200;

const date = z.iso.date();

/**
 * `GET /?date=&status=&q=&cursor=`. `q` is trimmed, and empty means no search. `cursor` is the
 * `nextCursor` of the previous page.
 */
export const orderListQuery = z.object({
  date,
  status: z.enum([...orderStatuses, 'all']).default('all'),
  q: z.string().trim().max(200).optional(),
  cursor: z.uuid().optional(),
});

export type OrderListQuery = z.infer<typeof orderListQuery>;

export const dateQuery = z.object({ date });

export const orderParams = z.object({ id: z.uuid() });

export const statusBody = z.object({ status: z.enum(statusChanges) });
