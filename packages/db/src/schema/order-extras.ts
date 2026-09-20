import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { orders } from './orders';

/** Extras (box, bread, sauces) ordered for a day. `extra_key` is `ExtraDef.key` from the config. */
export const orderExtras = pgTable(
  'order_extras',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    extraKey: text('extra_key').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
  },
  (t) => [index('order_extras_order_id_idx').on(t.orderId)],
);
