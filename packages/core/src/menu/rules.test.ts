import { describe, expect, it } from 'vitest';
import { allergenCodes, permanentCategories, weeklyCategories } from '../config/types';
import {
  categoriesForSlot,
  isAllergenCode,
  isCategory,
  isWeeklyCategory,
  slotsForCategory,
  validateMenuItem,
} from './rules';
import { type MenuItemInput, slots } from './types';

describe('slotsForCategory — rule: slot ← category mapping', () => {
  it.each([
    ['daily_soup', 'soup'],
    ['daily_main', 'main'],
    ['featured', 'main'],
    ['all_week', 'main'],
    ['side', 'side'],
    ['side_extra', 'side'],
    ['pickle', 'pickle'],
    ['dessert', 'dessert'],
  ] as const)('%s fills the %s slot', (category, slot) => {
    expect(slotsForCategory(category)).toEqual([slot]);
  });
});

describe('categoriesForSlot', () => {
  it.each([
    ['soup', ['daily_soup']],
    ['main', ['daily_main', 'featured', 'all_week']],
    ['side', ['side', 'side_extra']],
    ['pickle', ['pickle']],
    ['dessert', ['dessert']],
  ] as const)('%s ← %j', (slot, categories) => {
    expect(categoriesForSlot(slot)).toEqual(categories);
  });

  it('is the inverse of slotsForCategory for every category', () => {
    for (const slot of slots) {
      for (const category of categoriesForSlot(slot)) {
        expect(slotsForCategory(category)).toContain(slot);
      }
    }
    const covered = slots.flatMap((slot) => categoriesForSlot(slot));
    expect(covered.toSorted()).toEqual([...weeklyCategories, ...permanentCategories].toSorted());
  });
});

describe('isWeeklyCategory — rule: weekly vs permanent categories', () => {
  it.each(weeklyCategories)('%s is weekly', (category) => {
    expect(isWeeklyCategory(category)).toBe(true);
  });

  it.each(permanentCategories)('%s is permanent', (category) => {
    expect(isWeeklyCategory(category)).toBe(false);
  });
});

describe('isCategory / isAllergenCode', () => {
  it('accepts known values and rejects anything else', () => {
    expect(isCategory('daily_main')).toBe(true);
    expect(isCategory('main')).toBe(false);
    expect(allergenCodes.every(isAllergenCode)).toBe(true);
    expect(isAllergenCode('lactose')).toBe(false);
  });
});

describe('validateMenuItem', () => {
  const main: MenuItemInput = {
    category: 'daily_main',
    name: 'Rántott csirkemell',
    description: null,
    priceWeekday: 1890,
    priceWeekend: 2190,
    variations: ['sima', 'sajtos'],
    allergens: ['gluten', 'eggs'],
    soupIncluded: true,
    requiresSide: true,
    soldOut: false,
    active: true,
    sortOrder: 0,
  };
  const soup: MenuItemInput = {
    ...main,
    category: 'daily_soup',
    name: 'Húsleves',
    priceWeekday: 0,
    priceWeekend: null,
    variations: [],
    soupIncluded: false,
    requiresSide: false,
  };

  it('accepts a valid main', () => {
    expect(validateMenuItem(main)).toBeNull();
  });

  it('accepts a daily soup priced 0 (rule: daily soups have price 0)', () => {
    expect(validateMenuItem(soup)).toBeNull();
    expect(validateMenuItem({ ...soup, priceWeekend: 0 })).toBeNull();
  });

  it.each<[string, Partial<MenuItemInput>, ReturnType<typeof validateMenuItem>]>([
    ['an unknown category', { category: 'drink' }, { category: 'invalid' }],
    ['an empty name', { name: '' }, { name: 'required' }],
    ['a blank name', { name: '  ' }, { name: 'required' }],
    ['a fractional weekday price', { priceWeekday: 1890.5 }, { priceWeekday: 'not_integer' }],
    ['a negative weekday price', { priceWeekday: -1 }, { priceWeekday: 'negative' }],
    ['a NaN weekend price', { priceWeekend: Number.NaN }, { priceWeekend: 'not_integer' }],
    ['a negative weekend price', { priceWeekend: -100 }, { priceWeekend: 'negative' }],
    ['an empty variation', { variations: ['sima', ''] }, { variations: 'empty' }],
    ['a blank variation', { variations: [' '] }, { variations: 'empty' }],
    ['an untrimmed variation', { variations: ['sima '] }, { variations: 'untrimmed' }],
    ['a duplicate variation', { variations: ['sima', 'sima'] }, { variations: 'duplicate' }],
    ['an unknown allergen code', { allergens: ['gluten', 'lactose'] }, { allergens: 'invalid' }],
  ])('rejects %s', (_name, patch, expected) => {
    expect(validateMenuItem({ ...main, ...patch })).toEqual(expected);
  });

  it.each(['featured', 'all_week'])('allows requiresSide on the main-capable %s', (category) => {
    expect(validateMenuItem({ ...main, category })).toBeNull();
  });

  it.each(['daily_soup', 'dessert', 'pickle', 'side', 'side_extra'])(
    'rejects requiresSide on %s, which cannot be a main',
    (category) => {
      const item = { ...main, category, priceWeekday: 0, priceWeekend: null };
      expect(validateMenuItem(item)).toEqual({ requiresSide: 'not_allowed' });
    },
  );

  it('does not judge requiresSide when the category itself is invalid', () => {
    expect(validateMenuItem({ ...main, category: '' })).toEqual({ category: 'invalid' });
  });

  it.each<[string, Partial<MenuItemInput>, ReturnType<typeof validateMenuItem>]>([
    ['a weekday price', { priceWeekday: 650 }, { priceWeekday: 'must_be_zero' }],
    ['a weekend price', { priceWeekend: 650 }, { priceWeekend: 'must_be_zero' }],
    ['a negative price', { priceWeekday: -5 }, { priceWeekday: 'negative' }],
  ])('rejects a daily soup with %s', (_name, patch, expected) => {
    expect(validateMenuItem({ ...soup, ...patch })).toEqual(expected);
  });

  it('reports every invalid field at once', () => {
    expect(
      validateMenuItem({
        ...main,
        category: 'dessert',
        name: '',
        priceWeekday: -1,
        priceWeekend: 1.5,
        variations: ['a', 'a'],
        allergens: ['x'],
      }),
    ).toEqual({
      name: 'required',
      priceWeekday: 'negative',
      priceWeekend: 'not_integer',
      variations: 'duplicate',
      requiresSide: 'not_allowed',
      allergens: 'invalid',
    });
  });
});
