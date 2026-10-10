import { type OrderStatus, orderStatuses } from '@piccolo/core';
import { format } from 'date-fns';
import type { StatusFilter } from './queries';

/** The status chips, in order. */
export const statusFilters: readonly StatusFilter[] = ['all', ...orderStatuses];

/** `?status=` of the URL; anything else is `all`. */
export function parseStatusFilter(value: string | null): StatusFilter {
  return statusFilters.find((filter) => filter === value) ?? 'all';
}

/**
 * The orders new since `previous` (id → status, the rows the page last showed), or whose status
 * changed: what another staff member or a guest did since the last poll.
 */
export function changedOrderIds(
  previous: ReadonlyMap<string, OrderStatus>,
  rows: readonly { id: string; status: OrderStatus }[],
): string[] {
  return rows.filter((row) => previous.get(row.id) !== row.status).map((row) => row.id);
}

/**
 * The id `step` rows away from `selected` in `ids`, clamped to the list. Without a selection (or
 * when it left the list), moving down starts at the first row and moving up at the last.
 */
export function moveSelection(
  ids: readonly string[],
  selected: string | undefined,
  step: 1 | -1,
): string | undefined {
  if (ids.length === 0) {
    return undefined;
  }
  const index = selected === undefined ? -1 : ids.indexOf(selected);
  if (index === -1) {
    return step === 1 ? ids[0] : ids.at(-1);
  }
  return ids[Math.min(Math.max(index + step, 0), ids.length - 1)];
}

const forint = new Intl.NumberFormat('hu-HU');

/** Whole forints with Hungarian grouping, without the currency: `12 350`. */
export function formatAmount(amount: number): string {
  return forint.format(amount);
}

/** `HH:mm` of an API timestamp, in the browser's zone (staff work in Hungary). */
export function formatTime(timestamp: string): string {
  return format(new Date(timestamp), 'HH:mm');
}

/** `yyyy.MM.dd. HH:mm` of an API timestamp, in the browser's zone. */
export function formatDateTime(timestamp: string): string {
  return format(new Date(timestamp), 'yyyy.MM.dd. HH:mm');
}
