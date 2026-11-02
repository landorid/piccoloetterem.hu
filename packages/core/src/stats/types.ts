import type { Slot } from '../menu/types';

/*
 * The aggregate shapes the statistics read, produced by Postgres for new orders and by
 * `scripts/legacy-stats/` for the old system. Dates are `YYYY-MM-DD` and months `YYYY-MM`, both in
 * the restaurant's timezone; money is whole forints, the food subtotal without delivery fee and
 * without cancelled orders.
 */

/** Totals of one delivery date. */
export interface DailyTotals {
  date: string;
  /** One customer's order for this date counts once. */
  orderDays: number;
  revenue: number;
  menus: number;
  /** Order days with two or more menus. */
  groupOrderDays: number;
  mains: number;
  mainsWithSoup: number;
  mainsWithSide: number;
  mainsWithDessert: number;
}

/** Portions of one dish on one delivery date. */
export interface DishDay {
  /** `dishKey(name)`. */
  dishKey: string;
  /** The most frequent spelling for the key. */
  name: string;
  slot: Slot;
  date: string;
  portions: number;
  /** Portions per chosen variation; empty when the dish has none. */
  variations: Record<string, number>;
}

/** A dish among a customer's favourites. */
export interface CustomerDish {
  dishKey: string;
  name: string;
  count: number;
}

/** One of a customer's recent order days. */
export interface CustomerOrder {
  date: string;
  /** The dishes of the day, as one display line. */
  items: string;
  menus: number;
  total: number;
}

/** Everything the customer views show about one orderer. */
export interface CustomerHistory {
  /** `customerRef(emailKey)`. */
  ref: string;
  /** `normaliseEmailKey(email)`. */
  emailKey: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  /** Every order day, ascending. */
  orderDates: string[];
  /** Spend per `YYYY-MM` month. */
  monthlySpend: Record<string, number>;
  /** Order days per weekday, Monday … Saturday. */
  weekdayCounts: [number, number, number, number, number, number];
  menus: number;
  groupOrderDays: number;
  /** At most 10, most ordered first. */
  topDishes: CustomerDish[];
  /** At most 10, newest first. */
  lastOrders: CustomerOrder[];
}

/** Customers with at least one order day in a month. */
export interface MonthlyActive {
  /** `YYYY-MM`. */
  month: string;
  customers: number;
}

/** The old system's history, pre-aggregated into the shapes above. */
export interface LegacyStatsFile {
  /** Bumped whenever a shape or `dishKey` changes. */
  formatVersion: 1;
  /** ISO 8601 timestamp of the script run. */
  generatedAt: string;
  /** The first and last delivery date in the old data. */
  span: { from: string; to: string };
  /** Operating days in the span on which nobody ordered. */
  closedDays: string[];
  daily: DailyTotals[];
  dishes: DishDay[];
  monthlyActive: MonthlyActive[];
  customers: CustomerHistory[];
}
