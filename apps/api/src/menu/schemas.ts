import {
  isIsoWeek,
  type MenuItemContent,
  permanentCategories,
  type WeekDraft,
} from '@piccolo/core';
import { z } from 'zod';

/*
 * The admin menu API on the wire. These schemas check shape and types only; the domain rules
 * (prices, allergens, categories, a week's consistency) are `packages/core`'s, so their codes are
 * the same wherever an item is validated. The `satisfies` clauses keep each schema in step with
 * the core type it mirrors.
 */

/** `MenuItemContent`: what staff edit on any item. */
const itemContent = z.object({
  name: z.string(),
  description: z.string().nullable(),
  priceWeekday: z.number(),
  priceWeekend: z.number().nullable(),
  variations: z.array(z.string()),
  allergens: z.array(z.string()),
  soupIncluded: z.boolean(),
  requiresSide: z.boolean(),
}) satisfies z.ZodType<MenuItemContent>;

const permanentCategory = z.enum(permanentCategories);

export const itemParams = z.object({ id: z.uuid() });

export const itemsQuery = z.object({ category: permanentCategory.optional() });

/** `POST /items`: a new permanent item. It starts active, not sold out, last in its category. */
export const newItemBody = itemContent.extend({ category: permanentCategory });

/** `PATCH /items/:id`: any subset of the fields; `active: true` brings back a deactivated item. */
export const itemPatchBody = newItemBody.extend({ active: z.boolean() }).partial();

/** `POST /items/reorder`: every item of one permanent category, in the new order. */
export const reorderBody = z.object({ ids: z.array(z.uuid()) });

export const soldOutBody = z.object({ soldOut: z.boolean() });

export const weekParams = z
  .object({
    year: z.coerce.number().int().min(2000).max(9999),
    week: z.coerce.number().int().min(1).max(53),
  })
  // Week 53 exists only in some years.
  .refine(({ year, week }) => isIsoWeek(year, week), { path: ['week'] });

const weekItem = itemContent.extend({ id: z.uuid().optional() });
const weekDay = z.object({ soups: z.array(weekItem), mains: z.array(weekItem) });

/**
 * `PUT /weeks/:year/:week`: the shape `GET` returns. Fields the server owns (`category`,
 * `soldOut`, `active`, `sortOrder`, and `week`) are accepted and ignored, so a client can send
 * back what it read.
 */
export const weekBody = z.object({
  days: z.object({ 1: weekDay, 2: weekDay, 3: weekDay, 4: weekDay, 5: weekDay, 6: weekDay }),
  featured: z.array(weekItem),
}) satisfies z.ZodType<WeekDraft>;

const isoDate = z.iso.date();

export const closedDateRangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => from <= to, { path: ['to'] });

export const closedDateBody = z.object({ date: isoDate });

export const closedDateParams = z.object({ date: isoDate });
