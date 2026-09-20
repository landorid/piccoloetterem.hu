import { foreignKey, index, integer, pgTable, smallint, unique, uuid } from 'drizzle-orm/pg-core';
import { menuItems } from './menu-items';
import { menuWeeks } from './menu-weeks';

/** A weekly item placed on a week. `day` is 1 = Monday … 6 = Saturday, `null` for featured items. */
export const menuSchedule = pgTable(
  'menu_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    isoYear: integer('iso_year').notNull(),
    isoWeek: smallint('iso_week').notNull(),
    day: smallint('day'),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'menu_schedule_week_fk',
      columns: [t.isoYear, t.isoWeek],
      foreignColumns: [menuWeeks.isoYear, menuWeeks.isoWeek],
    }),
    // NULLS NOT DISTINCT: without it a featured item (day NULL) could be scheduled twice in a week.
    unique('menu_schedule_week_day_item_unique')
      .on(t.isoYear, t.isoWeek, t.day, t.menuItemId)
      .nullsNotDistinct(),
    index('menu_schedule_menu_item_id_idx').on(t.menuItemId),
  ],
);
