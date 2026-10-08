import { describe, expect, it } from 'vitest';
import type { Category } from '../config/types';
import {
  groupPermanentItems,
  type MenuItemContent,
  type PermanentItemDraft,
  type PermanentItemsDraft,
  permanentDraftIds,
  planPermanentItems,
  planWeek,
  type WeekDayDraft,
  type WeekDraft,
  type WeekItemDraft,
  weekDraftIds,
} from './edit';
import type { MenuDay, MenuItem } from './types';

const content = (fields: Partial<MenuItemContent> = {}): MenuItemContent => ({
  name: 'Sertéspörkölt',
  description: null,
  priceWeekday: 2190,
  priceWeekend: 2390,
  variations: [],
  allergens: [],
  soupIncluded: true,
  requiresSide: false,
  ...fields,
});

const goulash = content({
  name: 'Gulyásleves',
  priceWeekday: 0,
  priceWeekend: null,
  soupIncluded: false,
});
const stew = content();

const soup = (fields: Partial<WeekItemDraft> = {}): WeekItemDraft => ({ ...goulash, ...fields });
const main = (fields: Partial<WeekItemDraft> = {}): WeekItemDraft => ({ ...stew, ...fields });

const emptyDay = (): WeekDayDraft => ({ soups: [], mains: [] });

const draft = (
  days: Partial<Record<MenuDay, Partial<WeekDayDraft>>> = {},
  featured: WeekItemDraft[] = [],
): WeekDraft => ({
  days: {
    1: { ...emptyDay(), ...days[1] },
    2: { ...emptyDay(), ...days[2] },
    3: { ...emptyDay(), ...days[3] },
    4: { ...emptyDay(), ...days[4] },
    5: { ...emptyDay(), ...days[5] },
    6: { ...emptyDay(), ...days[6] },
  },
  featured,
});

const storedItem = (id: string, category: Category, fields: Partial<MenuItem> = {}): MenuItem => ({
  id,
  category,
  ...content(),
  soldOut: false,
  active: true,
  sortOrder: 0,
  ...fields,
});

const stored = (...items: MenuItem[]) => new Map(items.map((item) => [item.id, item]));

describe('planWeek — rule: the list fixes the category', () => {
  it('plans nothing for an empty week', () => {
    expect(planWeek(draft(), stored())).toEqual({ ok: true, plan: { items: [], schedule: [] } });
  });

  it('inserts new soups, mains and featured items with their list category and position', () => {
    const fried = main({ name: 'Rántott sajt', soupIncluded: false, requiresSide: true });
    const result = planWeek(
      draft({ 1: { soups: [soup()], mains: [main(), main({ name: 'Rakott krumpli' })] } }, [fried]),
      stored(),
    );
    expect(result).toEqual({
      ok: true,
      plan: {
        items: [
          { id: null, category: 'daily_soup', content: goulash, changed: true },
          { id: null, category: 'daily_main', content: stew, changed: true },
          {
            id: null,
            category: 'daily_main',
            content: { ...stew, name: 'Rakott krumpli' },
            changed: true,
          },
          { id: null, category: 'featured', content: fried, changed: true },
        ],
        schedule: [
          { item: 0, day: 1, sortOrder: 0 },
          { item: 1, day: 1, sortOrder: 0 },
          { item: 2, day: 1, sortOrder: 1 },
          { item: 3, day: null, sortOrder: 0 },
        ],
      },
    });
  });

  it('treats every entry without an id as a new item, even with the same content', () => {
    const result = planWeek(draft({ 1: { soups: [soup()] }, 3: { soups: [soup()] } }), stored());
    expect(result.ok && result.plan.items.map((item) => item.id)).toEqual([null, null]);
  });

  it('moves a stored weekly item to the category of the list it is placed in', () => {
    const result = planWeek(
      draft({ 2: { soups: [soup({ id: 'a' })] } }),
      stored(storedItem('a', 'daily_main', goulash)),
    );
    expect(result.ok && result.plan.items).toEqual([
      { id: 'a', category: 'daily_soup', content: goulash, changed: true },
    ]);
  });
});

describe('planWeek — rule: stored items are updated, and only when something changed', () => {
  it('leaves an unchanged stored item unwritten', () => {
    const result = planWeek(
      draft({ 1: { mains: [main({ id: 'a' })] } }),
      stored(storedItem('a', 'daily_main')),
    );
    expect(result.ok && result.plan.items).toEqual([
      { id: 'a', category: 'daily_main', content: stew, changed: false },
    ]);
  });

  it.each<[string, Partial<MenuItemContent>]>([
    ['name', { name: 'Marhapörkölt' }],
    ['description', { description: 'Nokedlivel' }],
    ['priceWeekday', { priceWeekday: 2290 }],
    ['priceWeekend', { priceWeekend: null }],
    ['variations', { variations: ['kicsi'] }],
    ['allergens', { allergens: ['gluten'] }],
    ['soupIncluded', { soupIncluded: false }],
    ['requiresSide', { requiresSide: true }],
  ])('writes a stored item whose %s changed', (_field, change) => {
    const result = planWeek(
      draft({ 1: { mains: [main({ id: 'a', ...change })] } }),
      stored(storedItem('a', 'daily_main')),
    );
    expect(result.ok && result.plan.items[0]?.changed).toBe(true);
  });

  it('compares list fields element by element, in order', () => {
    const result = planWeek(
      draft({ 1: { mains: [main({ id: 'a', allergens: ['milk', 'eggs'] })] } }),
      stored(storedItem('a', 'daily_main', { allergens: ['eggs', 'milk'] })),
    );
    expect(result.ok && result.plan.items[0]?.changed).toBe(true);
  });

  it('reactivates an inactive stored item placed on the week', () => {
    const result = planWeek(
      draft({ 1: { mains: [main({ id: 'a' })] } }),
      stored(storedItem('a', 'daily_main', { active: false })),
    );
    expect(result.ok && result.plan.items[0]?.changed).toBe(true);
  });

  it('plans an item placed on several days once, with one schedule entry per day', () => {
    const result = planWeek(
      draft({
        1: { soups: [soup({ id: 's' })] },
        3: { soups: [soup({ name: 'Paradicsomleves' }), soup({ id: 's' })] },
        5: { soups: [soup({ id: 's' })] },
      }),
      stored(storedItem('s', 'daily_soup', goulash)),
    );
    expect(result).toEqual({
      ok: true,
      plan: {
        items: [
          { id: 's', category: 'daily_soup', content: goulash, changed: false },
          {
            id: null,
            category: 'daily_soup',
            content: { ...goulash, name: 'Paradicsomleves' },
            changed: true,
          },
        ],
        schedule: [
          { item: 0, day: 1, sortOrder: 0 },
          { item: 1, day: 3, sortOrder: 0 },
          { item: 0, day: 3, sortOrder: 1 },
          { item: 0, day: 5, sortOrder: 0 },
        ],
      },
    });
  });
});

describe('planWeek — rule: ids must be consistent stored weekly items', () => {
  it('rejects an id that is not stored', () => {
    expect(planWeek(draft({ 1: { mains: [main({ id: 'x' })] } }), stored())).toEqual({
      ok: false,
      fields: { 'days.1.mains.0.id': 'unknown_item' },
    });
  });

  it('rejects a permanent item', () => {
    expect(planWeek(draft({}, [main({ id: 'p' })]), stored(storedItem('p', 'all_week')))).toEqual({
      ok: false,
      fields: { 'featured.0.id': 'not_weekly' },
    });
  });

  it('rejects the same item twice in one list', () => {
    expect(
      planWeek(
        draft({ 4: { mains: [main({ id: 'a' }), main({ id: 'a' })] } }),
        stored(storedItem('a', 'daily_main')),
      ),
    ).toEqual({ ok: false, fields: { 'days.4.mains.1.id': 'duplicate' } });
  });

  it('rejects the same featured item twice', () => {
    expect(
      planWeek(
        draft({}, [main({ id: 'f' }), main({ id: 'f' })]),
        stored(storedItem('f', 'featured')),
      ),
    ).toEqual({ ok: false, fields: { 'featured.1.id': 'duplicate' } });
  });

  it('rejects an item placed as a soup and as a main', () => {
    expect(
      planWeek(
        draft({ 1: { soups: [soup({ id: 'a' })] }, 2: { mains: [soup({ id: 'a' })] } }),
        stored(storedItem('a', 'daily_soup', goulash)),
      ),
    ).toEqual({ ok: false, fields: { 'days.2.mains.0.id': 'conflict' } });
  });

  it('rejects an item whose content differs between two places', () => {
    expect(
      planWeek(
        draft({
          1: { mains: [main({ id: 'a' })] },
          2: { mains: [main({ id: 'a', name: 'Marhapörkölt' })] },
        }),
        stored(storedItem('a', 'daily_main')),
      ),
    ).toEqual({ ok: false, fields: { 'days.2.mains.0.id': 'conflict' } });
  });
});

describe('planWeek — rule: every item passes validateMenuItem in its category', () => {
  it('reports each invalid field under its path and plans nothing', () => {
    expect(
      planWeek(
        draft(
          {
            2: {
              soups: [soup({ priceWeekday: 650 })],
              mains: [main(), main({ name: ' ', priceWeekday: -1 })],
            },
          },
          [main({ variations: ['kicsi', 'kicsi'] })],
        ),
        stored(),
      ),
    ).toEqual({
      ok: false,
      fields: {
        'days.2.soups.0.priceWeekday': 'must_be_zero',
        'days.2.mains.1.name': 'required',
        'days.2.mains.1.priceWeekday': 'negative',
        'featured.0.variations': 'duplicate',
      },
    });
  });

  it('does not let a soup require a side', () => {
    expect(planWeek(draft({ 1: { soups: [soup({ requiresSide: true })] } }), stored())).toEqual({
      ok: false,
      fields: { 'days.1.soups.0.requiresSide': 'not_allowed' },
    });
  });

  it('rejects unknown allergen codes', () => {
    expect(planWeek(draft({ 6: { mains: [main({ allergens: ['nope'] })] } }), stored())).toEqual({
      ok: false,
      fields: { 'days.6.mains.0.allergens': 'invalid' },
    });
  });
});

describe('weekDraftIds', () => {
  it('lists every referenced id once, skipping new items', () => {
    expect(
      weekDraftIds(
        draft(
          {
            1: { soups: [soup({ id: 's' }), soup()], mains: [main({ id: 'a' })] },
            6: { soups: [soup({ id: 's' })] },
          },
          [main({ id: 'f' })],
        ),
      ),
    ).toEqual(['s', 'a', 'f']);
  });
});

const side = (fields: Partial<PermanentItemDraft> = {}): PermanentItemDraft => ({
  ...content({ name: 'Hasábburgonya', priceWeekday: 600, priceWeekend: null, soupIncluded: false }),
  ...fields,
});
const fries = side();

const permanentDraft = (sections: Partial<PermanentItemsDraft> = {}): PermanentItemsDraft => ({
  allWeek: [],
  desserts: [],
  pickles: [],
  sides: [],
  sideExtras: [],
  ...sections,
});

describe('planPermanentItems — rule: the section fixes the category, the position the order', () => {
  it('plans nothing for an empty menu', () => {
    expect(planPermanentItems(permanentDraft(), stored())).toEqual({
      ok: true,
      plan: { items: [] },
    });
  });

  it('inserts new items with their section category, their position, and active by default', () => {
    const result = planPermanentItems(
      permanentDraft({
        allWeek: [side({ name: 'Rántott csirkemell', requiresSide: true })],
        sides: [side(), side({ name: 'Párolt rizs', active: false })],
        sideExtras: [side({ name: 'Steakburgonya' })],
        pickles: [side({ name: 'Csemege uborka' })],
        desserts: [side({ name: 'Palacsinta' })],
      }),
      stored(),
    );
    expect(result.ok && result.plan.items).toEqual([
      {
        id: null,
        category: 'all_week',
        content: { ...fries, name: 'Rántott csirkemell', requiresSide: true },
        active: true,
        sortOrder: 0,
        changed: true,
      },
      {
        id: null,
        category: 'dessert',
        content: { ...fries, name: 'Palacsinta' },
        active: true,
        sortOrder: 0,
        changed: true,
      },
      {
        id: null,
        category: 'pickle',
        content: { ...fries, name: 'Csemege uborka' },
        active: true,
        sortOrder: 0,
        changed: true,
      },
      { id: null, category: 'side', content: fries, active: true, sortOrder: 0, changed: true },
      {
        id: null,
        category: 'side',
        content: { ...fries, name: 'Párolt rizs' },
        active: false,
        sortOrder: 1,
        changed: true,
      },
      {
        id: null,
        category: 'side_extra',
        content: { ...fries, name: 'Steakburgonya' },
        active: true,
        sortOrder: 0,
        changed: true,
      },
    ]);
  });
});

describe('planPermanentItems — rule: stored items are updated, and only when something changed', () => {
  const current = storedItem('a', 'side', { ...fries, sortOrder: 1 });
  const other = storedItem('b', 'side', { ...fries, name: 'Párolt rizs', sortOrder: 0 });

  it('leaves an item that is unchanged in content, section, position and active unwritten', () => {
    const result = planPermanentItems(
      permanentDraft({ sides: [side({ id: 'b', name: 'Párolt rizs' }), side({ id: 'a' })] }),
      stored(current, other),
    );
    expect(result.ok && result.plan.items.map((item) => [item.id, item.changed])).toEqual([
      ['b', false],
      ['a', false],
    ]);
  });

  it.each<[string, PermanentItemsDraft]>([
    [
      'its content',
      permanentDraft({
        sides: [side({ id: 'b', name: 'Párolt rizs' }), side({ id: 'a', priceWeekday: 650 })],
      }),
    ],
    [
      'its position',
      permanentDraft({ sides: [side({ id: 'a' }), side({ id: 'b', name: 'Párolt rizs' })] }),
    ],
    [
      'its section',
      permanentDraft({
        sides: [side({ id: 'b', name: 'Párolt rizs' })],
        sideExtras: [side({ id: 'a' })],
      }),
    ],
    [
      'active',
      permanentDraft({
        sides: [side({ id: 'b', name: 'Párolt rizs' }), side({ id: 'a', active: false })],
      }),
    ],
  ])('writes an item when %s changed', (_change, draft) => {
    const result = planPermanentItems(draft, stored(current, other));
    expect(result.ok && result.plan.items.find((item) => item.id === 'a')?.changed).toBe(true);
  });

  it('moves an item to the category of its new section', () => {
    const result = planPermanentItems(
      permanentDraft({ sideExtras: [side({ id: 'a' })] }),
      stored(current),
    );
    expect(result.ok && result.plan.items[0]).toMatchObject({
      category: 'side_extra',
      sortOrder: 0,
    });
  });

  it('reactivates an inactive item listed without `active`', () => {
    const result = planPermanentItems(
      permanentDraft({ sides: [side({ id: 'a' })] }),
      stored({ ...current, sortOrder: 0, active: false }),
    );
    expect(result.ok && result.plan.items[0]).toMatchObject({ active: true, changed: true });
  });

  it('keeps an item listed with `active: false` inactive', () => {
    const result = planPermanentItems(
      permanentDraft({ sides: [side({ id: 'a', active: false })] }),
      stored({ ...current, sortOrder: 0, active: false }),
    );
    expect(result.ok && result.plan.items[0]).toMatchObject({ active: false, changed: false });
  });
});

describe('planPermanentItems — rule: ids are stored permanent items, listed once', () => {
  it('rejects an id that is not stored', () => {
    expect(planPermanentItems(permanentDraft({ pickles: [side({ id: 'x' })] }), stored())).toEqual({
      ok: false,
      fields: { 'pickles.0.id': 'unknown_item' },
    });
  });

  it('rejects a weekly item', () => {
    expect(
      planPermanentItems(
        permanentDraft({ allWeek: [side({ id: 'w' })] }),
        stored(storedItem('w', 'daily_main')),
      ),
    ).toEqual({ ok: false, fields: { 'allWeek.0.id': 'weekly_item' } });
  });

  it('rejects an item listed twice, also across sections', () => {
    expect(
      planPermanentItems(
        permanentDraft({ sides: [side({ id: 'a' })], sideExtras: [side({ id: 'a' })] }),
        stored(storedItem('a', 'side', fries)),
      ),
    ).toEqual({ ok: false, fields: { 'sideExtras.0.id': 'duplicate' } });
  });
});

describe('planPermanentItems — rule: every item passes validateMenuItem in its category', () => {
  it('reports each invalid field under its path and plans nothing', () => {
    expect(
      planPermanentItems(
        permanentDraft({
          allWeek: [side({ name: '' })],
          desserts: [side({ name: 'Palacsinta', requiresSide: true })],
          sides: [side(), side(), side({ priceWeekday: -1, allergens: ['nope'] })],
        }),
        stored(),
      ),
    ).toEqual({
      ok: false,
      fields: {
        'allWeek.0.name': 'required',
        'desserts.0.requiresSide': 'not_allowed',
        'sides.2.priceWeekday': 'negative',
        'sides.2.allergens': 'invalid',
      },
    });
  });
});

describe('permanentDraftIds', () => {
  it('lists every referenced id once, skipping new items', () => {
    expect(
      permanentDraftIds(
        permanentDraft({
          allWeek: [side({ id: 'a' })],
          sides: [side(), side({ id: 'b' })],
          sideExtras: [side({ id: 'a' })],
        }),
      ),
    ).toEqual(['a', 'b']);
  });
});

describe('groupPermanentItems', () => {
  it('groups items by section in sortOrder, keeping inactive items and leaving weekly ones out', () => {
    const rice = storedItem('rice', 'side', { sortOrder: 1, active: false });
    const chips = storedItem('chips', 'side', { sortOrder: 0 });
    const pancake = storedItem('pancake', 'dessert');
    const stewItem = storedItem('stew', 'daily_main');
    expect(groupPermanentItems([rice, stewItem, pancake, chips])).toEqual({
      allWeek: [],
      desserts: [pancake],
      pickles: [],
      sides: [chips, rice],
      sideExtras: [],
    });
  });
});
