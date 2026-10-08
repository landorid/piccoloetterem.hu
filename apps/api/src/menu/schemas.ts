import {
  isIsoWeek,
  type MenuItemContent,
  type PermanentItemsDraft,
  type WeekDraft,
} from '@piccolo/core';
import { z } from 'zod';

/*
 * The admin menu API on the wire. These schemas check shape and types only; the domain rules
 * (prices, allergens, categories, consistent ids) are `packages/core`'s, so their codes are
 * the same wherever an item is validated. The `satisfies` clauses keep each schema in step with
 * the core type it mirrors.
 *
 * Arrays are `readonly`, like the `MenuItem` the `GET` routes return, so a typed client can send
 * back what it read without a cast.
 */

/** `MenuItemContent`: what staff edit on any item. */
const itemContent = z.object({
  name: z.string(),
  description: z.string().nullable(),
  priceWeekday: z.number(),
  priceWeekend: z.number().nullable(),
  variations: z.array(z.string()).readonly(),
  allergens: z.array(z.string()).readonly(),
  soupIncluded: z.boolean(),
  requiresSide: z.boolean(),
}) satisfies z.ZodType<MenuItemContent>;

export const itemParams = z.object({ id: z.uuid() });

const permanentItem = itemContent.extend({
  id: z.uuid().optional(),
  active: z.boolean().optional(),
});
const permanentSection = z.array(permanentItem).readonly();

/**
 * `PUT /items`: the whole permanent menu, the shape `GET /items` returns. Fields the server owns
 * (`category`, `soldOut`, `sortOrder`) are accepted and ignored, so a client can send back what it
 * read.
 */
export const permanentItemsBody = z.object({
  allWeek: permanentSection,
  desserts: permanentSection,
  pickles: permanentSection,
  sides: permanentSection,
  sideExtras: permanentSection,
}) satisfies z.ZodType<PermanentItemsDraft>;

export const soldOutBody = z.object({ soldOut: z.boolean() });

export const weekParams = z
  .object({
    year: z.coerce.number().int().min(2000).max(9999),
    week: z.coerce.number().int().min(1).max(53),
  })
  // Week 53 exists only in some years.
  .refine(({ year, week }) => isIsoWeek(year, week), { path: ['week'] });

const weekItem = itemContent.extend({ id: z.uuid().optional() });
const weekList = z.array(weekItem).readonly();
const weekDay = z.object({ soups: weekList, mains: weekList });

/**
 * `PUT /weeks/:year/:week`: the shape `GET` returns. Fields the server owns (`category`,
 * `soldOut`, `active`, `sortOrder`, and `week`) are accepted and ignored, so a client can send
 * back what it read.
 */
export const weekBody = z.object({
  days: z.object({ 1: weekDay, 2: weekDay, 3: weekDay, 4: weekDay, 5: weekDay, 6: weekDay }),
  featured: weekList,
}) satisfies z.ZodType<WeekDraft>;

const isoDate = z.iso.date();

export const closedDateRangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => from <= to, { path: ['to'] });

export const closedDateBody = z.object({ date: isoDate });

export const closedDateParams = z.object({ date: isoDate });
