import { parseIsoDate } from '../calendar';
import type { RestaurantConfig } from '../config/types';
import type { MenuItem, PublicMenu, Slot } from '../menu/types';
import { type IsPublished, isOrderable } from '../menu/window';
import { findItem } from './lookup';
import { isEmail, normalisePhone } from './normalise';
import {
  type ComposedMenuDraft,
  type DayDraft,
  type FieldErrors,
  maxExtraQuantity,
  type SubmissionDraft,
} from './types';

function prefix(errors: FieldErrors, path: string): FieldErrors {
  const prefixed: FieldErrors = {};
  for (const [key, code] of Object.entries(errors)) {
    prefixed[key === '' ? path : `${path}.${key}`] = code;
  }
  return prefixed;
}

function chosen(id: string | undefined): id is string {
  return typeof id === 'string' && id.length > 0;
}

function readSlot(
  errors: FieldErrors,
  field: string,
  id: string | undefined,
  slot: Slot,
  publicMenu: PublicMenu,
  deliveryDate: string,
): MenuItem | undefined {
  if (!chosen(id)) return undefined;
  const item = findItem(publicMenu, deliveryDate, slot, id);
  if (!item) {
    errors[field] = 'unknown_item';
    return undefined;
  }
  if (!item.active) errors[field] = 'inactive';
  else if (item.soldOut) errors[field] = 'sold_out';
  return item;
}

export function validateMenu(
  menu: ComposedMenuDraft,
  publicMenu: PublicMenu,
  deliveryDate: string,
): FieldErrors {
  const picked = [menu.soupId, menu.mainId, menu.sideId, menu.pickleId, menu.dessertId];
  if (!picked.some((id) => chosen(id))) return { '': 'required' };

  const errors: FieldErrors = {};
  const main = readSlot(errors, 'mainId', menu.mainId, 'main', publicMenu, deliveryDate);
  readSlot(errors, 'soupId', menu.soupId, 'soup', publicMenu, deliveryDate);
  readSlot(errors, 'pickleId', menu.pickleId, 'pickle', publicMenu, deliveryDate);
  readSlot(errors, 'dessertId', menu.dessertId, 'dessert', publicMenu, deliveryDate);

  const variation = chosen(menu.variation) ? menu.variation : undefined;
  const mainMissing = chosen(menu.mainId) && !main;
  if (!mainMissing) {
    if (main && main.variations.length > 0) {
      if (!variation) errors.variation = 'variation_required';
      else if (!main.variations.includes(variation)) errors.variation = 'invalid_variation';
    } else if (variation) {
      errors.variation = 'not_allowed';
    }
  }

  if (main?.requiresSide) {
    if (!chosen(menu.sideId)) errors.sideId = 'side_required';
    else readSlot(errors, 'sideId', menu.sideId, 'side', publicMenu, deliveryDate);
  } else if (chosen(menu.sideId)) {
    errors.sideId = 'not_allowed';
  }

  return errors;
}

function deliveryDateCode(
  deliveryDate: string,
  now: Date,
  config: RestaurantConfig,
  isPublished: IsPublished,
  closedDates: readonly string[],
): 'invalid' | 'cutoff_passed' | undefined {
  let date: ReturnType<typeof parseIsoDate>;
  try {
    date = parseIsoDate(deliveryDate, config.timezone);
  } catch {
    return 'invalid';
  }
  if (!isOrderable(date, now, config, isPublished, closedDates)) return 'cutoff_passed';
  return undefined;
}

export function validateDay(
  day: DayDraft,
  publicMenu: PublicMenu,
  config: RestaurantConfig,
  now: Date,
  isPublished: IsPublished,
  closedDates: readonly string[],
): FieldErrors {
  const errors: FieldErrors = {};
  const dateCode = deliveryDateCode(day.deliveryDate, now, config, isPublished, closedDates);
  if (dateCode) errors.deliveryDate = dateCode;
  if (day.fulfilment !== 'delivery' && day.fulfilment !== 'pickup') {
    errors.fulfilment = 'invalid';
  } else if (day.fulfilment === 'pickup' && !config.pickupEnabled) {
    errors.fulfilment = 'pickup_disabled';
  }
  if (day.menus.length === 0) errors.menus = 'required';
  else {
    for (const [index, menu] of day.menus.entries()) {
      Object.assign(
        errors,
        prefix(validateMenu(menu, publicMenu, day.deliveryDate), `menus.${index}`),
      );
    }
  }
  const seenExtras = new Set<string>();
  for (const [index, extra] of day.extras.entries()) {
    const known = config.extras.some((def) => def.key === extra.key);
    if (!known) errors[`extras.${index}.key`] = 'unknown_extra';
    else if (seenExtras.has(extra.key)) errors[`extras.${index}.key`] = 'duplicate';
    else seenExtras.add(extra.key);
    if (
      !Number.isInteger(extra.quantity) ||
      extra.quantity < 1 ||
      extra.quantity > maxExtraQuantity
    ) {
      errors[`extras.${index}.quantity`] = 'invalid_quantity';
    }
  }
  return errors;
}

export function validateSubmission(
  draft: SubmissionDraft,
  publicMenu: PublicMenu,
  config: RestaurantConfig,
  now: Date,
  isPublished: IsPublished,
  closedDates: readonly string[],
): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'required';
  else if (name.length < 2) errors.name = 'too_short';
  else if (name.length > 80) errors.name = 'too_long';

  if (draft.phone.trim().length === 0) errors.phone = 'required';
  else if (!normalisePhone(draft.phone)) errors.phone = 'invalid_phone';

  const email = draft.email.trim();
  if (email.length === 0) errors.email = 'required';
  else if (!isEmail(email)) errors.email = 'invalid_email';

  const address = draft.address?.trim() ?? '';
  const delivery = draft.days.some((day) => day.fulfilment === 'delivery');
  if (delivery && address.length === 0) errors.address = 'required';
  else if (address.length > 0 && address.length < 5) errors.address = 'too_short';
  else if (address.length > 200) errors.address = 'too_long';

  if (draft.days.length === 0) errors.days = 'required';
  else if (draft.days.length > 7) errors.days = 'too_many';

  const seen = new Set<string>();
  for (const [index, day] of draft.days.entries()) {
    const duplicate = seen.has(day.deliveryDate);
    seen.add(day.deliveryDate);
    Object.assign(
      errors,
      prefix(validateDay(day, publicMenu, config, now, isPublished, closedDates), `days.${index}`),
    );
    if (duplicate) errors[`days.${index}.deliveryDate`] = 'duplicate';
  }
  return errors;
}
