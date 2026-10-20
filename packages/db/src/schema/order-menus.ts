import { index, integer, pgTable, uuid } from 'drizzle-orm/pg-core';
import { orders } from './orders';

/** One composed menu within an order; group orders have several. */
export const orderMenus = pgTable(
  'order_menus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    price: integer('price').notNull(),
  },
  (t) => [index('order_menus_order_id_idx').on(t.orderId)],
);
