import { describe, expect, it } from 'vitest';
import { openMenu } from '../test/fixtures';
import { cutoffNote, weekDays } from './days';

describe('weekDays', () => {
  it('marks orderable days open, closed ones closed and the rest past', () => {
    const days = weekDays(
      openMenu.menu,
      ['2026-09-09', '2026-09-11', '2026-09-12'],
      ['2026-09-10'],
    );
    expect(days.map(({ date, index, state }) => [date, index, state])).toEqual([
      ['2026-09-07', 0, 'past'],
      ['2026-09-08', 1, 'past'],
      ['2026-09-09', 2, 'open'],
      ['2026-09-10', 3, 'closed'],
      ['2026-09-11', 4, 'open'],
      ['2026-09-12', 5, 'open'],
    ]);
  });

  it('marks a closed day before the first orderable one closed, not past', () => {
    const days = weekDays(
      openMenu.menu,
      ['2026-09-10', '2026-09-11'],
      ['2026-09-09', '2026-09-12'],
    );
    expect(days.map(({ state }) => state)).toEqual([
      'past',
      'past',
      'closed',
      'open',
      'open',
      'closed',
    ]);
  });
});

describe('cutoffNote', () => {
  const dates = ['2026-09-09', '2026-09-10'];
  const cutoff = '09:30';

  it('promises today while today is the first orderable day', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 9, 8, 0), cutoff)).toBe('today');
  });

  it('says today is over once the cutoff has passed on a weekday and tomorrow is first', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 8, 9, 30), cutoff)).toBe('tomorrow');
    expect(cutoffNote(['2026-10-01'], new Date(2026, 8, 30, 23, 59), cutoff)).toBe('tomorrow');
  });

  it('says nothing before the cutoff, when staff closed today and tomorrow is first', () => {
    expect(cutoffNote(['2026-09-08'], new Date(2026, 8, 7, 8, 0), cutoff)).toBeNull();
    expect(cutoffNote(['2026-09-08'], new Date(2026, 8, 7, 9, 29), cutoff)).toBeNull();
  });

  it('says nothing on a Sunday, which has no intake to close', () => {
    expect(cutoffNote(['2026-09-07'], new Date(2026, 8, 6, 12, 0), cutoff)).toBeNull();
  });

  it('says nothing when the first orderable day is further away', () => {
    expect(cutoffNote(dates, new Date(2026, 8, 5, 12, 0), cutoff)).toBeNull();
    expect(cutoffNote([], new Date(2026, 8, 9, 8, 0), cutoff)).toBeNull();
  });
});
