import { type AllergenCode, permanentCategories } from '@piccolo/core';
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { categoryEnum } from './enums';

/** One dish, weekly or permanent. Nullability matches `MenuItem` in `packages/core`. */
export const menuItems = pgTable(
  'menu_items',
  {
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
    /**
     * The version part of the item's image keys in R2 (`<id>/<version>/<rendition>`), a UUID minted
     * when the upload finished; NULL: no image. Flipped only after every rendition is stored, so an
     * item never points at a half-stored image. Written by the image routes only.
     */
    imageVersion: text('image_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Built from `permanentCategories`, so a new permanent category changes this SQL and
    // `db:generate` notices.
    check(
      'menu_items_image_permanent_only',
      sql`${table.imageVersion} is null or ${table.category} in (${sql.raw(
        permanentCategories.map((category) => `'${category}'`).join(', '),
      )})`,
    ),
    check(
      'menu_items_image_version_uuid',
      sql`${table.imageVersion} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
    ),
  ],
);
