import type { DayDraft } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../lib/api';
import { strings } from '../strings';
import {
  buildSubmission,
  type Contact,
  contactMessage,
  customerStorageKey,
  forgetCustomer,
  readCustomer,
  readRejection,
  rememberCustomer,
} from './checkout';

const contact: Contact = {
  name: 'Kovács Anna',
  phone: '06 30 123 4567',
  email: 'anna@example.hu',
  address: 'Szombathely, Fő tér 1.',
  note: '',
};

const days: DayDraft[] = [
  {
    deliveryDate: '2026-09-09',
    fulfilment: 'delivery',
    menus: [
      { soupId: 'soup-1', mainId: 'main-1' },
      { mainId: 'main-2', sideId: 'side-1' },
    ],
    extras: [],
  },
  {
    deliveryDate: '2026-09-10',
    fulfilment: 'delivery',
    menus: [{ dessertId: 'dessert-1' }],
    extras: [{ key: 'doboz', quantity: 2 }],
  },
];

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

describe('buildSubmission', () => {
  it('sends the days in order, the address for delivery, and leaves out an empty note and honeypot', () => {
    expect(buildSubmission(contact, days, '')).toEqual({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      days,
    });
  });

  it('sends a written note trimmed, and the honeypot when something filled it', () => {
    const body = buildSubmission({ ...contact, note: '  a portán  ' }, days, 'http://spam');
    expect(body.note).toBe('a portán');
    expect(body.website).toBe('http://spam');
  });

  it('leaves out the address when no day is delivered', () => {
    const pickup = days.map((day) => ({ ...day, fulfilment: 'pickup' as const }));
    expect(buildSubmission(contact, pickup, '')).not.toHaveProperty('address');
  });
});

describe('the remembered customer', () => {
  it('keeps name, phone, e-mail and address, never the note, and forgets them', () => {
    const storage = memoryStorage();
    expect(readCustomer(storage)).toBeNull();
    rememberCustomer(storage, { ...contact, name: ' Kovács Anna ', note: 'titok' });
    expect(JSON.parse(storage.getItem(customerStorageKey) ?? '')).not.toHaveProperty('note');
    expect(readCustomer(storage)).toEqual({
      name: 'Kovács Anna',
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
    });
    forgetCustomer(storage);
    expect(readCustomer(storage)).toBeNull();
  });

  it('reads nothing from a value it did not write', () => {
    const storage = memoryStorage();
    for (const raw of ['not json', 'null', '42', '{"name":3}', '{}']) {
      storage.setItem(customerStorageKey, raw);
      expect(readCustomer(storage)).toBeNull();
    }
    expect(readCustomer(null)).toBeNull();
  });
});

describe('contactMessage', () => {
  it("uses the handover's sentence where it has one, else core's, else core's generic one", () => {
    expect(contactMessage('name', 'required')).toBe(strings.checkout.errors.nameRequired);
    expect(contactMessage('address', 'too_short')).toBe(strings.checkout.errors.addressIncomplete);
    expect(contactMessage('name', 'too_long')).toBe('Túl hosszú.');
    expect(contactMessage('note', 'too_big')).toBe('Érvénytelen érték.');
  });
});

describe('readRejection', () => {
  it('reads a failure that never reached the API, a server error and a 413 as a failed send', () => {
    expect(readRejection(new NetworkError(), days)).toEqual({ kind: 'failed' });
    expect(readRejection(new ApiError(500, 'internal', ''), days)).toEqual({ kind: 'failed' });
    expect(readRejection(new ApiError(413, 'payload_too_large', ''), days)).toEqual({
      kind: 'failed',
    });
  });

  it('reads 429 as rate limited', () => {
    expect(readRejection(new ApiError(429, 'rate_limited', ''), days)).toEqual({
      kind: 'rate_limited',
    });
  });

  it('maps contact fields, cutoff and closed days and refused dishes by their paths', () => {
    const rejection = readRejection(
      new ApiError(409, 'validation', '', {
        'days.0.deliveryDate': 'cutoff_passed',
        'days.0.menus.1.sideId': 'sold_out',
        'days.1.menus.0.dessertId': 'inactive',
        email: 'invalid_email',
      }),
      days,
    );
    expect(rejection).toEqual({
      kind: 'invalid',
      contact: { email: 'invalid_email' },
      cutoff: ['2026-09-09'],
      closed: [],
      items: [
        { date: '2026-09-09', menu: 1, slot: 'side', itemId: 'side-1' },
        { date: '2026-09-10', menu: 0, slot: 'dessert', itemId: 'dessert-1' },
      ],
      other: false,
    });
    expect(
      readRejection(
        new ApiError(409, 'date_closed', '', { 'days.1.deliveryDate': 'date_closed' }),
        days,
      ),
    ).toMatchObject({ kind: 'invalid', closed: ['2026-09-10'], other: false });
  });

  it('marks what the guest cannot fix from the form as other', () => {
    for (const fields of [
      { 'days.0.menus.0.variation': 'variation_required' },
      { 'days.5.deliveryDate': 'cutoff_passed' },
      { 'days.0.extras.0.quantity': 'invalid_quantity' },
      { days: 'too_many' },
    ]) {
      expect(readRejection(new ApiError(400, 'validation', '', fields), days)).toMatchObject({
        kind: 'invalid',
        other: true,
      });
    }
  });
});
