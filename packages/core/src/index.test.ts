import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('core', () => {
  it('exposes a version', () => {
    expect(core.version).toBe('0.0.0');
  });

  it('exports the config loader and every calendar utility', () => {
    expect(Object.keys(core)).toEqual(
      expect.arrayContaining([
        'loadConfig',
        'toZoned',
        'parseIsoDate',
        'isoDate',
        'isoWeekOf',
        'datesOfIsoWeek',
        'weekday',
        'isOperatingDay',
        'isClosedDate',
        'isWeekendPrice',
        'formatDateHu',
        'weekLabel',
        'TZDate',
      ]),
    );
  });

  it('labels every allergen and category in Hungarian', () => {
    expect(Object.keys(core.allergenLabelsHu)).toEqual([...core.allergenCodes]);
    expect(Object.keys(core.categoryLabelsHu)).toEqual([
      ...core.weeklyCategories,
      ...core.permanentCategories,
    ]);
  });

  it('does not export the Piccolo instance directly', () => {
    expect(Object.keys(core)).not.toContain('piccolo');
  });
});
