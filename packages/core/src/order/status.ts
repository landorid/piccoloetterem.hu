/**
 * An order's life: `received` when submitted, `processed` once the kitchen has copied it into its
 * own system (it must not be copied again), `cancelled` from either. Nothing else changes an
 * order, and nothing leaves `cancelled`.
 */
export const orderStatuses = ['received', 'processed', 'cancelled'] as const;

export type OrderStatus = (typeof orderStatuses)[number];

/** The statuses staff can set. `received` is only ever the status of a new order. */
export const statusChanges = ['processed', 'cancelled'] as const;

export type StatusChange = (typeof statusChanges)[number];

const allowedFrom: Record<StatusChange, readonly OrderStatus[]> = {
  processed: ['received'],
  cancelled: ['received', 'processed'],
};

/** The statuses an order can be in for staff to set `to`. */
export function statusesBefore(to: StatusChange): readonly OrderStatus[] {
  return allowedFrom[to];
}

export function canChangeStatus(from: OrderStatus, to: StatusChange): boolean {
  return allowedFrom[to].includes(from);
}
