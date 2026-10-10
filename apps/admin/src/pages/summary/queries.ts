import { unwrap } from '@piccolo/api-client';
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api';

/**
 * Both screens poll every 60 s. TanStack pauses `refetchInterval` while the tab is hidden and
 * refetches when it is shown again. The keys sit under `['admin', 'orders']`, so a status change
 * on the orders screen that invalidates that prefix refreshes them at once.
 */
const refetchInterval = 60_000;

/** The kitchen's counts for a delivery date (`GET /api/admin/orders/summary`). */
export const daySummaryQuery = (date: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', 'summary', date],
    queryFn: async () => unwrap(await api.api.admin.orders.summary.$get({ query: { date } })),
    refetchInterval,
  });

/** The courier's list for a delivery date, by address (`GET /api/admin/orders/delivery-list`). */
export const deliveryListQuery = (date: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', 'delivery-list', date],
    queryFn: async () =>
      unwrap(await api.api.admin.orders['delivery-list'].$get({ query: { date } })),
    refetchInterval,
  });

type Data<Options extends { queryFn?: unknown }> = Awaited<
  ReturnType<Extract<Options['queryFn'], (...args: never[]) => unknown>>
>;

export type DaySummary = Data<ReturnType<typeof daySummaryQuery>>;
export type DeliveryList = Data<ReturnType<typeof deliveryListQuery>>;
