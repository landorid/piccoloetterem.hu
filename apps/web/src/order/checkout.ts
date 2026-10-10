import {
  type DayDraft,
  type OrderErrorCode,
  orderMessagesHu,
  type Slot,
  type SubmissionDraft,
} from '@piccolo/core';
import { ApiError } from '../lib/api';
import { strings } from '../strings';
import type { IsoDate } from './cart';

/** The checkout form's fields, as typed. */
export const contactFields = ['name', 'phone', 'email', 'address', 'note'] as const;

export type ContactField = (typeof contactFields)[number];

export type Contact = Record<ContactField, string>;

export const emptyContact: Contact = { name: '', phone: '', email: '', address: '', note: '' };

/** Field → error code: core's codes, or whatever else the API answered for that field. */
export type ContactErrors = Partial<Record<ContactField, string>>;

/** What the browser remembers from the last successful order. Never the note. */
export type RememberedCustomer = Pick<Contact, 'name' | 'phone' | 'email' | 'address'>;

export const customerStorageKey = 'piccolo.customer';

const rememberedFields = ['name', 'phone', 'email', 'address'] as const;

/** The remembered customer, or null when there is none or it cannot be read. */
export function readCustomer(storage: Storage | null): RememberedCustomer | null {
  try {
    const raw = storage?.getItem(customerStorageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const customer: RememberedCustomer = { name: '', phone: '', email: '', address: '' };
    for (const field of rememberedFields) {
      const text = record[field];
      if (typeof text === 'string') customer[field] = text;
    }
    return Object.values(customer).some((text) => text !== '') ? customer : null;
  } catch {
    return null;
  }
}

export function rememberCustomer(storage: Storage | null, contact: Contact): void {
  const { name, phone, email, address } = contact;
  try {
    storage?.setItem(
      customerStorageKey,
      JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), address }),
    );
  } catch {
    // Private mode or a full storage: the next order is simply not prefilled.
  }
}

export function forgetCustomer(storage: Storage | null): void {
  try {
    storage?.removeItem(customerStorageKey);
  } catch {
    // Nothing was remembered where it cannot be read.
  }
}

/** `localStorage`, or null where it does not exist or throws on access. */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Whether any day is delivered, so the address is asked for and required. */
export function needsAddress(days: readonly DayDraft[]): boolean {
  return days.some((day) => day.fulfilment === 'delivery');
}

/**
 * `POST /api/orders`'s body. The days go in the order they are given, so the API's `days.N.…`
 * paths index them. `website` is the honeypot, sent only when something filled it.
 */
export function buildSubmission(
  contact: Contact,
  days: DayDraft[],
  website: string,
): SubmissionDraft & { website?: string } {
  const note = contact.note.trim();
  return {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    ...(needsAddress(days) ? { address: contact.address } : {}),
    ...(note ? { note } : {}),
    days,
    ...(website ? { website } : {}),
  };
}

const fieldMessages: Partial<Record<ContactField, Partial<Record<string, string>>>> = {
  name: { required: strings.checkout.errors.nameRequired },
  phone: {
    required: strings.checkout.errors.phoneRequired,
    invalid_phone: strings.checkout.errors.phoneInvalid,
  },
  email: {
    required: strings.checkout.errors.emailRequired,
    invalid_email: strings.checkout.errors.emailInvalid,
  },
  address: {
    required: strings.checkout.errors.addressRequired,
    too_short: strings.checkout.errors.addressIncomplete,
  },
};

function isOrderErrorCode(code: string): code is OrderErrorCode {
  return Object.hasOwn(orderMessagesHu, code);
}

/** The sentence under a field: the handover's own where it has one, else core's for the code. */
export function contactMessage(field: ContactField, code: string): string {
  return (
    fieldMessages[field]?.[code] ??
    (isOrderErrorCode(code) ? orderMessagesHu[code] : orderMessagesHu.invalid)
  );
}

/** A dish of the cart the API refused: `menu` indexes the day's menus. */
export interface UnavailableItem {
  date: IsoDate;
  menu: number;
  slot: Slot;
  itemId: string;
}

/** What a failed `POST /api/orders` means for the guest. */
export type Rejection =
  /** Nothing to correct: the request failed (network, 5xx, 413). The cart stays; try again. */
  | { kind: 'failed' }
  | { kind: 'rate_limited' }
  | {
      kind: 'invalid';
      /** Checkout fields to mark. */
      contact: ContactErrors;
      /** Days whose cutoff passed meanwhile (409 `cutoff_passed`). */
      cutoff: IsoDate[];
      /** Days staff closed meanwhile (409 `date_closed`, #60). */
      closed: IsoDate[];
      /** Dishes sold out, withdrawn or gone since they went into the cart. */
      items: UnavailableItem[];
      /** Something the guest cannot fix from this page (a stale or tampered cart). */
      other: boolean;
    };

const slotOfField: Partial<Record<string, Slot>> = {
  soupId: 'soup',
  mainId: 'main',
  sideId: 'side',
  pickleId: 'pickle',
  dessertId: 'dessert',
};

const itemGone = new Set(['sold_out', 'inactive', 'unknown_item']);

const contactPath = new Set<string>(contactFields);

/**
 * Reads the API's refusal of `days`, the submitted days. Field paths come from core
 * (`days.0.menus.1.mainId`), plus `days.N.deliveryDate: 'date_closed'` for a closed date.
 */
export function readRejection(error: unknown, days: readonly DayDraft[]): Rejection {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.status === 429) return { kind: 'rate_limited' };
  if (!error.fields || (error.code !== 'validation' && error.code !== 'date_closed')) {
    return { kind: 'failed' };
  }

  const rejection: Extract<Rejection, { kind: 'invalid' }> = {
    kind: 'invalid',
    contact: {},
    cutoff: [],
    closed: [],
    items: [],
    other: false,
  };
  for (const [path, code] of Object.entries(error.fields)) {
    if (contactPath.has(path)) {
      rejection.contact[path as ContactField] = code;
      continue;
    }
    const [, dayIndex, rest] = /^days\.(\d+)\.(.+)$/.exec(path) ?? [];
    const day = dayIndex === undefined ? undefined : days[Number(dayIndex)];
    if (!day || rest === undefined) {
      rejection.other = true;
    } else if (rest === 'deliveryDate' && code === 'cutoff_passed') {
      rejection.cutoff.push(day.deliveryDate);
    } else if (rest === 'deliveryDate' && code === 'date_closed') {
      rejection.closed.push(day.deliveryDate);
    } else {
      const [, menuIndex, field] = /^menus\.(\d+)\.(\w+)$/.exec(rest) ?? [];
      const menu = menuIndex === undefined ? undefined : day.menus[Number(menuIndex)];
      const slot = field === undefined ? undefined : slotOfField[field];
      const itemId = menu && field ? menu[field as keyof typeof menu] : undefined;
      if (slot && itemId && itemGone.has(code)) {
        rejection.items.push({ date: day.deliveryDate, menu: Number(menuIndex), slot, itemId });
      } else {
        rejection.other = true;
      }
    }
  }
  return rejection;
}
