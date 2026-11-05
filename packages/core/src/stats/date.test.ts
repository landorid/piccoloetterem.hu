import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  endOfMonth,
  fromDayNumber,
  isIsoDay,
  startOfMonth,
  weekdayOf,
} from './date';

describe('statistics calendar arithmetic', () => {
  it.each(['2026-11-02', '2028-02-29', '1999-12-31'])('accepts %s', (iso) => {
    expect(isIsoDay(iso)).toBe(true);
    expect(fromDayNumber(dayNumber(iso))).toBe(iso);
  });

  it.each(['2027-02-29', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-2', 'tegnap'])(
    'rejects %s',
    (iso) => {
      expect(isIsoDay(iso)).toBe(false);
      expect(() => dayNumber(iso)).toThrow(RangeError);
    },
  );

  it('numbers days from 1970-01-01 and knows their weekday', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(weekdayOf(dayNumber('1970-01-01'))).toBe(4);
    expect(weekdayOf(dayNumber('1969-12-28'))).toBe(7);
    expect(weekdayOf(dayNumber('2026-11-02'))).toBe(1);
    expect(weekdayOf(dayNumber('2026-11-07'))).toBe(6);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('adds calendar months, clamping the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2026-11-02', -12)).toBe('2025-11-02');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(() => addMonths('2026-02-30', 1)).toThrow(RangeError);
  });

  it('finds the first and last day of a month', () => {
    expect(startOfMonth('2026-11-02')).toBe('2026-11-01');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });
});
