import type { RestaurantConfig, Weekday } from '../config/types';
import { addMonths, dayNumber, fromDayNumber, weekdayOf } from './date';

/** The days the restaurant could have taken orders on. */
export interface OpenDayCalendar {
  operatingDays: readonly Weekday[];
  /** `YYYY-MM-DD`: `closed_dates` for new data, operating days without orders for old data. */
  closedDays: readonly string[];
}

/** Open days strictly after `from`, up to and including `to`; 0 when `to` is not after `from`. */
export function openDaysBetween(from: string, to: string, calendar: OpenDayCalendar): number {
  const closed = new Set(calendar.closedDays);
  const last = dayNumber(to);
  let open = 0;
  for (let day = dayNumber(from) + 1; day <= last; day++) {
    if (calendar.operatingDays.includes(weekdayOf(day)) && !closed.has(fromDayNumber(day))) {
      open++;
    }
  }
  return open;
}

/** Where a customer stands: `slowing` is `lassuló`, `fading` `elhalványult`, `lost` `elveszett`. */
export type CustomerStatus = 'active' | 'slipping' | 'slowing' | 'fading' | 'lost';

export interface CustomerRhythm {
  status: CustomerStatus;
  /** At least `regularMinOrderDays` order days in the last `regularWindowMonths` months. */
  regular: boolean;
  /** Median open days between consecutive order days in that window; `null` below two of them. */
  medianGapOpenDays: number | null;
  openDaysSinceLast: number;
  /** A regular customer is `slipping` above this many open days since the last order. */
  thresholdOpenDays: number | null;
}

/**
 * A customer's rhythm and status on `today` from their order dates (any order, duplicates
 * allowed; dates after `today` count as `today`). A regular customer is `active`, or `slipping`
 * when the open days since the last order exceed max(multiplier × median gap, minimum). Everyone
 * else is banded by calendar months since the last order: under 1 `active`, under 3 `slowing`,
 * under 12 `fading`, else `lost`.
 */
export function customerStatus(
  orderDates: readonly string[],
  today: string,
  context: OpenDayCalendar & Pick<RestaurantConfig, 'statistics'>,
): CustomerRhythm {
  const { statistics } = context;
  const dates = [...new Set(orderDates.map((date) => (date > today ? today : date)))].sort();
  dayNumber(today);
  dates.forEach(dayNumber);
  const last = dates.at(-1);
  if (last === undefined) {
    throw new RangeError('customerStatus needs at least one order date');
  }

  const windowStart = addMonths(today, -statistics.regularWindowMonths);
  const recent = dates.filter((date) => date > windowStart);
  const gaps = recent
    .slice(1)
    .map((date, i) => openDaysBetween(recent[i] as string, date, context));
  const medianGapOpenDays = median(gaps);
  const regular = recent.length >= statistics.regularMinOrderDays;
  const openDaysSinceLast = openDaysBetween(last, today, context);

  if (regular && medianGapOpenDays !== null) {
    const thresholdOpenDays = Math.max(
      statistics.slippingGapMultiplier * medianGapOpenDays,
      statistics.slippingMinDays,
    );
    return {
      status: openDaysSinceLast > thresholdOpenDays ? 'slipping' : 'active',
      regular,
      medianGapOpenDays,
      openDaysSinceLast,
      thresholdOpenDays,
    };
  }
  return {
    status: monthBand(last, today),
    regular: false,
    medianGapOpenDays,
    openDaysSinceLast,
    thresholdOpenDays: null,
  };
}

function monthBand(last: string, today: string): CustomerStatus {
  if (today < addMonths(last, 1)) {
    return 'active';
  }
  if (today < addMonths(last, 3)) {
    return 'slowing';
  }
  return today < addMonths(last, 12) ? 'fading' : 'lost';
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}
