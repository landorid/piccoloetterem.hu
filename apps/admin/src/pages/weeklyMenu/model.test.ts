import { type MenuItem, planWeek, type WeekDraft, type WeekItemDraft } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import {
  buildDraft,
  daysWithoutMains,
  fingerprint,
  formatWeek,
  type Grid,
  gridFromWeek,
  isBlank,
  newRow,
  parsePrice,
  parseWeek,
  placeErrors,
  shiftWeek,
  sortAllergens,
  updateList,
  weekDates,
  weekOfDate,
} from './model';

const emptyDay = { soups: [], mains: [] };
const emptyWeek: WeekDraft = {
  days: { 1: emptyDay, 2: emptyDay, 3: emptyDay, 4: emptyDay, 5: emptyDay, 6: emptyDay },
  featured: [],
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function item(n: number, overrides: Partial<WeekItemDraft> = {}): WeekItemDraft {
  return {
    id: uuid(n),
    name: `Dish ${n}`,
    description: null,
    priceWeekday: 1020,
    priceWeekend: null,
    variations: [],
    allergens: [],
    soupIncluded: true,
    requiresSide: false,
    ...overrides,
  };
}

const soup = (n: number) => item(n, { priceWeekday: 0, soupIncluded: false });

const stored: WeekDraft = {
  ...emptyWeek,
  days: {
    ...emptyWeek.days,
    1: {
      soups: [soup(1), soup(2)],
      mains: [
        item(3, { description: 'with rice', variations: ['Small', 'Large'] }),
        item(4, { allergens: ['gluten', 'milk'] }),
      ],
    },
    6: { soups: [], mains: [item(5, { priceWeekday: 1120 })] },
  },
  featured: [item(6, { priceWeekday: 2190, priceWeekend: 2390 })],
};

/** Edits the first row of a list. */
function editFirst(grid: Grid, path: Parameters<typeof updateList>[1], edit: object): Grid {
  return updateList(grid, path, ([first, ...rest]) => [{ ...first, ...edit } as never, ...rest]);
}

describe('gridFromWeek', () => {
  it('opens a week without items as the template: 3 soups and 5 mains a day', () => {
    const grid = gridFromWeek(emptyWeek);

    for (const day of [1, 2, 3, 4, 5] as const) {
      expect(grid.days[day].soups.map((row) => [row.priceWeekday, row.priceWeekend])).toEqual([
        ['0', ''],
        ['0', ''],
        ['0', ''],
      ]);
      expect(grid.days[day].mains.map((row) => [row.priceWeekday, row.priceWeekend])).toEqual([
        ['1020', ''],
        ['1020', ''],
        ['1120', ''],
        ['1120', ''],
        ['1170', ''],
      ]);
    }
    // Saturday's mains have one price, 100 more.
    expect(grid.days[6].mains.map((row) => [row.priceWeekday, row.priceWeekend])).toEqual([
      ['1120', ''],
      ['1120', ''],
      ['1220', ''],
      ['1220', ''],
      ['1270', ''],
    ]);
    expect(grid.days[1].mains.every((row) => row.soupIncluded)).toBe(true);
    expect(grid.days[1].soups.some((row) => row.soupIncluded)).toBe(false);
    // Four featured slots, all blank.
    expect(grid.featured).toHaveLength(4);
    expect(grid.featured.every(isBlank)).toBe(true);
    expect(
      Object.values(grid.days).every((day) => [...day.soups, ...day.mains].every(isBlank)),
    ).toBe(true);
  });

  it('opens a stored week row for item, and saves it back unchanged', () => {
    const grid = gridFromWeek(stored);

    expect(grid.days[1].mains[0]).toMatchObject({
      id: uuid(3),
      description: 'with rice',
      priceWeekday: '1020',
      priceWeekend: '',
    });
    expect(grid.days[2].mains).toEqual([]);
    expect(buildDraft(grid, stored)).toEqual({
      draft: stored,
      rowAt: expect.any(Map),
      errors: {},
    });
  });

  it('pads a stored day to 3 soup slots, and keeps a day that has more', () => {
    const grid = gridFromWeek(stored);

    expect(grid.days[1].soups.map((row) => row.id)).toEqual([uuid(1), uuid(2), undefined]);
    expect(grid.days[2].soups).toHaveLength(3);
    // The blank slots are left out of the save, so the week still saves back unchanged.
    expect(buildDraft(grid, stored).draft).toEqual(stored);

    const crowded = gridFromWeek({
      ...stored,
      days: { ...stored.days, 1: { ...stored.days[1], soups: [1, 2, 3, 4].map((n) => soup(n)) } },
    });
    expect(crowded.days[1].soups).toHaveLength(4);
  });

  it('gives every row a key unique in the grid, also for an item on two days', () => {
    const shared = item(7);
    const grid = gridFromWeek({
      ...emptyWeek,
      days: {
        ...emptyWeek.days,
        1: { soups: [], mains: [shared] },
        2: { soups: [], mains: [shared] },
      },
    });

    expect(grid.days[1].mains[0]?.key).not.toBe(grid.days[2].mains[0]?.key);
  });
});

describe('Saturday', () => {
  const saturdayWeek = (main: WeekItemDraft): WeekDraft => ({
    ...emptyWeek,
    days: { ...emptyWeek.days, 6: { soups: [], mains: [main] } },
  });

  it('opens a main stored with a weekend price at that price, and saves it as the one price', () => {
    const week = saturdayWeek(item(5, { priceWeekday: 1020, priceWeekend: 1120 }));
    const grid = gridFromWeek(week);

    expect(grid.days[6].mains.map((row) => [row.priceWeekday, row.priceWeekend])).toEqual([
      ['1120', ''],
    ]);
    expect(buildDraft(grid, week).draft.days[6].mains).toEqual([
      item(5, { priceWeekday: 1120, priceWeekend: null }),
    ]);
  });

  it('opens a main stored without a weekend price at its weekday price', () => {
    const week = saturdayWeek(item(5, { priceWeekday: 1170, priceWeekend: null }));
    const grid = gridFromWeek(week);

    expect(grid.days[6].mains.map((row) => [row.priceWeekday, row.priceWeekend])).toEqual([
      ['1170', ''],
    ]);
    expect(buildDraft(grid, week).draft).toEqual(week);
  });

  it('saves the Saturday row of an item that is on a weekday too as a new item', () => {
    const shared = item(7, { name: 'Rakott krumpli', priceWeekday: 2090, priceWeekend: 2290 });
    const week: WeekDraft = {
      ...emptyWeek,
      days: {
        ...emptyWeek.days,
        4: { soups: [], mains: [shared] },
        6: { soups: [], mains: [shared] },
      },
    };
    const grid = gridFromWeek(week);
    const { draft } = buildDraft(grid, week);

    expect(grid.days[4].mains[0]).toMatchObject({ priceWeekday: '2090', priceWeekend: '2290' });
    expect(draft.days[4].mains).toEqual([shared]);
    expect(draft.days[6].mains).toHaveLength(1);
    expect(draft.days[6].mains[0]).not.toHaveProperty('id');
    expect(draft.days[6].mains[0]).toMatchObject({
      name: 'Rakott krumpli',
      priceWeekday: 2290,
      priceWeekend: null,
    });
    // The API takes it: the stored item stays as it is, and Saturday gets a new one.
    const storedItem: MenuItem = {
      ...shared,
      id: uuid(7),
      category: 'daily_main',
      allergens: [],
      soldOut: false,
      active: true,
      sortOrder: 0,
    };
    expect(planWeek(draft, new Map([[uuid(7), storedItem]]))).toMatchObject({
      ok: true,
      plan: {
        items: [
          { id: uuid(7), changed: false },
          { id: null, changed: true },
        ],
      },
    });
  });
});

describe('newRow', () => {
  it('prices a sixth main like the fifth, and a featured row not at all', () => {
    expect(newRow('days.6.mains', 5)).toMatchObject({ priceWeekday: '1270', priceWeekend: '' });
    expect(newRow('featured', 0)).toMatchObject({
      priceWeekday: '',
      priceWeekend: '',
      soupIncluded: true,
    });
  });
});

describe('buildDraft', () => {
  it('leaves blank rows out and maps each sent item back to its row', () => {
    let grid = gridFromWeek(emptyWeek);
    grid = updateList(grid, 'days.2.mains', (rows) =>
      rows.map((row, i) => (i === 2 ? { ...row, name: 'Pörkölt' } : row)),
    );
    grid = updateList(grid, 'featured', () => [{ ...newRow('featured', 0), name: 'Steak' }]);

    const { draft, rowAt } = buildDraft(grid, emptyWeek);

    expect(draft.days[1]).toEqual({ soups: [], mains: [] });
    expect(draft.days[2].mains).toEqual([
      {
        name: 'Pörkölt',
        description: null,
        priceWeekday: 1120,
        priceWeekend: null,
        variations: [],
        allergens: [],
        soupIncluded: true,
        requiresSide: false,
      },
    ]);
    expect(rowAt.get('days.2.mains.0')).toBe(grid.days[2].mains[2]?.key);
    expect(rowAt.get('featured.0')).toBe(grid.featured[0]?.key);
  });

  it('keeps a row with only a description, so the API can ask for its name', () => {
    const grid = editFirst(gridFromWeek(emptyWeek), 'days.1.soups', { description: 'spicy' });

    expect(buildDraft(grid, emptyWeek).draft.days[1].soups).toMatchObject([
      { name: '', description: 'spicy' },
    ]);
  });

  it('trims names and descriptions, and sends an empty description as null', () => {
    const grid = editFirst(gridFromWeek(stored), 'days.1.mains', {
      name: '  Rántott hús ',
      description: '   ',
    });

    expect(buildDraft(grid, stored).draft.days[1].mains[0]).toMatchObject({
      id: uuid(3),
      name: 'Rántott hús',
      description: null,
    });
  });

  it('sends a negative or fractional price as typed, for the API to reject', () => {
    const grid = editFirst(gridFromWeek(stored), 'featured', {
      priceWeekday: '-50',
      priceWeekend: '1 120.5',
    });

    const built = buildDraft(grid, stored);
    expect(built.errors).toEqual({});
    expect(built.draft.featured[0]).toMatchObject({ priceWeekday: -50, priceWeekend: 1120.5 });
  });

  it('reports a price that is not a number, or a missing weekday price, by row', () => {
    let grid = gridFromWeek(stored);
    grid = editFirst(grid, 'featured', { priceWeekday: '', priceWeekend: 'sok' });
    const key = grid.featured[0]?.key ?? '';

    expect(buildDraft(grid, stored).errors).toEqual({
      [key]: { priceWeekday: 'required', priceWeekend: 'not_integer' },
    });
  });

  it('saves an edited copy of an item that sits on two days as a new item', () => {
    const shared = item(7, { name: 'Lecsó' });
    const week: WeekDraft = {
      ...emptyWeek,
      days: {
        ...emptyWeek.days,
        1: { soups: [], mains: [shared] },
        2: { soups: [], mains: [shared] },
        3: { soups: [], mains: [shared] },
      },
    };
    const grid = editFirst(gridFromWeek(week), 'days.2.mains', { name: 'Lecsó kolbásszal' });

    const { draft } = buildDraft(grid, week);
    expect(draft.days[1].mains[0]?.id).toBe(uuid(7));
    expect(draft.days[2].mains[0]).not.toHaveProperty('id');
    expect(draft.days[2].mains[0]?.name).toBe('Lecsó kolbásszal');
    expect(draft.days[3].mains[0]?.id).toBe(uuid(7));
  });

  it('keeps the id of an edited item that sits on one day only', () => {
    const grid = editFirst(gridFromWeek(stored), 'featured', { name: 'Rib-eye' });

    expect(buildDraft(grid, stored).draft.featured[0]).toMatchObject({
      id: uuid(6),
      name: 'Rib-eye',
    });
  });
});

describe('fingerprint', () => {
  it('ignores blank rows, untrimmed text and how a price is spelled', () => {
    const grid = gridFromWeek(stored);
    let same = updateList(grid, 'days.3.mains', () => [newRow('days.3.mains', 0)]);
    same = editFirst(same, 'days.1.mains', { name: 'Dish 3  ', priceWeekday: '1 020' });

    expect(fingerprint(same)).toBe(fingerprint(grid));
  });

  it('changes with any edit that would be saved', () => {
    const grid = gridFromWeek(stored);

    for (const edit of [
      { name: 'Other' },
      { description: 'new' },
      { priceWeekday: '1100' },
      { priceWeekend: '1300' },
      { variations: ['Small'] },
      { allergens: ['gluten'] },
      { soupIncluded: false },
    ]) {
      expect(fingerprint(editFirst(grid, 'days.1.mains', edit))).not.toBe(fingerprint(grid));
    }
    expect(fingerprint(updateList(grid, 'days.1.soups', (rows) => rows.slice(1)))).not.toBe(
      fingerprint(grid),
    );
  });
});

describe('parsePrice', () => {
  it.each([
    ['1020', false, { ok: true, value: 1020 }],
    [' 1 020 ', false, { ok: true, value: 1020 }],
    ['-50', false, { ok: true, value: -50 }],
    ['12.5', false, { ok: true, value: 12.5 }],
    ['', true, { ok: true, value: null }],
    ['', false, { ok: false, code: 'required' }],
    ['12,5', false, { ok: false, code: 'not_integer' }],
    ['abc', true, { ok: false, code: 'not_integer' }],
  ])('%j (optional: %s) → %j', (text, optional, expected) => {
    expect(parsePrice(text, optional)).toEqual(expected);
  });
});

describe('placeErrors', () => {
  it('puts each API error on the row and field it names', () => {
    const rowAt = new Map([
      ['days.3.mains.2', 'row-a'],
      ['featured.0', 'row-b'],
    ]);

    expect(
      placeErrors(
        {
          'days.3.mains.2.priceWeekday': 'negative',
          'days.3.mains.2.name': 'required',
          'featured.0.id': 'not_weekly',
          'featured.1.name': 'required',
          'days.3.mains.2.category': 'invalid',
          days: 'invalid_type',
        },
        rowAt,
      ),
    ).toEqual({
      errors: {
        'row-a': { priceWeekday: 'negative', name: 'required' },
        'row-b': { id: 'not_weekly' },
      },
      unplaced: {
        'featured.1.name': 'required',
        'days.3.mains.2.category': 'invalid',
        days: 'invalid_type',
      },
    });
  });
});

describe('weeks', () => {
  it('formats and parses the week parameter, rejecting a week the year does not have', () => {
    expect(formatWeek({ isoYear: 2026, isoWeek: 7 })).toBe('2026-W07');
    expect(parseWeek('2026-W53')).toEqual({ isoYear: 2026, isoWeek: 53 });
    expect(parseWeek('2025-W53')).toBeNull();
    expect(parseWeek('2026-W00')).toBeNull();
    expect(parseWeek('2026-42')).toBeNull();
    expect(parseWeek(null)).toBeNull();
  });

  it('steps across the turn of the year', () => {
    expect(shiftWeek({ isoYear: 2026, isoWeek: 53 }, 1)).toEqual({ isoYear: 2027, isoWeek: 1 });
    expect(shiftWeek({ isoYear: 2027, isoWeek: 1 }, -1)).toEqual({ isoYear: 2026, isoWeek: 53 });
    expect(shiftWeek({ isoYear: 2026, isoWeek: 41 }, 1)).toEqual({ isoYear: 2026, isoWeek: 42 });
  });

  it('lists Monday to Saturday, and finds the week of a date', () => {
    expect(weekDates({ isoYear: 2026, isoWeek: 42 })).toEqual({
      1: '2026-10-12',
      2: '2026-10-13',
      3: '2026-10-14',
      4: '2026-10-15',
      5: '2026-10-16',
      6: '2026-10-17',
    });
    expect(weekOfDate('2026-10-18')).toEqual({ isoYear: 2026, isoWeek: 42 });
    expect(weekOfDate('2027-01-01')).toEqual({ isoYear: 2026, isoWeek: 53 });
  });
});

describe('daysWithoutMains', () => {
  it('lists the stored days that have no main course', () => {
    expect(daysWithoutMains(stored)).toEqual([2, 3, 4, 5]);
  });
});

describe('sortAllergens', () => {
  it('orders codes as the EU list does and drops unknown ones', () => {
    expect(sortAllergens(['milk', 'paprika', 'gluten'])).toEqual(['gluten', 'milk']);
  });
});
