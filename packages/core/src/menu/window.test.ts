import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import { isoDate, parseIsoDate, weekday } from '../calendar';
import { loadConfig } from '../config/load';
import {
  firstOrderableDay,
  type IsPublished,
  isOrderable,
  type OrderWindow,
  orderWindow,
} from './window';

const config = loadConfig({ RESTAURANT: 'piccolo' });
const tz = config.timezone;

/** A Budapest wall-clock moment as a plain instant, so no zone travels with it. `month` is 1-based. */
function bud(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(new TZDate(year, month - 1, day, hours, minutes, tz).getTime());
}

function published(...weeks: [isoYear: number, isoWeek: number][]): IsPublished {
  return (isoYear, isoWeek) => weeks.some(([y, w]) => y === isoYear && w === isoWeek);
}

const view = (window: OrderWindow) =>
  window.kind === 'open' ? { ...window, dates: window.dates.map(isoDate) } : window;

const open = (isoYear: number, isoWeek: number, dates: string[]) => ({
  kind: 'open' as const,
  isoYear,
  isoWeek,
  dates,
});

// 2026/37 is Mon 09-07 … Sun 09-13; 2026/38 is Mon 09-14 … Sun 09-20.
const w37 = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
const w38 = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];
const both = published([2026, 37], [2026, 38]);

interface Case {
  name: string;
  now: Date;
  isPublished?: IsPublished;
  closedDates?: string[];
  expected: ReturnType<typeof view>;
}

function runTable(cases: Case[]) {
  it.each(cases)('$name', ({ now, isPublished = both, closedDates = [], expected }) => {
    expect(view(orderWindow(now, config, isPublished, closedDates))).toEqual(expected);
  });
}

describe('orderWindow — rule: cutoff 09:30 decides the first orderable day', () => {
  runTable([
    { name: 'Mon 09:29 → today..Sat', now: bud(2026, 9, 7, 9, 29), expected: open(2026, 37, w37) },
    {
      name: 'Mon 09:30 → the cutoff minute itself closes today: Tue..Sat',
      now: bud(2026, 9, 7, 9, 30),
      expected: open(2026, 37, w37.slice(1)),
    },
    {
      name: 'Mon 09:31 → Tue..Sat',
      now: bud(2026, 9, 7, 9, 31),
      expected: open(2026, 37, w37.slice(1)),
    },
    {
      name: 'Mon 07:31 UTC is 09:31 in Budapest → Tue..Sat',
      now: new Date('2026-09-07T07:31:00Z'),
      expected: open(2026, 37, w37.slice(1)),
    },
    {
      name: 'Wed 00:00 → today..Sat',
      now: bud(2026, 9, 9),
      expected: open(2026, 37, w37.slice(2)),
    },
    {
      name: 'Thu 09:31 → Fri..Sat',
      now: bud(2026, 9, 10, 9, 31),
      expected: open(2026, 37, w37.slice(4)),
    },
    {
      name: 'Fri 09:29 → Fri..Sat',
      now: bud(2026, 9, 11, 9, 29),
      expected: open(2026, 37, w37.slice(4)),
    },
  ]);
});

describe('orderWindow — rule: Friday after cutoff, Saturday and Sunday roll to next week', () => {
  runTable([
    {
      name: 'Fri 09:31 → next Mon..Sat when next week is published',
      now: bud(2026, 9, 11, 9, 31),
      expected: open(2026, 38, w38),
    },
    {
      name: 'Fri 09:31 → next_week_not_published when next week is not published',
      now: bud(2026, 9, 11, 9, 31),
      isPublished: published([2026, 37]),
      expected: { kind: 'next_week_not_published' },
    },
    {
      name: 'Sat 08:00 → next week (Saturday is past the last same-week order day)',
      now: bud(2026, 9, 12, 8, 0),
      expected: open(2026, 38, w38),
    },
    {
      name: 'Sat 08:00 → next_week_not_published when next week is not published',
      now: bud(2026, 9, 12, 8, 0),
      isPublished: published([2026, 37]),
      expected: { kind: 'next_week_not_published' },
    },
    { name: 'Sun 12:00 → next week', now: bud(2026, 9, 13, 12, 0), expected: open(2026, 38, w38) },
    {
      name: 'Sun 23:59 → next_week_not_published when next week is not published',
      now: bud(2026, 9, 13, 23, 59),
      isPublished: published([2026, 37]),
      expected: { kind: 'next_week_not_published' },
    },
    {
      name: 'Sun 00:30 on the DST night (2026-03-29) → next Mon..Sat',
      now: new Date('2026-03-28T23:30:00Z'),
      isPublished: published([2026, 14]),
      expected: open(2026, 14, [
        '2026-03-30',
        '2026-03-31',
        '2026-04-01',
        '2026-04-02',
        '2026-04-03',
        '2026-04-04',
      ]),
    },
  ]);
});

describe('orderWindow — rule: the week must be published', () => {
  runTable([
    {
      name: 'current week unpublished → closed_week',
      now: bud(2026, 9, 7, 9, 29),
      isPublished: published([2026, 38]),
      expected: { kind: 'closed_week' },
    },
    {
      name: 'Tue 12:00, current week unpublished → closed_week, even with next week published',
      now: bud(2026, 9, 8, 12, 0),
      isPublished: published([2026, 38]),
      expected: { kind: 'closed_week' },
    },
  ]);
});

describe('orderWindow — rule: closed dates are never orderable', () => {
  runTable([
    {
      name: 'a Monday closed date is removed from dates',
      now: bud(2026, 9, 7, 9, 29),
      closedDates: ['2026-09-07'],
      expected: open(2026, 37, w37.slice(1)),
    },
    {
      name: 'a closed Wednesday is skipped inside the window',
      now: bud(2026, 9, 7, 9, 31),
      closedDates: ['2026-09-09'],
      expected: open(2026, 37, ['2026-09-08', '2026-09-10', '2026-09-11', '2026-09-12']),
    },
    {
      name: 'a closed date in an unrelated week has no effect',
      now: bud(2026, 9, 7, 9, 29),
      closedDates: ['2026-09-05', '2026-09-21', '2025-09-08'],
      expected: open(2026, 37, w37),
    },
    {
      name: 'a closed next Monday after roll-over is removed from dates',
      now: bud(2026, 9, 11, 9, 31),
      closedDates: ['2026-09-14'],
      expected: open(2026, 38, w38.slice(1)),
    },
    {
      name: 'Thu 09:31 with Fri and Sat closed → closed_week, no early roll-over',
      now: bud(2026, 9, 10, 9, 31),
      closedDates: ['2026-09-11', '2026-09-12'],
      expected: { kind: 'closed_week' },
    },
  ]);
});

describe('orderWindow — rule: ISO week and year boundary (Dec 28 – Jan 4)', () => {
  // 2026 has 53 ISO weeks: 2026/53 is Mon 2026-12-28 … Sun 2027-01-03; 2027/1 starts 2027-01-04.
  const w53 = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'];
  const w1 = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09'];
  const yearEnd = published([2026, 53], [2027, 1]);

  runTable([
    {
      name: 'Mon 2026-12-28 09:29 → 2026/53, Dec 28..Jan 2',
      now: bud(2026, 12, 28, 9, 29),
      isPublished: yearEnd,
      expected: open(2026, 53, w53),
    },
    {
      name: 'Thu 2026-12-31 09:31 → Fri Jan 1..Sat Jan 2, still in 2026/53',
      now: bud(2026, 12, 31, 9, 31),
      isPublished: yearEnd,
      expected: open(2026, 53, w53.slice(4)),
    },
    {
      name: 'Fri 2027-01-01 09:31 → 2027/1, Jan 4..9',
      now: bud(2027, 1, 1, 9, 31),
      isPublished: yearEnd,
      expected: open(2027, 1, w1),
    },
    {
      name: 'Sun 2027-01-03 → 2027/1',
      now: bud(2027, 1, 3, 18, 0),
      isPublished: yearEnd,
      expected: open(2027, 1, w1),
    },
    {
      name: 'Fri 2027-01-01 09:31, 2027/1 unpublished → next_week_not_published',
      now: bud(2027, 1, 1, 9, 31),
      isPublished: published([2026, 53]),
      expected: { kind: 'next_week_not_published' },
    },
  ]);
});

describe('orderWindow — rule: orderable days run through Saturday; Sunday never', () => {
  it('asks about the week it opens, and nothing else', () => {
    const asked: string[] = [];
    orderWindow(
      bud(2026, 9, 11, 9, 31),
      config,
      (y, w) => {
        asked.push(`${y}/${w}`);
        return true;
      },
      [],
    );
    expect(asked).toEqual(['2026/38']);
  });

  it('every hour of two weeks: open windows end on Saturday and never contain Sunday', () => {
    const start = bud(2026, 9, 7).getTime();
    for (let hour = 0; hour < 14 * 24; hour++) {
      const now = new Date(start + hour * 3_600_000);
      const window = orderWindow(now, config, () => true, []);
      expect(window.kind).toBe('open');
      if (window.kind !== 'open') continue;
      const days = window.dates.map(weekday);
      expect(days).not.toContain(7);
      expect(days.at(-1)).toBe(6);
      expect(window.dates[0]?.getTime()).toBeGreaterThanOrEqual(
        firstOrderableDay(now, config).getTime(),
      );
    }
  });
});

describe('firstOrderableDay', () => {
  it.each([
    ['Mon 09:29 → Mon', bud(2026, 9, 7, 9, 29), '2026-09-07'],
    ['Mon 09:31 → Tue', bud(2026, 9, 7, 9, 31), '2026-09-08'],
    ['Thu 09:31 → Fri', bud(2026, 9, 10, 9, 31), '2026-09-11'],
    ['Fri 09:29 → Fri', bud(2026, 9, 11, 9, 29), '2026-09-11'],
    ['Fri 09:31 → next Mon', bud(2026, 9, 11, 9, 31), '2026-09-14'],
    ['Sat 08:00 → next Mon', bud(2026, 9, 12, 8, 0), '2026-09-14'],
    ['Sun 12:00 → next Mon', bud(2026, 9, 13, 12, 0), '2026-09-14'],
  ])('%s', (_name, now, expected) => {
    expect(isoDate(firstOrderableDay(now, config))).toBe(expected);
  });

  it('returns local midnight in the restaurant timezone', () => {
    const first = firstOrderableDay(bud(2026, 9, 7, 9, 29), config);
    expect(first.getTime()).toBe(Date.parse('2026-09-06T22:00:00Z'));
  });

  it('follows lastSameWeekOrderDay from config', () => {
    const thursdayLast = { ...config, lastSameWeekOrderDay: 4 as const };
    expect(isoDate(firstOrderableDay(bud(2026, 9, 10, 9, 29), thursdayLast))).toBe('2026-09-10');
    expect(isoDate(firstOrderableDay(bud(2026, 9, 10, 9, 31), thursdayLast))).toBe('2026-09-14');
  });

  it('follows the cutoff from config', () => {
    const tenOClock = { ...config, cutoff: '10:00' };
    expect(isoDate(firstOrderableDay(bud(2026, 9, 7, 9, 45), tenOClock))).toBe('2026-09-07');
  });

  it.each(['9:30', '24:00', '09:60', ''])('rejects the cutoff "%s"', (cutoff) => {
    expect(() => firstOrderableDay(bud(2026, 9, 7), { ...config, cutoff })).toThrow(RangeError);
  });
});

describe('isOrderable', () => {
  const at = (iso: string) => parseIsoDate(iso, tz);

  it('accepts a day inside the window', () => {
    expect(isOrderable(at('2026-09-08'), bud(2026, 9, 7, 9, 31), config, both, [])).toBe(true);
  });

  it('rejects today once the cutoff has passed', () => {
    expect(isOrderable(at('2026-09-07'), bud(2026, 9, 7, 9, 31), config, both, [])).toBe(false);
  });

  it('closes Saturday orders at Friday 09:30', () => {
    const saturday = at('2026-09-12');
    expect(isOrderable(saturday, bud(2026, 9, 11, 9, 29), config, both, [])).toBe(true);
    expect(isOrderable(saturday, bud(2026, 9, 11, 9, 30), config, both, [])).toBe(false);
  });

  it('rejects Sunday', () => {
    expect(isOrderable(at('2026-09-13'), bud(2026, 9, 7, 8, 0), config, both, [])).toBe(false);
  });

  it('rejects a closed date', () => {
    const closed = ['2026-09-09'];
    expect(isOrderable(at('2026-09-09'), bud(2026, 9, 7, 8, 0), config, both, closed)).toBe(false);
  });

  it('rejects a day of next week while the current week is still open', () => {
    expect(isOrderable(at('2026-09-14'), bud(2026, 9, 7, 8, 0), config, both, [])).toBe(false);
  });

  it('rejects everything when next week is not published', () => {
    const only37 = published([2026, 37]);
    expect(isOrderable(at('2026-09-14'), bud(2026, 9, 12, 8, 0), config, only37, [])).toBe(false);
  });

  it('reads a plain Date delivery date in the restaurant timezone', () => {
    // 22:30 UTC on Monday is 00:30 Tuesday in Budapest.
    const tuesday = new Date('2026-09-07T22:30:00Z');
    expect(isOrderable(tuesday, bud(2026, 9, 7, 9, 31), config, both, [])).toBe(true);
  });
});
