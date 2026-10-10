import {
  type ComposedMenuDraft,
  type MenuItem,
  maxExtraQuantity,
  type OrderErrorCode,
  orderMessagesHu,
  type PublicMenu,
  validateMenu,
} from '@piccolo/core';
import { strings } from '../strings';

/**
 * The on-page form for the next menu of one day. The soup must be answered: `undefined` until the
 * guest picks a dish or declines it (`null`). Main, variation and side are `null` until chosen.
 * Pickle and dessert start declined (`null`). `extras` holds the Extra block's pending quantities
 * (1..maxExtraQuantity; a missing key is 0).
 */
export interface MenuForm {
  soupId: string | null | undefined;
  mainId: string | null;
  variation: string | null;
  sideId: string | null;
  pickleId: string | null;
  dessertId: string | null;
  extras: Record<string, number>;
}

/** Extra quantities by `ExtraDef.key`, each 1..maxExtraQuantity. */
export type ExtraQuantities = Record<string, number>;

const pristineForm: MenuForm = Object.freeze({
  soupId: undefined,
  mainId: null,
  variation: null,
  sideId: null,
  pickleId: null,
  dessertId: null,
  extras: Object.freeze({}),
});

/** A fresh form. Always the same object, so a store selector that reads it stays stable. */
export function emptyForm(): MenuForm {
  return pristineForm;
}

export function isPristine(form: MenuForm): boolean {
  return (
    form.soupId === undefined &&
    form.mainId === null &&
    form.variation === null &&
    form.sideId === null &&
    form.pickleId === null &&
    form.dessertId === null &&
    Object.keys(form.extras).length === 0
  );
}

/** One answer in the form. A main carries its item: whether the side stays depends on it. */
export type Choice =
  | { slot: 'soup'; id: string | null }
  | { slot: 'main'; item: MenuItem | null }
  | { slot: 'variation'; value: string }
  | { slot: 'side'; id: string }
  | { slot: 'pickle'; id: string | null }
  | { slot: 'dessert'; id: string | null };

export function choose(form: MenuForm, choice: Choice): MenuForm {
  switch (choice.slot) {
    case 'soup':
      return { ...form, soupId: choice.id };
    case 'main':
      return {
        ...form,
        mainId: choice.item?.id ?? null,
        variation: null,
        sideId: choice.item?.requiresSide ? form.sideId : null,
      };
    case 'variation':
      return { ...form, variation: choice.value };
    case 'side':
      return { ...form, sideId: choice.id };
    case 'pickle':
      return { ...form, pickleId: choice.id };
    case 'dessert':
      return { ...form, dessertId: choice.id };
  }
}

/** `extras` with `key` at `quantity`, clamped to 0..max; 0 removes the key. */
function withQuantity(extras: ExtraQuantities, key: string, quantity: number): ExtraQuantities {
  const { [key]: _, ...rest } = extras;
  const clamped = Math.min(maxExtraQuantity, Math.max(0, quantity));
  return clamped === 0 ? rest : { ...rest, [key]: clamped };
}

/** Two sets of extra quantities summed per key, each capped at the maximum. */
export function mergeExtras(a: ExtraQuantities, b: ExtraQuantities): ExtraQuantities {
  let merged = a;
  for (const [key, quantity] of Object.entries(b)) {
    merged = withQuantity(merged, key, (merged[key] ?? 0) + quantity);
  }
  return merged;
}

export function stepExtra(form: MenuForm, key: string, delta: 1 | -1): MenuForm {
  return { ...form, extras: withQuantity(form.extras, key, (form.extras[key] ?? 0) + delta) };
}

/** The menu the form describes: unanswered and declined slots are left out. */
export function toComposedMenu(form: MenuForm): ComposedMenuDraft {
  const menu: ComposedMenuDraft = {};
  if (form.soupId) menu.soupId = form.soupId;
  if (form.mainId) menu.mainId = form.mainId;
  if (form.variation) menu.variation = form.variation;
  if (form.sideId) menu.sideId = form.sideId;
  if (form.pickleId) menu.pickleId = form.pickleId;
  if (form.dessertId) menu.dessertId = form.dessertId;
  return menu;
}

/** The form of a committed menu: its soup counts as answered, a dish or declined. */
export function fromComposedMenu(menu: ComposedMenuDraft): MenuForm {
  return {
    soupId: menu.soupId ?? null,
    mainId: menu.mainId ?? null,
    variation: menu.variation ?? null,
    sideId: menu.sideId ?? null,
    pickleId: menu.pickleId ?? null,
    dessertId: menu.dessertId ?? null,
    extras: {},
  };
}

export interface FormStatus {
  canAdd: boolean;
  /** Why the form cannot be added yet; `null` while it is untouched or when it can be added. */
  message: string | null;
}

/** Field errors of `validateMenu`, most specific first: the footer shows one. */
const fieldOrder = ['variation', 'sideId', 'mainId', 'soupId', 'pickleId', 'dessertId'] as const;

/**
 * Whether the form can be added to the day, and what to tell the guest otherwise. The soup must
 * be answered, unless the day has no soups (then the block is not shown and counts as declined),
 * and core's `validateMenu` must pass.
 */
export function formStatus(form: MenuForm, publicMenu: PublicMenu, date: string): FormStatus {
  const errors = validateMenu(toComposedMenu(form), publicMenu, date);
  const daySoups = Object.values(publicMenu.days).find((day) => day.date === date)?.soups ?? [];
  const soupAnswered = form.soupId !== undefined || daySoups.length === 0;
  const canAdd = soupAnswered && Object.keys(errors).length === 0;
  if (canAdd || isPristine(form)) {
    return { canAdd, message: null };
  }
  const field = fieldOrder.find((key) => errors[key] !== undefined);
  const code: OrderErrorCode | undefined = field && errors[field];
  if (code) return { canAdd, message: orderMessagesHu[code] };
  if (!soupAnswered) return { canAdd, message: strings.composer.unanswered };
  return { canAdd, message: strings.composer.emptyMenu };
}
