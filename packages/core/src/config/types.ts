/** The EU-14 allergens (Regulation 1169/2011, Annex II), in the regulation's order. */
export const allergenCodes = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

export type AllergenCode = (typeof allergenCodes)[number];

/** Categories scheduled to an ISO week (and, except `featured`, to a day). */
export const weeklyCategories = ['daily_soup', 'daily_main', 'featured'] as const;

/** Categories offered every week without scheduling. */
export const permanentCategories = ['all_week', 'dessert', 'pickle', 'side', 'side_extra'] as const;

export type WeeklyCategory = (typeof weeklyCategories)[number];
export type PermanentCategory = (typeof permanentCategories)[number];
export type Category = WeeklyCategory | PermanentCategory;

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ExtraDef {
  /** Stable identifier, snapshotted on orders as `extra_key`. */
  key: string;
  name: string;
  /** Unit price in forints. */
  price: number;
}

/**
 * Everything restaurant-specific. One instance per deployment, selected by the `RESTAURANT` env
 * var through `loadConfig`. Money is in whole forints; times of day are `HH:mm` in `timezone`.
 */
export interface RestaurantConfig {
  name: string;
  /** IANA timezone every date and cutoff is computed in. */
  timezone: string;
  /** Daily order cutoff, `HH:mm`. */
  cutoff: string;
  operatingDays: readonly Weekday[];
  /** Last weekday whose cutoff still accepts orders for the rest of the same week. */
  lastSameWeekOrderDay: Weekday;
  allergenNotice: string;
  pricing: {
    noSoupDiscount: number;
    soupPrice: number;
    deliveryFee: number;
    minimumOrder: number;
  };
  extras: readonly ExtraDef[];
  pickupEnabled: boolean;
  messages: {
    /** Shown when the roll-over reaches a next week that is not published yet. */
    nextWeekNotPublished: string;
    /** Shown when the current week is published but has nothing orderable. */
    emptyWeek: string;
  };
  email: { from: string; replyTo: string };
  contact: {
    address: string;
    phone: string;
    openingHours: string;
    /** When orders are taken, `HH:mm`. `until` must equal `cutoff`; `loadConfig` enforces it. */
    intakeWindow: { from: string; until: string };
  };
  /** ISO dates (`YYYY-MM-DD`) the restaurant is closed. */
  holidays: readonly string[];
}
