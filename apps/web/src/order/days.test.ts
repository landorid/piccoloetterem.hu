import { describe, expect, it } from 'vitest';
import { openMenu } from '../test/fixtures';
import { cutoffNote, weekDays } from './days';

describe('weekDays', () => {
  it('marks days before the first orderable one past, and later gaps closed', () => {
    const days = weekDays(openMenu.menu, ['2026-09-09', '2026-09-11', '2026-09-12']);
    expect(days.map(({ date, index, state }) => [date, index, state])).toEqual([
      ['2026-09-07', 0, 'past'],
      ['2026-09-08', 1, 'past'],
      ['2026-09-09', 2, 'open'],
      ['2026-09-10', 3, 'closed'],
      ['2026-09-11', 4, 'open'],
      ['2026-09-12', 5, 'open'],
    ]);
  });
});

describe('cutoffNote', () => {
  const dates = ['2026-09-09', '2026-09-10'];

  it('promises today while today is the first orderable day', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 9, 8, 0))).toBe('today');
  });

  it('says today is over when the first orderable day is tomorrow', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 8, 10, 0))).toBe('tomorrow');
    expect(cutoffNote(['2026-10-01'], new Date(2026, 8, 30, 23, 59))).toBe('tomorrow');
  });

  it('says nothing when the first orderable day is further away', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 5, 12, 0))).toBeNull();
    expect(cutoffNote([], new Date(2026, 8, 9, 8, 0))).toBeNull();
  });
});
