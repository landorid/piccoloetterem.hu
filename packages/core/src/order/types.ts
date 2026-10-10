import type { Slot } from '../menu/types';

/** Stable machine codes. Apps render `orderMessagesHu`; core never returns Hungarian text. */
export const orderErrorCodes = [
  'required',
  'too_short',
  'too_long',
  'invalid',
  'invalid_phone',
  'invalid_email',
  'sold_out',
  'inactive',
  'unknown_item',
  'variation_required',
  'invalid_variation',
  'side_required',
  'not_allowed',
  'cutoff_passed',
  'pickup_disabled',
  'unknown_extra',
  'invalid_quantity',
  'duplicate',
  'too_many',
] as const;

export type OrderErrorCode = (typeof orderErrorCodes)[number];

/** Dotted paths (`days.0.menus.1.variation`) to one error code. Empty object means valid. */
export type FieldErrors = Record<string, OrderErrorCode>;

export const fulfilments = ['delivery', 'pickup'] as const;

export type Fulfilment = (typeof fulfilments)[number];

/**
 * One composed menu. Slots are all optional except a variation when the main has variations and a
 * side when the main requires one; at least one slot must be filled. Menus are numbered by their
 * position in the day (`1. menü`) and carry no recipient name.
 */
export interface ComposedMenuDraft {
  soupId?: string;
  mainId?: string;
  variation?: string;
  sideId?: string;
  pickleId?: string;
  dessertId?: string;
}

/** The most of one extra a delivery day can carry. */
export const maxExtraQuantity = 20;

export interface ExtraDraft {
  key: string;
  quantity: number;
}

export interface DayDraft {
  /** `YYYY-MM-DD` in the restaurant's timezone. */
  deliveryDate: string;
  fulfilment: Fulfilment;
  menus: ComposedMenuDraft[];
  extras: ExtraDraft[];
}

export interface SubmissionDraft {
  name: string;
  phone: string;
  email: string;
  address?: string;
  note?: string;
  days: DayDraft[];
}

export interface PricedMenuItem {
  slot: Slot;
  itemId: string;
  name: string;
  variation?: string;
  /** Whole forints. Daily soups are 0; soup pricing is an adjustment. */
  unitPrice: number;
}

export interface PriceAdjustment {
  code: 'no_soup_discount' | 'soup_charge';
  /** Whole forints. `no_soup_discount` is negative; `soup_charge` is positive. */
  amount: number;
}

export interface PricedMenu {
  items: PricedMenuItem[];
  adjustments: PriceAdjustment[];
  price: number;
}

export interface PricedExtra {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PricedDay {
  menus: PricedMenu[];
  extras: PricedExtra[];
  foodSubtotal: number;
  deliveryFee: number;
  total: number;
  /** `max(0, minimumOrder - foodSubtotal)` for delivery, otherwise 0. Not a priced line. */
  missingToMinimum: number;
}

export interface PricedSubmission {
  days: PricedDay[];
  foodSubtotal: number;
  deliveryFee: number;
  total: number;
}
