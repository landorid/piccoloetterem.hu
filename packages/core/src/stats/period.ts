import { addDays, addMonths, dayNumber, endOfMonth, startOfMonth } from './date';

/** The statistics period selector. */
export type PeriodPreset = '3m' | '12m' | 'ytd' | 'lastYear' | 'all' | 'custom';

/** An inclusive range of `YYYY-MM-DD` dates. */
export interface DateRange {
  from: string;
  to: string;
}

/** A resolved period; it keeps its preset because the comparisons on offer depend on it. */
export interface Period extends DateRange {
  preset: PeriodPreset;
}

/** What a period is compared with: the same range a year earlier, or the one just before it. */
export type ComparisonMode = 'yoy' | 'previous';

/**
 * The dates of `preset` on `today`. `3m` and `12m` are whole months ending with the last complete
 * month, `ytd` runs from January 1 to `today`, `lastYear` is the previous calendar year, `all`
 * runs from `dataStart` to `today` and `custom` is `custom` itself. A range starting before
 * `dataStart` is cut to start there; one that ends before it throws, as does an inverted custom
 * range.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  today: string,
  custom: DateRange | undefined,
  dataStart: string,
): Period {
  const range = presetRange(preset, today, custom, dataStart);
  if (dayNumber(range.to) < dayNumber(range.from)) {
    throw new RangeError(`The ${preset} period ends before it starts`);
  }
  if (range.to < dataStart) {
    throw new RangeError(`The ${preset} period ends before the data starts (${dataStart})`);
  }
  return { preset, from: range.from < dataStart ? dataStart : range.from, to: range.to };
}

function presetRange(
  preset: PeriodPreset,
  today: string,
  custom: DateRange | undefined,
  dataStart: string,
): DateRange {
  const thisMonth = startOfMonth(today);
  switch (preset) {
    case '3m':
    case '12m':
      return {
        from: addMonths(thisMonth, preset === '3m' ? -3 : -12),
        to: addDays(thisMonth, -1),
      };
    case 'ytd':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'lastYear': {
      const year = String(Number(today.slice(0, 4)) - 1).padStart(4, '0');
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'all':
      return { from: dataStart, to: today };
    case 'custom':
      if (!custom) {
        throw new RangeError('A custom period needs a range');
      }
      return custom;
  }
}

/**
 * The range `period` is compared with, or `null` when there is none: `previous` is only offered
 * for `3m`, `12m` and `custom`, and no comparison may start before `dataStart`. A range that ends
 * on a month's last day is compared with whole months.
 */
export function comparisonRange(
  period: Period,
  mode: ComparisonMode,
  dataStart: string,
): DateRange | null {
  const range = mode === 'yoy' ? shiftMonths(period, -12) : previousRange(period);
  return range === null || range.from < dataStart ? null : range;
}

function previousRange(period: Period): DateRange | null {
  switch (period.preset) {
    case '3m':
      return shiftMonths(period, -3);
    case '12m':
      return shiftMonths(period, -12);
    case 'custom': {
      const length = dayNumber(period.to) - dayNumber(period.from) + 1;
      return { from: addDays(period.from, -length), to: addDays(period.from, -1) };
    }
    default:
      return null;
  }
}

function shiftMonths(range: DateRange, months: number): DateRange {
  const to = addMonths(range.to, months);
  return {
    from: addMonths(range.from, months),
    to: range.to === endOfMonth(range.to) ? endOfMonth(to) : to,
  };
}

/**
 * The change from `previous` to `current` in percent, per open day when `perOpenDay` (revenue and
 * order days); `null` when there is nothing to compare with.
 */
export function compareTotals(
  current: number,
  previous: number,
  currentOpenDays: number,
  previousOpenDays: number,
  perOpenDay: boolean,
): number | null {
  if (!perOpenDay) {
    return previous === 0 ? null : (current / previous - 1) * 100;
  }
  if (previous === 0 || currentOpenDays === 0 || previousOpenDays === 0) {
    return null;
  }
  return (current / currentOpenDays / (previous / previousOpenDays) - 1) * 100;
}
