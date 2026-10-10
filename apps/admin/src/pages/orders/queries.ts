import { ApiError, unwrap } from '@piccolo/api-client';
import type { OrderStatus, StatusChange } from '@piccolo/core';
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api';

/*
 * The orders screen's reads and writes, through the typed client. The keys sit under
 * `['admin', 'orders']`, so a status change invalidates the list, the detail and S3's summary
 * together.
 */

const orders = api.api.admin.orders;

export type StatusFilter = OrderStatus | 'all';

export interface OrderFilters {
  /** `YYYY-MM-DD`. */
  date: string;
  status: StatusFilter;
  /** Trimmed; `''` is no search. */
  q: string;
}

/** The list polls this often while the page is visible (TanStack pauses it in the background). */
export const pollInterval = 30_000;

export const ordersKey = ['admin', 'orders'] as const;

/** The day the list opens on without a `?date=`: today until the cutoff, then the next operating day. */
export const defaultDateQuery = queryOptions({
  queryKey: [...ordersKey, 'default-date'],
  queryFn: async () => unwrap(await orders['default-date'].$get()),
  // The day only moves at the cutoff and at midnight; a stale one is corrected on the next mount.
  staleTime: 60_000,
});

async function fetchPage({ date, status, q }: OrderFilters, cursor: string | undefined) {
  return unwrap(
    await orders.$get({
      query: { date, status, ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) },
    }),
  );
}

/** One row of the list, and what a status change returns. */
export type OrderRow = Awaited<ReturnType<typeof fetchPage>>['orders'][number];

/**
 * Every order of the day that matches, newest first. The API pages by 200; a day rarely has more,
 * and following the cursor here keeps one list for the poll to replace whole.
 */
async function fetchDay(filters: OrderFilters): Promise<OrderRow[]> {
  const rows: OrderRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(filters, cursor);
    rows.push(...page.orders);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

export const listsKey = [...ordersKey, 'list'] as const;

export const listQuery = (filters: OrderFilters) =>
  queryOptions({
    queryKey: [...listsKey, filters.date, filters.status, filters.q],
    queryFn: () => fetchDay(filters),
    refetchInterval: pollInterval,
    // While a search is typed, keep showing the day's previous results; never another day's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === filters.date ? previous : undefined,
  });

async function fetchOrder(id: string) {
  return unwrap(await orders[':id'].$get({ param: { id } }));
}

export type OrderDetail = Awaited<ReturnType<typeof fetchOrder>>;

export const detailKey = (id: string) => [...ordersKey, 'detail', id] as const;

export const detailQuery = (id: string) =>
  queryOptions({
    queryKey: detailKey(id),
    queryFn: () => fetchOrder(id),
    // An open order cancelled from another session updates along with the list.
    refetchInterval: pollInterval,
  });

/**
 * Sets `to`. The changed row, or `null` when the order already had `to`: another staff member
 * (or a double click) got there first, and the work is done. A conflict with any other status
 * throws `invalid_transition`.
 */
export async function changeStatus(id: string, to: StatusChange): Promise<OrderRow | null> {
  const response = await orders[':id'].status.$post({ param: { id }, json: { status: to } });
  if (response.status !== 409) {
    return (await unwrap(response)).order;
  }
  const body = await response.json();
  if (!('error' in body)) {
    throw new ApiError(409, 'unknown', 'A 409 without an error code');
  }
  if (body.status === to) {
    return null;
  }
  throw new ApiError(409, body.error, body.message);
}
