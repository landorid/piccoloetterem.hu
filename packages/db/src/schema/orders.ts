import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { fulfilmentEnum, orderStatusEnum } from './enums';

/**
 * One order per delivery day. A submission covering several days creates several orders that
 * share a `submission_id`. Name, phone, email and address are snapshots of what was submitted.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    /** `YYYY-MM-DD` in the restaurant's timezone. */
    deliveryDate: date('delivery_date', { mode: 'string' }).notNull(),
    fulfilment: fulfilmentEnum('fulfilment').notNull(),
    status: orderStatusEnum('status').notNull(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    address: text('address').notNull(),
    note: text('note'),
    foodSubtotal: integer('food_subtotal').notNull(),
    deliveryFee: integer('delivery_fee').notNull(),
    total: integer('total').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('orders_delivery_date_idx').on(t.deliveryDate),
    index('orders_status_delivery_date_idx').on(t.status, t.deliveryDate),
    index('orders_submission_id_idx').on(t.submissionId),
    index('orders_customer_id_idx').on(t.customerId),
  ],
);
