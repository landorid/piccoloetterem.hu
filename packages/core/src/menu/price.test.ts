import { describe, expect, it } from 'vitest';
import { parseIsoDate, toZoned } from '../calendar';
import { priceFor } from './price';

const tz = 'Europe/Budapest';
const at = (iso: string) => parseIsoDate(iso, tz);

describe('priceFor — rule: weekday vs weekend price by the delivery date (Saturday = weekend)', () => {
  const item = { priceWeekday: 1890, priceWeekend: 2190 };

  it.each([
    ['Monday', '2026-09-07'],
    ['Friday', '2026-09-11'],
  ])('uses the weekday price on %s', (_day, iso) => {
    expect(priceFor(item, at(iso))).toBe(1890);
  });

  it.each([
    ['Saturday', '2026-09-12'],
    ['Sunday', '2026-09-13'],
  ])('uses the weekend price on %s', (_day, iso) => {
    expect(priceFor(item, at(iso))).toBe(2190);
  });

  it('falls back to the weekday price when the item has no weekend price', () => {
    expect(priceFor({ priceWeekday: 1890, priceWeekend: null }, at('2026-09-12'))).toBe(1890);
  });

  it('keeps a weekend price of 0 instead of falling back', () => {
    expect(priceFor({ priceWeekday: 450, priceWeekend: 0 }, at('2026-09-12'))).toBe(0);
  });

  it('decides by the Budapest date, not the UTC date', () => {
    // 22:30 UTC on Friday is 00:30 Saturday in Budapest.
    expect(priceFor(item, toZoned(new Date('2026-09-11T22:30:00Z'), tz))).toBe(2190);
  });
});
