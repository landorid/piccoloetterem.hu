import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { slotEnum } from './enums';
import { menuItems } from './menu-items';
import { orderMenus } from './order-menus';

/**
 * One slot of a composed menu. `name`, `variation` and `unit_price` are snapshots taken at
 * submission: display them as stored and never re-join `menu_items`. `menu_item_id` is kept only
 * as a reference and becomes `null` when the item is deleted.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderMenuId: uuid('order_menu_id')
      .notNull()
      .references(() => orderMenus.id, { onDelete: 'cascade' }),
    slot: slotEnum('slot').notNull(),
    menuItemId: uuid('menu_item_id').references(() => menuItems.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    /** `null` when the dish has no variations. */
    variation: text('variation'),
    unitPrice: integer('unit_price').notNull(),
  },
  (t) => [
    index('order_items_order_menu_id_idx').on(t.orderMenuId),
    index('order_items_menu_item_id_idx').on(t.menuItemId),
  ],
);
