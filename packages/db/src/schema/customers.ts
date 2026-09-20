import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Whoever places orders, keyed by normalised email. Upserted on every order; never in Clerk. */
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailKey: text('email_key').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  lastOrderAt: timestamp('last_order_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
