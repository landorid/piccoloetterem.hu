import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import {
  datesOfIsoWeek,
  formatDateHu,
  isHoliday,
  isOperatingDay,
  isoDate,
  isoWeekOf,
  isWeekendPrice,
  parseIsoDate,
  toZoned,
  weekday,
  weekLabel,
} from './calendar';

const tz = 'Europe/Budapest';
const HOUR = 3_600_000;

const config = {
  timezone: tz,
  operatingDays: [1, 2, 3, 4, 5, 6],
  holidays: ['2026-10-23', '2026-12-25'],
} as const;

/** A wall-clock moment in Budapest. `month` is 1-based. */
function bud(year: number, month: number, day: number, hours = 0, minutes = 0): TZDate {
  return new TZDate(year, month - 1, day, hours, minutes, tz);
}

const isoDates = (dates: readonly TZDate[]) => dates.map(isoDate);

describe('test environment', () => {
  it('runs in a host timezone far from Budapest, so host-zone leaks fail', () => {
    // Set in vitest.config.ts. Pacific/Kiritimati has been UTC+14 since 1995.
    expect(new Date('2026-01-01T00:00:00Z').getTimezoneOffset()).toBe(-14 * 60);
  });
});

describe('toZoned', () => {
  it('reads an instant as Budapest wall-clock time', () => {
    const zoned = toZoned(new Date('2026-09-07T07:29:00Z'), tz);
    expect([zoned.getHours(), zoned.getMinutes()]).toEqual([9, 29]);
    expect(isoDate(zoned)).toBe('2026-09-07');
  });

  it('rejects an unknown timezone', () => {
    expect(() => toZoned(new Date('2026-09-07T07:29:00Z'), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('parseIsoDate / isoDate', () => {
  it('parses to local midnight and round-trips', () => {
    const date = parseIsoDate('2026-03-29', tz);
    expect(date.getTime()).toBe(Date.parse('2026-03-28T23:00:00Z'));
    expect(isoDate(date)).toBe('2026-03-29');
  });

  it.each(['2026-9-7', '2026-02-30', '2026-13-01', 'tomorrow', ''])('rejects "%s"', (iso) => {
    expect(() => parseIsoDate(iso, tz)).toThrow(RangeError);
  });
});

describe('DST start in Europe/Budapest (2026-03-29, 02:00 → 03:00)', () => {
  it('jumps from 01:59 CET to 03:00 CEST', () => {
    expect(toZoned(new Date('2026-03-29T00:59:00Z'), tz).getHours()).toBe(1);
    expect(toZoned(new Date('2026-03-29T01:00:00Z'), tz).getHours()).toBe(3);
  });

  it('puts 00:30 Sunday on Sunday even though UTC is still Saturday', () => {
    const sunday = toZoned(new Date('2026-03-28T23:30:00Z'), tz);
    expect(weekday(sunday)).toBe(7);
    expect(isoWeekOf(sunday)).toEqual({ isoYear: 2026, isoWeek: 13 });
    expect(isWeekendPrice(sunday)).toBe(true);
  });

  it('puts 00:30 Monday in the next week even though UTC is still Sunday', () => {
    const monday = toZoned(new Date('2026-03-29T22:30:00Z'), tz);
    expect(weekday(monday)).toBe(1);
    expect(isoWeekOf(monday)).toEqual({ isoYear: 2026, isoWeek: 14 });
    expect(isOperatingDay(monday, config)).toBe(true);
    expect(isWeekendPrice(monday)).toBe(false);
  });

  it('lists the DST week as seven local midnights, with a 23-hour Sunday', () => {
    const week = datesOfIsoWeek(2026, 13, tz);
    expect(isoDates(week)).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ]);
    for (const date of week) expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
    const nextMonday = datesOfIsoWeek(2026, 14, tz)[0];
    expect(nextMonday.getTime() - week[6].getTime()).toBe(23 * HOUR);
  });
});

describe('DST end in Europe/Budapest (2026-10-25, 03:00 → 02:00)', () => {
  it('repeats 02:30, once in CEST and once in CET', () => {
    expect(toZoned(new Date('2026-10-25T00:30:00Z'), tz).getHours()).toBe(2);
    expect(toZoned(new Date('2026-10-25T01:30:00Z'), tz).getHours()).toBe(2);
  });

  it('keeps 23:30 Sunday on Sunday although CEST would already make it Monday', () => {
    const sunday = toZoned(new Date('2026-10-25T22:30:00Z'), tz);
    expect(isoDate(sunday)).toBe('2026-10-25');
    expect(weekday(sunday)).toBe(7);
    expect(isoWeekOf(sunday)).toEqual({ isoYear: 2026, isoWeek: 43 });
    expect(isOperatingDay(sunday, config)).toBe(false);
  });

  it('starts Monday at 23:00 UTC', () => {
    const monday = toZoned(new Date('2026-10-25T23:00:00Z'), tz);
    expect(weekday(monday)).toBe(1);
    expect(isoWeekOf(monday)).toEqual({ isoYear: 2026, isoWeek: 44 });
  });

  it('lists the DST week as seven local midnights, with a 25-hour Sunday', () => {
    const week = datesOfIsoWeek(2026, 43, tz);
    expect(isoDates(week)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    for (const date of week) expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
    const nextMonday = datesOfIsoWeek(2026, 44, tz)[0];
    expect(nextMonday.getTime() - week[6].getTime()).toBe(25 * HOUR);
  });
});

describe('ISO week boundaries', () => {
  it.each([
    ['2024-12-29', 2024, 52, 7],
    ['2024-12-30', 2025, 1, 1],
    ['2024-12-31', 2025, 1, 2],
    ['2025-01-01', 2025, 1, 3],
    ['2025-01-02', 2025, 1, 4],
    ['2025-01-03', 2025, 1, 5],
    ['2026-12-31', 2026, 53, 4],
    ['2027-01-03', 2026, 53, 7],
    ['2027-01-04', 2027, 1, 1],
  ])('%s is ISO %i-W%i, weekday %i', (iso, isoYear, isoWeek, day) => {
    const date = parseIsoDate(iso, tz);
    expect(isoWeekOf(date)).toEqual({ isoYear, isoWeek });
    expect(weekday(date)).toBe(day);
  });

  it('2025-W01 starts on Monday 2024-12-30', () => {
    expect(isoDates(datesOfIsoWeek(2025, 1, tz))).toEqual([
      '2024-12-30',
      '2024-12-31',
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
    ]);
  });

  it('2026 has 53 ISO weeks and 2026-W53 runs into 2027', () => {
    const week = datesOfIsoWeek(2026, 53, tz);
    expect([isoDate(week[0]), isoDate(week[6])]).toEqual(['2026-12-28', '2027-01-03']);
  });

  it('crosses the year boundary by Budapest time, not UTC', () => {
    // 00:30 on Monday 2024-12-30 in Budapest is still Sunday 2024-12-29 in UTC.
    const monday = toZoned(new Date('2024-12-29T23:30:00Z'), tz);
    expect(isoWeekOf(monday)).toEqual({ isoYear: 2025, isoWeek: 1 });
  });

  it.each([
    [2025, 53],
    [2026, 0],
    [2026, 54],
    [2026, 1.5],
    [2026.5, 1],
  ])('rejects %d-W%d', (isoYear, isoWeek) => {
    expect(() => datesOfIsoWeek(isoYear, isoWeek, tz)).toThrow(RangeError);
  });
});

describe('isHoliday', () => {
  it('matches a configured holiday for the whole Budapest day', () => {
    expect(isHoliday(bud(2026, 10, 23, 12), config)).toBe(true);
    // 00:30 on Oct 23 in Budapest, still Oct 22 in UTC.
    expect(isHoliday(new Date('2026-10-22T22:30:00Z'), config)).toBe(true);
    expect(isHoliday(bud(2026, 10, 23, 23, 59), config)).toBe(true);
  });

  it('does not match the days around it', () => {
    expect(isHoliday(bud(2026, 10, 22, 23, 59), config)).toBe(false);
    expect(isHoliday(bud(2026, 10, 24), config)).toBe(false);
  });

  it('is independent of isOperatingDay', () => {
    // Friday 2026-10-23 is a holiday on an operating weekday.
    expect(isOperatingDay(bud(2026, 10, 23), config)).toBe(true);
  });
});

describe('isOperatingDay', () => {
  it('follows config.operatingDays in the config timezone', () => {
    expect(isOperatingDay(bud(2026, 9, 7), config)).toBe(true);
    expect(isOperatingDay(bud(2026, 9, 12, 23, 59), config)).toBe(true);
    expect(isOperatingDay(bud(2026, 9, 13), config)).toBe(false);
    // 00:30 on Sunday in Budapest, still Saturday in UTC.
    expect(isOperatingDay(new Date('2026-09-12T22:30:00Z'), config)).toBe(false);
  });

  it('reads a date zoned elsewhere as an instant', () => {
    // 07:30 on Monday in Tokyo is 00:30 on Monday in Budapest; the Sunday in UTC does not matter.
    const tokyo = new TZDate(2026, 8, 7, 7, 30, 'Asia/Tokyo');
    expect(isOperatingDay(tokyo, config)).toBe(true);
    expect(isOperatingDay(tokyo, { ...config, operatingDays: [7] })).toBe(false);
  });
});

describe('isWeekendPrice', () => {
  it('applies on Saturday and Sunday', () => {
    expect(isWeekendPrice(bud(2026, 9, 12))).toBe(true);
    expect(isWeekendPrice(bud(2026, 9, 13, 12))).toBe(true);
  });

  it('does not apply on Friday 23:59', () => {
    const friday = bud(2026, 9, 11, 23, 59);
    expect(isWeekendPrice(friday)).toBe(false);
    expect(isWeekendPrice(toZoned(new Date('2026-09-11T21:59:00Z'), tz))).toBe(false);
    expect(isWeekendPrice(toZoned(new Date('2026-09-11T22:00:00Z'), tz))).toBe(true);
  });

  it('does not apply Monday to Friday', () => {
    expect(datesOfIsoWeek(2026, 37, tz).map(isWeekendPrice)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});

describe('formatDateHu', () => {
  it.each([
    ['2026-09-07', '2026. szeptember 7., hétfő'],
    ['2026-01-01', '2026. január 1., csütörtök'],
    ['2026-12-26', '2026. december 26., szombat'],
    ['2027-01-03', '2027. január 3., vasárnap'],
  ])('%s → %s', (iso, expected) => {
    expect(formatDateHu(parseIsoDate(iso, tz))).toBe(expected);
  });

  it('formats the Budapest date of a late-evening instant', () => {
    expect(formatDateHu(toZoned(new Date('2026-09-06T22:30:00Z'), tz))).toBe(
      '2026. szeptember 7., hétfő',
    );
  });
});

describe('weekLabel', () => {
  it('spans the operating days of the week', () => {
    expect(weekLabel(2026, 37, config)).toBe('2026/37. hét (09.07 – 09.12)');
    expect(weekLabel(2026, 37, { operatingDays: [2, 3, 4, 5, 6, 7] })).toBe(
      '2026/37. hét (09.08 – 09.13)',
    );
  });

  it('crosses a year boundary', () => {
    expect(weekLabel(2025, 1, config)).toBe('2025/1. hét (12.30 – 01.04)');
    expect(weekLabel(2026, 53, config)).toBe('2026/53. hét (12.28 – 01.02)');
  });

  it('rejects a config without operating days or a missing week', () => {
    expect(() => weekLabel(2026, 37, { operatingDays: [] })).toThrow(RangeError);
    expect(() => weekLabel(2025, 53, config)).toThrow(RangeError);
  });
});
