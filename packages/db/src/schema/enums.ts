import { permanentCategories, slots, weeklyCategories } from '@piccolo/core';
import { pgEnum } from 'drizzle-orm/pg-core';

/** The category values come from `packages/core`, so the database and the domain cannot drift. */
export const categoryEnum = pgEnum('category', [...weeklyCategories, ...permanentCategories]);

export const fulfilmentEnum = pgEnum('fulfilment', ['delivery', 'pickup']);

export const orderStatusEnum = pgEnum('order_status', ['received', 'processed', 'cancelled']);

export const slotEnum = pgEnum('slot', slots);
