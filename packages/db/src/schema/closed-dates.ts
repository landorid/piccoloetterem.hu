import { date, pgTable, timestamp } from 'drizzle-orm/pg-core';

/** Days staff marked as not orderable (#60). One row per closed day; domain data, not settings. */
export const closedDates = pgTable('closed_dates', {
  /** `YYYY-MM-DD` in the restaurant's timezone, as `isClosedDate` in `packages/core` expects. */
  date: date('date', { mode: 'string' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
