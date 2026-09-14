import type { AllergenCode } from '@piccolo/core';
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { categoryEnum } from './enums';

/** One dish, weekly or permanent. Nullability matches `MenuItem` in `packages/core`. */
export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: categoryEnum('category').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  priceWeekday: integer('price_weekday').notNull(),
  /** `null` means the weekday price also applies on the weekend. */
  priceWeekend: integer('price_weekend'),
  variations: text('variations').array().notNull(),
  allergens: text('allergens').array().$type<AllergenCode[]>().notNull(),
  soupIncluded: boolean('soup_included').notNull(),
  requiresSide: boolean('requires_side').notNull(),
  soldOut: boolean('sold_out').notNull(),
  active: boolean('active').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
