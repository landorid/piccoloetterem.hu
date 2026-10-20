import type { ComposedMenuDraft, DayDraft, ExtraDraft, SubmissionDraft } from '@piccolo/core';
import { z } from 'zod';

/*
 * `POST /api/orders` on the wire: core's `SubmissionDraft` plus the `website` honeypot. These
 * schemas check shape and types, and cap sizes so a request cannot make the server do unbounded
 * work. The rules (required fields, phone and e-mail format, lengths, quantities, what can be
 * ordered when) are `packages/core`'s `validateSubmission`, so its codes are the ones the client
 * also sees when it validates locally. The caps are above core's limits wherever core has one,
 * except the 7 days, where both agree and the cap answers first (`too_big`).
 */

/** Size caps (#31, Scope 6). The body itself is capped at `maxBodyBytes` before it is parsed. */
export const submissionCaps = {
  maxBodyBytes: 64 * 1024,
  days: 7,
  menusPerDay: 30,
  extrasPerDay: 20,
} as const;

/** An item id, or `''` / absent for an empty slot (core treats both as not chosen). */
const itemId = z.union([z.uuid(), z.literal('')]).optional();

const menu = z.object({
  soupId: itemId,
  mainId: itemId,
  variation: z.string().max(200).optional(),
  sideId: itemId,
  pickleId: itemId,
  dessertId: itemId,
}) satisfies z.ZodType<ComposedMenuDraft>;

/** `quantity` is checked by core (1–20, `invalid_quantity`). */
const extra = z.object({
  key: z.string().max(100),
  quantity: z.number(),
}) satisfies z.ZodType<ExtraDraft>;

const day = z.object({
  deliveryDate: z.iso.date(),
  fulfilment: z.enum(['delivery', 'pickup']),
  menus: z.array(menu).max(submissionCaps.menusPerDay),
  extras: z.array(extra).max(submissionCaps.extrasPerDay).default([]),
}) satisfies z.ZodType<DayDraft>;

export const submissionBody = z.object({
  name: z.string().max(500),
  phone: z.string().max(100),
  email: z.string().max(500),
  address: z.string().max(1000).optional(),
  note: z.string().max(2000).optional(),
  days: z.array(day).max(submissionCaps.days),
  /** The honeypot: a field people never see. Anything in it marks a bot (`honeypot` in the routes). */
  website: z.string().optional(),
}) satisfies z.ZodType<SubmissionDraft & { website?: string }>;
