import { describe, expect, it } from 'vitest';
import {
  dayFull,
  dayNumber,
  forint,
  longDay,
  signedForint,
  telHref,
  timeOfDay,
  weekRange,
} from './format';

describe('format', () => {
  it('writes forints the Hungarian way, grouping from five digits', () => {
    expect(forint(650)).toBe('650\u00a0Ft');
    expect(forint(2200)).toBe('2200\u00a0Ft');
    expect(forint(10400)).toMatch(/^10[\u00a0\u202f]400\u00a0Ft$/);
  });

  it('signs an adjustment with a plus or a minus sign, and leaves zero bare', () => {
    expect(signedForint(650)).toBe('+650\u00a0Ft');
    expect(signedForint(-100)).toBe('−100\u00a0Ft');
    expect(signedForint(0)).toBe('0\u00a0Ft');
  });

  it('names a calendar date without reading a clock', () => {
    expect(longDay('2026-10-05')).toBe('október 5., hétfő');
    expect(dayFull('2026-09-09')).toBe('Szerda, szept. 9.');
    expect(dayFull('2026-09-12')).toBe('Szombat, szept. 12.');
    expect(dayNumber('2026-09-07')).toBe('7');
  });

  it('writes a week range with the month once, or twice across months', () => {
    expect(weekRange('2026-09-07', '2026-09-12')).toBe('szeptember 7. – 12.');
    expect(weekRange('2026-08-31', '2026-09-05')).toBe('augusztus 31. – szeptember 5.');
  });

  it('drops the leading zero of a time of day', () => {
    expect(timeOfDay('07:30')).toBe('7:30');
    expect(timeOfDay('09:30')).toBe('9:30');
    expect(timeOfDay('11:00')).toBe('11:00');
  });

  it('turns a phone number into a tel: link', () => {
    expect(telHref('+36 30 490 1122')).toBe('tel:+36304901122');
    expect(telHref('(94) 123-456')).toBe('tel:94123456');
  });
});
