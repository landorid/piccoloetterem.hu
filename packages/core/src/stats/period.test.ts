import { describe, expect, it } from 'vitest';
import { compareTotals, comparisonRange, type Period, resolvePeriod } from './period';

const dataStart = '2017-05-02';

describe('resolvePeriod', () => {
  it.each([
    ['3m', '2026-08-01', '2026-10-31'],
    ['12m', '2025-11-01', '2026-10-31'],
    ['ytd', '2026-01-01', '2026-11-02'],
    ['lastYear', '2025-01-01', '2025-12-31'],
    ['all', dataStart, '2026-11-02'],
  ] as const)('resolves %s on 2026-11-02 to %s … %s', (preset, from, to) => {
    expect(resolvePeriod(preset, '2026-11-02', undefined, dataStart)).toEqual({ preset, from, to });
  });

  it.each([
    ['3m', '2026-10-01', '2026-12-31'],
    ['12m', '2026-01-01', '2026-12-31'],
    ['ytd', '2027-01-01', '2027-01-05'],
    ['lastYear', '2026-01-01', '2026-12-31'],
  ] as const)('resolves %s in January to %s … %s', (preset, from, to) => {
    expect(resolvePeriod(preset, '2027-01-05', undefined, dataStart)).toMatchObject({ from, to });
  });

  it('ends a whole-month range on February 29 in a leap year', () => {
    expect(resolvePeriod('3m', '2028-03-10', undefined, dataStart)).toMatchObject({
      from: '2027-12-01',
      to: '2028-02-29',
    });
    expect(resolvePeriod('ytd', '2028-01-01', undefined, dataStart)).toMatchObject({
      from: '2028-01-01',
      to: '2028-01-01',
    });
  });

  it('returns a custom range as given', () => {
    const custom = { from: '2026-03-15', to: '2026-04-14' };
    expect(resolvePeriod('custom', '2026-11-02', custom, dataStart)).toEqual({
      preset: 'custom',
      ...custom,
    });
  });

  it('starts a range that begins before the data at the data start', () => {
    const custom = { from: '2017-01-01', to: '2017-06-30' };
    expect(resolvePeriod('custom', '2026-11-02', custom, dataStart)).toMatchObject({
      from: dataStart,
      to: '2017-06-30',
    });
    expect(resolvePeriod('12m', '2017-09-10', undefined, dataStart)).toMatchObject({
      from: dataStart,
      to: '2017-08-31',
    });
  });

  it('rejects a range that ends before the data starts', () => {
    const custom = { from: '2016-01-01', to: '2016-12-31' };
    expect(() => resolvePeriod('custom', '2026-11-02', custom, dataStart)).toThrow(RangeError);
    expect(() => resolvePeriod('lastYear', '2017-06-01', undefined, dataStart)).toThrow(RangeError);
  });

  it('rejects a missing, inverted or invalid custom range', () => {
    expect(() => resolvePeriod('custom', '2026-11-02', undefined, dataStart)).toThrow(RangeError);
    const inverted = { from: '2026-05-01', to: '2026-04-30' };
    expect(() => resolvePeriod('custom', '2026-11-02', inverted, dataStart)).toThrow(RangeError);
    const invalid = { from: '2026-02-30', to: '2026-03-31' };
    expect(() => resolvePeriod('custom', '2026-11-02', invalid, dataStart)).toThrow(RangeError);
  });
});

describe('comparisonRange', () => {
  const resolve = (preset: Period['preset'], today: string) =>
    resolvePeriod(preset, today, undefined, dataStart);

  it.each([
    ['3m', '2025-08-01', '2025-10-31'],
    ['12m', '2024-11-01', '2025-10-31'],
    ['ytd', '2025-01-01', '2025-11-02'],
    ['lastYear', '2024-01-01', '2024-12-31'],
  ] as const)('compares %s with the same dates a year earlier', (preset, from, to) => {
    expect(comparisonRange(resolve(preset, '2026-11-02'), 'yoy', dataStart)).toEqual({ from, to });
  });

  it.each([
    ['3m', '2026-05-01', '2026-07-31'],
    ['12m', '2024-11-01', '2025-10-31'],
  ] as const)('compares %s with the months just before it', (preset, from, to) => {
    expect(comparisonRange(resolve(preset, '2026-11-02'), 'previous', dataStart)).toEqual({
      from,
      to,
    });
  });

  it('compares a custom range with the same number of days just before it', () => {
    const period = resolvePeriod(
      'custom',
      '2026-11-02',
      { from: '2026-10-01', to: '2026-10-10' },
      dataStart,
    );
    expect(comparisonRange(period, 'previous', dataStart)).toEqual({
      from: '2026-09-21',
      to: '2026-09-30',
    });
    expect(comparisonRange(period, 'yoy', dataStart)).toEqual({
      from: '2025-10-01',
      to: '2025-10-10',
    });
  });

  it('keeps whole months across leap years', () => {
    // 2028-02-29 a year earlier is the end of February 2027, and back again.
    expect(comparisonRange(resolve('3m', '2028-03-10'), 'yoy', dataStart)).toEqual({
      from: '2026-12-01',
      to: '2027-02-28',
    });
    expect(comparisonRange(resolve('3m', '2029-03-10'), 'yoy', dataStart)).toEqual({
      from: '2027-12-01',
      to: '2028-02-29',
    });
    // A custom range ending on February 29 is a whole month too.
    const custom = resolvePeriod(
      'custom',
      '2028-03-10',
      { from: '2028-02-10', to: '2028-02-29' },
      dataStart,
    );
    expect(comparisonRange(custom, 'yoy', dataStart)).toEqual({
      from: '2027-02-10',
      to: '2027-02-28',
    });
  });

  it('offers no previous period for ytd, lastYear and all', () => {
    for (const preset of ['ytd', 'lastYear', 'all'] as const) {
      expect(comparisonRange(resolve(preset, '2026-11-02'), 'previous', dataStart)).toBeNull();
    }
  });

  it('offers nothing that starts before the data', () => {
    expect(comparisonRange(resolve('all', '2026-11-02'), 'yoy', dataStart)).toBeNull();
    expect(comparisonRange(resolve('12m', '2018-05-10'), 'yoy', dataStart)).toBeNull();
    expect(comparisonRange(resolve('3m', '2018-09-10'), 'yoy', dataStart)).toEqual({
      from: '2017-06-01',
      to: '2017-08-31',
    });
    const early = resolvePeriod(
      'custom',
      '2026-11-02',
      { from: '2017-01-01', to: '2017-06-30' },
      dataStart,
    );
    expect(comparisonRange(early, 'previous', dataStart)).toBeNull();
    expect(comparisonRange(early, 'yoy', dataStart)).toBeNull();
  });
});

describe('compareTotals', () => {
  it('compares totals in percent', () => {
    expect(compareTotals(120, 100, 24, 20, false)).toBeCloseTo(20);
    expect(compareTotals(80, 100, 24, 20, false)).toBeCloseTo(-20);
  });

  it('compares per open day when asked', () => {
    // 5 a day against 5 a day.
    expect(compareTotals(120, 100, 24, 20, true)).toBeCloseTo(0);
    expect(compareTotals(120, 100, 20, 20, true)).toBeCloseTo(20);
  });

  it('has nothing to compare with an empty previous period', () => {
    expect(compareTotals(120, 0, 24, 20, false)).toBeNull();
    expect(compareTotals(120, 0, 24, 20, true)).toBeNull();
    expect(compareTotals(120, 100, 0, 20, true)).toBeNull();
    expect(compareTotals(120, 100, 24, 0, true)).toBeNull();
  });
});
