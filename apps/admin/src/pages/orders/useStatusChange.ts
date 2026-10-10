import type { OrderStatus, StatusChange } from '@piccolo/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { strings } from '@/strings';
import {
  changeStatus,
  detailKey,
  listsKey,
  type OrderDetail,
  type OrderRow,
  ordersKey,
} from './queries';

interface Change {
  id: string;
  to: StatusChange;
}

type Patch = Pick<OrderRow, 'status' | 'processedAt' | 'cancelledAt'>;

/**
 * Marks an order processed or cancelled, optimistically: every cached list and the detail show the
 * new status at once, and go back if the API refuses (the global toast says why). `onStatus` hears
 * each status the page itself puts on a row, so it does not count as a change from elsewhere.
 * Afterwards everything under `['admin', 'orders']` is refetched, S3's summary included.
 */
export function useStatusChange(onStatus: (id: string, status: OrderStatus) => void) {
  const queryClient = useQueryClient();

  const patchCache = (id: string, patch: (current: Patch) => Patch) => {
    queryClient.setQueriesData<OrderRow[]>({ queryKey: listsKey }, (rows) =>
      rows?.map((row) => (row.id === id ? { ...row, ...patch(row) } : row)),
    );
    queryClient.setQueryData<OrderDetail>(detailKey(id), (order) =>
      order ? { ...order, ...patch(order) } : order,
    );
  };

  return useMutation({
    mutationFn: ({ id, to }: Change) => changeStatus(id, to),

    onMutate: async ({ id, to }) => {
      // A poll that lands after the optimistic write would put the old status back.
      await queryClient.cancelQueries({ queryKey: ordersKey });
      const lists = queryClient.getQueriesData<OrderRow[]>({ queryKey: listsKey });
      const detail = queryClient.getQueryData<OrderDetail>(detailKey(id));
      const previous =
        detail?.status ??
        lists.flatMap(([, rows]) => rows ?? []).find((row) => row.id === id)?.status;
      const now = new Date().toISOString();
      onStatus(id, to);
      patchCache(id, (current) => ({
        status: to,
        processedAt: to === 'processed' ? now : current.processedAt,
        cancelledAt: to === 'cancelled' ? now : current.cancelledAt,
      }));
      return { lists, detail, previous };
    },

    onError: (_error, { id }, context) => {
      if (!context) {
        return;
      }
      for (const [key, rows] of context.lists) {
        queryClient.setQueryData(key, rows);
      }
      queryClient.setQueryData(detailKey(id), context.detail);
      if (context.previous) {
        onStatus(id, context.previous);
      }
    },

    onSuccess: (row, { id, to }) => {
      if (row) {
        const { status, processedAt, cancelledAt } = row;
        patchCache(id, () => ({ status, processedAt, cancelledAt }));
      }
      toast.success(
        row === null
          ? strings.orders.toasts.alreadyDone
          : to === 'processed'
            ? strings.orders.toasts.processed
            : strings.orders.toasts.cancelled,
      );
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersKey }),
  });
}
