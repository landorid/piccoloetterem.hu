import type { AllergenCode, Category } from '../config/types';

/** The five slots of a composed menu, in serving order. */
export const slots = ['soup', 'main', 'side', 'pickle', 'dessert'] as const;

export type Slot = (typeof slots)[number];

/** A day a weekly item can be scheduled to: 1 = Monday … 6 = Saturday. */
export type MenuDay = 1 | 2 | 3 | 4 | 5 | 6;

/** One dish. Money is in whole forints. */
export interface MenuItem {
  /** UUID. */
  id: string;
  category: Category;
  name: string;
  description: string | null;
  priceWeekday: number;
  /** `null` means the weekday price also applies on the weekend. */
  priceWeekend: number | null;
  /** Choices the guest must pick one of when ordering this dish; empty when there are none. */
  variations: readonly string[];
  allergens: readonly AllergenCode[];
  /** A main whose price includes one daily soup. */
  soupIncluded: boolean;
  /** A main that must be ordered with exactly one side. */
  requiresSide: boolean;
  soldOut: boolean;
  active: boolean;
  sortOrder: number;
}

/**
 * A menu item as submitted by staff, before validation. `category` and `allergens` are plain
 * strings because `validateMenuItem` is what checks them.
 */
export type MenuItemInput = Omit<MenuItem, 'id' | 'category' | 'allergens'> & {
  category: string;
  allergens: readonly string[];
};

/** An ISO week of the menu. A draft until `publishedAt` is set. */
export interface MenuWeek {
  isoYear: number;
  isoWeek: number;
  publishedAt: Date | null;
}

/** A weekly item placed on a week. `day` is `null` for featured items, which run all week. */
export interface ScheduleEntry {
  isoYear: number;
  isoWeek: number;
  day: MenuDay | null;
  menuItemId: string;
  sortOrder: number;
}

export interface PublicMenuDay {
  /** `YYYY-MM-DD` in the restaurant's timezone. */
  date: string;
  soups: MenuItem[];
  mains: MenuItem[];
}

/** One week of the menu as guests see it. Inactive items are left out; sold-out ones stay, flagged. */
export interface PublicMenu {
  isoYear: number;
  isoWeek: number;
  /** e.g. `2026/37. hét (09.07 – 09.12)` */
  weekLabel: string;
  days: Record<MenuDay, PublicMenuDay>;
  featured: MenuItem[];
  permanent: {
    allWeek: MenuItem[];
    desserts: MenuItem[];
    pickles: MenuItem[];
    sides: MenuItem[];
    sideExtras: MenuItem[];
  };
}
