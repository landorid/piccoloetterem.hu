import { integer, pgTable, primaryKey, smallint, timestamp } from 'drizzle-orm/pg-core';

/** An ISO week of the menu. A draft until `published_at` is set. */
export const menuWeeks = pgTable(
  'menu_weeks',
  {
    isoYear: integer('iso_year').notNull(),
    isoWeek: smallint('iso_week').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.isoYear, t.isoWeek] })],
);
