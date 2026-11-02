import { describe, expect, it } from 'vitest';
import { piccolo } from '../config/piccolo';
import { addDays } from './date';
import { customerStatus, type OpenDayCalendar, openDaysBetween } from './rhythm';

const monToSat: OpenDayCalendar = { operatingDays: [1, 2, 3, 4, 5, 6], closedDays: [] };
const context = { ...monToSat, statistics: piccolo.statistics };

/** The `n`th open day after `from` (`n` = 0 is `from` itself). */
function openDay(from: string, n: number, calendar: OpenDayCalendar = monToSat): string {
  let date = from;
  for (let found = 0; found < n; ) {
    date = addDays(date, 1);
    if (openDaysBetween(addDays(date, -1), date, calendar) === 1) {
      found++;
    }
  }
  return date;
}

/** `count` consecutive open days, the first one `from`. */
function dailyOrders(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => openDay(from, i));
}

describe('openDaysBetween', () => {
  it('counts operating days after `from` up to and including `to`', () => {
    // Monday 2026-10-05 to Monday 2026-10-12: Tue–Sat and the next Monday.
    expect(openDaysBetween('2026-10-05', '2026-10-12', monToSat)).toBe(6);
    expect(openDaysBetween('2026-10-05', '2026-10-06', monToSat)).toBe(1);
  });

  it('is 0 for an empty or inverted range', () => {
    expect(openDaysBetween('2026-10-05', '2026-10-05', monToSat)).toBe(0);
    expect(openDaysBetween('2026-10-12', '2026-10-05', monToSat)).toBe(0);
  });

  it('skips Sundays and closed days', () => {
    // Saturday 2026-10-10 to Monday 2026-10-12: Sunday is not an operating day.
    expect(openDaysBetween('2026-10-10', '2026-10-12', monToSat)).toBe(1);
    const closed = { ...monToSat, closedDays: ['2026-10-23', '2026-10-24'] };
    expect(openDaysBetween('2026-10-19', '2026-10-26', closed)).toBe(4);
  });

  it('honours the operating days', () => {
    expect(openDaysBetween('2026-10-04', '2026-10-31', { ...monToSat, operatingDays: [6] })).toBe(
      4,
    );
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() => openDaysBetween('2026-02-30', '2026-03-01', monToSat)).toThrow(RangeError);
  });
});

describe('customerStatus', () => {
  // A regular who ordered every open day from Monday 2026-09-07 to Friday 2026-10-02: median gap
  // 1, so the threshold is the 14-day minimum.
  const regular = dailyOrders('2026-09-07', 23);
  const last = '2026-10-02';

  it.each([
    [13, 'active'],
    [14, 'active'],
    [15, 'slipping'],
  ] as const)('a daily regular %i open days after the last order is %s', (days, status) => {
    const today = openDay(last, days);
    expect(customerStatus(regular, today, context)).toEqual({
      status,
      regular: true,
      medianGapOpenDays: 1,
      openDaysSinceLast: days,
      thresholdOpenDays: 14,
    });
  });

  it('uses the multiple of the median gap when that is above the minimum', () => {
    // Every 6th open day, 10 times: median 6, threshold 18.
    const dates = Array.from({ length: 10 }, (_, i) => openDay('2026-06-01', i * 6));
    const lastDate = dates.at(-1) as string;
    expect(customerStatus(dates, openDay(lastDate, 18), context)).toMatchObject({
      status: 'active',
      medianGapOpenDays: 6,
      thresholdOpenDays: 18,
    });
    expect(customerStatus(dates, openDay(lastDate, 19), context).status).toBe('slipping');
  });

  it('is regular with exactly 8 order days in the window, not with 7', () => {
    const eight = dailyOrders('2026-10-01', 8);
    expect(customerStatus(eight, '2026-10-12', context).regular).toBe(true);
    const seven = eight.slice(1);
    expect(customerStatus(seven, '2026-10-12', context)).toEqual({
      status: 'active',
      regular: false,
      medianGapOpenDays: 1,
      openDaysSinceLast: 2,
      thresholdOpenDays: null,
    });
  });

  it('counts the window as the last 6 calendar months, today excluded from its start', () => {
    // 8 order days, the first exactly 6 months before today: only 7 are in the window.
    const dates = ['2026-04-12', ...dailyOrders('2026-10-01', 7)];
    expect(customerStatus(dates, '2026-10-12', context).regular).toBe(false);
    const inWindow = ['2026-04-13', ...dailyOrders('2026-10-01', 7)];
    expect(customerStatus(inWindow, '2026-10-12', context).regular).toBe(true);
  });

  it('measures a gap spanning closed days in open days', () => {
    // Every open day of December up to the 19th, closed from Monday 21st to Saturday 2 January.
    const closedDays = dailyOrders('2026-12-21', 12);
    const calendar = { ...monToSat, closedDays, statistics: piccolo.statistics };
    const dates = [...dailyOrders('2026-12-01', 17), '2027-01-04', '2027-01-05'];
    expect(customerStatus(dates, '2027-01-20', calendar)).toEqual({
      status: 'active',
      regular: true,
      medianGapOpenDays: 1,
      openDaysSinceLast: 13,
      thresholdOpenDays: 14,
    });
    // Three weeks after the last December order, only one of them open: still active.
    const december = dailyOrders('2026-12-01', 17);
    expect(customerStatus(december, '2027-01-11', calendar)).toMatchObject({
      status: 'active',
      openDaysSinceLast: 7,
    });
    expect(customerStatus(december, '2027-01-11', context)).toMatchObject({
      status: 'slipping',
      openDaysSinceLast: 19,
    });
  });

  it('gives a Saturday-only customer a weekly rhythm', () => {
    // Ten Saturdays from 2026-08-01 to 2026-10-03: a gap of 6 open days, threshold 18.
    const saturdays = Array.from({ length: 10 }, (_, i) => addDays('2026-08-01', i * 7));
    const atThreshold = customerStatus(saturdays, '2026-10-24', context);
    expect(atThreshold).toEqual({
      status: 'active',
      regular: true,
      medianGapOpenDays: 6,
      openDaysSinceLast: 18,
      thresholdOpenDays: 18,
    });
    // The Monday after, three weeks and one open day later.
    expect(customerStatus(saturdays, '2026-10-26', context).status).toBe('slipping');
  });

  it('takes the mean of the two middle gaps for an even number of gaps', () => {
    // Gaps 1, 1, 1, 1, 3, 3, 3, 3 open days.
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    for (let i = 0; i < 4; i++) {
      dates.push(openDay(dates.at(-1) as string, 3));
    }
    expect(customerStatus(dates, dates.at(-1) as string, context)).toMatchObject({
      regular: true,
      medianGapOpenDays: 2,
      thresholdOpenDays: 14,
    });
  });

  it.each([
    ['2026-02-27', 'active'],
    ['2026-02-28', 'slowing'],
    ['2026-04-29', 'slowing'],
    ['2026-04-30', 'fading'],
    ['2027-01-30', 'fading'],
    ['2027-01-31', 'lost'],
    ['2030-06-01', 'lost'],
  ] as const)('an occasional customer last seen 2026-01-31 is on %s %s', (today, status) => {
    const result = customerStatus(['2025-12-15', '2026-01-31'], today, context);
    expect(result.status).toBe(status);
    expect(result.regular).toBe(false);
    expect(result.thresholdOpenDays).toBeNull();
  });

  it('has no median gap with fewer than two order days in the window', () => {
    expect(customerStatus(['2026-10-01'], '2026-10-02', context)).toEqual({
      status: 'active',
      regular: false,
      medianGapOpenDays: null,
      openDaysSinceLast: 1,
      thresholdOpenDays: null,
    });
  });

  it('ignores duplicates and order, and counts a future order day as today', () => {
    const dates = [...regular].reverse();
    dates.push(regular[0] as string, '2026-12-01');
    const result = customerStatus(dates, '2026-11-02', context);
    expect(result).toMatchObject({ status: 'active', regular: true, openDaysSinceLast: 0 });
  });

  it('rejects an empty history and bad dates', () => {
    expect(() => customerStatus([], '2026-11-02', context)).toThrow(RangeError);
    expect(() => customerStatus(['2026-11-31'], '2026-12-02', context)).toThrow(RangeError);
    expect(() => customerStatus(['2026-11-01'], '2026-11-31', context)).toThrow(RangeError);
  });
});
