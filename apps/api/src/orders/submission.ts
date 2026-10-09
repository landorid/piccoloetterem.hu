import {
  type FieldErrors,
  isClosedDate,
  isoWeekOf,
  normaliseEmailKey,
  normalisePhone,
  type OrderErrorCode,
  type PricedSubmission,
  parseIsoDate,
  type SubmissionDraft,
} from '@piccolo/core';
import type { SubmissionRows } from './repo';

/*
 * The submission's steps that need neither HTTP nor a database: which week it is for, how core's
 * verdict maps to a response, and the rows that snapshot it. The rules themselves are core's.
 */

export type SubmissionWeek =
  | { ok: true; isoYear: number; isoWeek: number }
  | { ok: false; fields: Record<string, string> };

/**
 * The one ISO week every delivery date belongs to: the week whose menu is read. A date that is
 * not a calendar date is `invalid` (core's code); a date in another week than the first day's is
 * `other_week`. No days is `required` on `days`, as core reports it.
 */
export function submissionWeek(
  draft: Pick<SubmissionDraft, 'days'>,
  timezone: string,
): SubmissionWeek {
  if (draft.days.length === 0) {
    return { ok: false, fields: { days: 'required' } };
  }
  const fields: Record<string, string> = {};
  const weeks = draft.days.map((day, index) => {
    try {
      return isoWeekOf(parseIsoDate(day.deliveryDate, timezone));
    } catch {
      fields[`days.${index}.deliveryDate`] = 'invalid';
      return null;
    }
  });
  const [first] = weeks;
  if (!first) {
    return { ok: false, fields };
  }
  for (const [index, week] of weeks.entries()) {
    if (week && (week.isoYear !== first.isoYear || week.isoWeek !== first.isoWeek)) {
      fields[`days.${index}.deliveryDate`] = 'other_week';
    }
  }
  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, ...first };
}

/** Every item id the submission names, once each. */
export function itemIdsOf(draft: Pick<SubmissionDraft, 'days'>): string[] {
  const ids = new Set<string>();
  for (const day of draft.days) {
    for (const menu of day.menus) {
      for (const id of [menu.soupId, menu.mainId, menu.sideId, menu.pickleId, menu.dessertId]) {
        if (id) {
          ids.add(id);
        }
      }
    }
  }
  return [...ids];
}

/** Why a submission was not accepted, as the route answers it. */
export type Rejection =
  /** 409: staff closed one of the dates (#60). `fields` marks the same days by path. */
  | { error: 'date_closed'; dates: string[]; fields: Record<string, 'date_closed'> }
  /** 409 when every failure is one the client can fix by dropping a day or an item; else 400. */
  | { error: 'validation'; status: 400 | 409; fields: FieldErrors };

/** The codes that mean "the menu or the clock moved on", not "the request is wrong". */
const conflictCodes: ReadonlySet<OrderErrorCode> = new Set(['cutoff_passed', 'sold_out']);

/**
 * Maps core's verdict to a rejection, or `null` when there is nothing to reject.
 *
 * Core reports a closed delivery date as `cutoff_passed`. It is recognised here first, with
 * core's `isClosedDate`, and answered as `date_closed` on its own: the client drops those days.
 * Otherwise every field goes back; the status is 409 only when all of them are `cutoff_passed` or
 * `sold_out`, so the client can react (re-fetch the menu, mark the item) and send again.
 */
export function rejectionOf(
  draft: Pick<SubmissionDraft, 'days'>,
  errors: FieldErrors,
  closedDates: readonly string[],
  timezone: string,
): Rejection | null {
  if (Object.keys(errors).length === 0) {
    return null;
  }
  const closed: Record<string, 'date_closed'> = {};
  const dates = new Set<string>();
  for (const [index, day] of draft.days.entries()) {
    if (isClosedDate(parseIsoDate(day.deliveryDate, timezone), timezone, closedDates)) {
      closed[`days.${index}.deliveryDate`] = 'date_closed';
      dates.add(day.deliveryDate);
    }
  }
  if (dates.size > 0) {
    return { error: 'date_closed', dates: [...dates].sort(), fields: closed };
  }
  const conflict = Object.values(errors).every((code) => conflictCodes.has(code));
  return { error: 'validation', status: conflict ? 409 : 400, fields: errors };
}

/** A stored submission: its rows, and the 201 body. */
export interface Snapshot {
  submissionId: string;
  orderIds: string[];
  rows: SubmissionRows;
  response: {
    submissionId: string;
    orders: { id: string; deliveryDate: string; total: number }[];
    grandTotal: number;
  };
}

/**
 * The rows of a validated and priced submission: one order per day, each menu numbered from 1
 * within its day (`1. menü`, #56), and every name and price as core priced it, so nothing is ever
 * re-joined to `menu_items` for display.
 *
 * - `order_menus.price` is core's menu price, adjustments included; `order_items.unit_price` is
 *   each item's own price (daily soups 0). Their difference is the menu's adjustment: negative is
 *   `no_soup_discount`, positive is `soup_charge` (the two never apply together).
 * - The difference to the minimum (`missingToMinimum`) is not stored: whether it becomes a priced
 *   line is open (#57).
 * - Name, e-mail, address and note are trimmed, the phone is normalised to `+36…` (as staff search
 *   it), and an empty note is `null`. A pickup order has no address (`''`).
 */
export function snapshotOf(
  draft: SubmissionDraft,
  priced: PricedSubmission,
  newId: () => string = () => crypto.randomUUID(),
): Snapshot {
  const submissionId = newId();
  const name = draft.name.trim();
  const email = draft.email.trim();
  const phone = normalisePhone(draft.phone) ?? draft.phone.trim();
  const address = draft.address?.trim() ?? '';
  const note = draft.note?.trim() || null;

  const rows: SubmissionRows = {
    customer: { emailKey: normaliseEmailKey(email), email, name, phone, address },
    orders: [],
    menus: [],
    items: [],
    extras: [],
  };
  const response: Snapshot['response'] = { submissionId, orders: [], grandTotal: priced.total };

  for (const [index, day] of draft.days.entries()) {
    const pricedDay = priced.days[index];
    if (!pricedDay) {
      throw new Error(`No price for day ${index}`);
    }
    const orderId = newId();
    rows.orders.push({
      id: orderId,
      submissionId,
      deliveryDate: day.deliveryDate,
      fulfilment: day.fulfilment,
      status: 'received',
      name,
      phone,
      email,
      address: day.fulfilment === 'delivery' ? address : '',
      note,
      foodSubtotal: pricedDay.foodSubtotal,
      deliveryFee: pricedDay.deliveryFee,
      total: pricedDay.total,
    });
    for (const [position, menu] of pricedDay.menus.entries()) {
      const orderMenuId = newId();
      rows.menus.push({ id: orderMenuId, orderId, position: position + 1, price: menu.price });
      for (const item of menu.items) {
        rows.items.push({
          orderMenuId,
          slot: item.slot,
          menuItemId: item.itemId,
          name: item.name,
          variation: item.variation ?? null,
          unitPrice: item.unitPrice,
        });
      }
    }
    for (const extra of pricedDay.extras) {
      rows.extras.push({
        orderId,
        extraKey: extra.key,
        name: extra.name,
        quantity: extra.quantity,
        unitPrice: extra.unitPrice,
      });
    }
    response.orders.push({ id: orderId, deliveryDate: day.deliveryDate, total: pricedDay.total });
  }

  return { submissionId, orderIds: response.orders.map((order) => order.id), rows, response };
}
