import {
  type AllergenCode,
  allergenCodes,
  type Category,
  permanentCategories,
  type WeeklyCategory,
  weeklyCategories,
} from '../config/types';
import type { MenuItemInput, Slot } from './types';

const categories: readonly Category[] = [...weeklyCategories, ...permanentCategories];

const slotByCategory: Readonly<Record<Category, Slot>> = {
  daily_soup: 'soup',
  daily_main: 'main',
  featured: 'main',
  all_week: 'main',
  dessert: 'dessert',
  pickle: 'pickle',
  side: 'side',
  side_extra: 'side',
};

export function isCategory(value: string): value is Category {
  return (categories as readonly string[]).includes(value);
}

export function isAllergenCode(value: string): value is AllergenCode {
  return (allergenCodes as readonly string[]).includes(value);
}

/** Whether items of this category are scheduled to a week rather than offered permanently. */
export function isWeeklyCategory(category: Category): category is WeeklyCategory {
  return (weeklyCategories as readonly Category[]).includes(category);
}

/** The slots an item of this category can fill in a composed menu. */
export function slotsForCategory(category: Category): readonly Slot[] {
  return [slotByCategory[category]];
}

/** The categories whose items can fill this slot, weekly categories first. */
export function categoriesForSlot(slot: Slot): readonly Category[] {
  return categories.filter((category) => slotByCategory[category] === slot);
}

/**
 * Machine-readable reasons a field is invalid. The apps translate them; core carries no
 * user-facing text.
 */
export type MenuItemErrorCode =
  | 'invalid'
  | 'required'
  | 'not_integer'
  | 'negative'
  | 'must_be_zero'
  | 'empty'
  | 'untrimmed'
  | 'duplicate'
  | 'not_allowed';

/** One error per invalid field, the first rule it breaks. */
export type FieldErrors = Partial<Record<keyof MenuItemInput, MenuItemErrorCode>>;

/** Checks a menu item before it is saved. Returns `null` when it is valid. */
export function validateMenuItem(item: MenuItemInput): FieldErrors | null {
  const errors: FieldErrors = {};
  const category = isCategory(item.category) ? item.category : null;

  if (!category) {
    errors.category = 'invalid';
  }
  if (item.name.trim() === '') {
    errors.name = 'required';
  }

  const weekdayError = priceError(item.priceWeekday, category);
  if (weekdayError) {
    errors.priceWeekday = weekdayError;
  }
  const weekendError = item.priceWeekend === null ? null : priceError(item.priceWeekend, category);
  if (weekendError) {
    errors.priceWeekend = weekendError;
  }

  const variationsError = variationError(item.variations);
  if (variationsError) {
    errors.variations = variationsError;
  }

  if (item.requiresSide && category && !categoriesForSlot('main').includes(category)) {
    errors.requiresSide = 'not_allowed';
  }
  if (!item.allergens.every(isAllergenCode)) {
    errors.allergens = 'invalid';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Prices are whole, non-negative forints; a daily soup is always free (its price is set per menu). */
function priceError(price: number, category: Category | null): MenuItemErrorCode | null {
  if (!Number.isInteger(price)) {
    return 'not_integer';
  }
  if (price < 0) {
    return 'negative';
  }
  if (category === 'daily_soup' && price !== 0) {
    return 'must_be_zero';
  }
  return null;
}

function variationError(variations: readonly string[]): MenuItemErrorCode | null {
  if (variations.some((variation) => variation.trim() === '')) {
    return 'empty';
  }
  if (variations.some((variation) => variation !== variation.trim())) {
    return 'untrimmed';
  }
  if (new Set(variations).size !== variations.length) {
    return 'duplicate';
  }
  return null;
}
