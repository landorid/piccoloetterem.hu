import type { ComposedMenuDraft, PublicMenu } from '@piccolo/core';
import {
  type ExtraQuantities,
  emptyForm,
  formStatus,
  fromComposedMenu,
  isPristine,
  type MenuForm,
  mergeExtras,
  toComposedMenu,
} from './form';

/** `YYYY-MM-DD`, a date of the open week. */
export type IsoDate = string;

/** The persisted part of the order. Committed menus use core's `ComposedMenuDraft` shape. */
export interface CartState {
  activeDate: IsoDate | null;
  /** Committed menus per day. Invariant: a key exists only with at least one menu. */
  menusByDate: Record<IsoDate, ComposedMenuDraft[]>;
  /** Committed extras per day. Invariant: a key exists only with an extra and a menu that day. */
  extrasByDate: Record<IsoDate, ExtraQuantities>;
  /**
   * The half-built form of each day; a missing key is a fresh form. Persisted so that a reload
   * during an edit never loses the menu that was pulled back into the form.
   */
  formsByDate: Record<IsoDate, MenuForm>;
}

export const emptyCart: CartState = {
  activeDate: null,
  menusByDate: {},
  extrasByDate: {},
  formsByDate: {},
};

export function formFor(state: CartState, date: IsoDate): MenuForm {
  return state.formsByDate[date] ?? emptyForm();
}

function without<V>(record: Record<IsoDate, V>, date: IsoDate): Record<IsoDate, V> {
  const { [date]: _, ...rest } = record;
  return rest;
}

function withForm(state: CartState, date: IsoDate, form: MenuForm): CartState {
  return {
    ...state,
    formsByDate: isPristine(form)
      ? without(state.formsByDate, date)
      : { ...state.formsByDate, [date]: form },
  };
}

export function changeForm(
  state: CartState,
  date: IsoDate,
  change: (form: MenuForm) => MenuForm,
): CartState {
  return withForm(state, date, change(formFor(state, date)));
}

/** The day's form starts over. Its pending extras go too, an edit's extras included. */
export function resetForm(state: CartState, date: IsoDate): CartState {
  return withForm(state, date, emptyForm());
}

/** Commits the day's form as a menu and merges its extras into the day; a no-op unless addable. */
export function addMenu(state: CartState, date: IsoDate, publicMenu: PublicMenu): CartState {
  const form = formFor(state, date);
  if (!formStatus(form, publicMenu, date).canAdd) {
    return state;
  }
  const extras = mergeExtras(state.extrasByDate[date] ?? {}, form.extras);
  const added: CartState = {
    ...state,
    menusByDate: {
      ...state.menusByDate,
      [date]: [...(state.menusByDate[date] ?? []), toComposedMenu(form)],
    },
    extrasByDate:
      Object.keys(extras).length > 0
        ? { ...state.extrasByDate, [date]: extras }
        : state.extrasByDate,
  };
  return withForm(added, date, emptyForm());
}

/**
 * The menu leaves the cart and becomes the day's form, replacing what the form held. The day's
 * extras come with it, because the form is the only place they are changed.
 */
export function editMenu(state: CartState, date: IsoDate, index: number): CartState {
  const menus = state.menusByDate[date] ?? [];
  const menu = menus[index];
  if (!menu) {
    return state;
  }
  const rest = menus.filter((_, i) => i !== index);
  const extras = mergeExtras(formFor(state, date).extras, state.extrasByDate[date] ?? {});
  const edited: CartState = {
    ...state,
    menusByDate:
      rest.length > 0 ? { ...state.menusByDate, [date]: rest } : without(state.menusByDate, date),
    extrasByDate: without(state.extrasByDate, date),
  };
  return withForm(edited, date, { ...fromComposedMenu(menu), extras });
}

/** Removes a menu; the day's last menu takes the day's extras with it. */
export function removeMenu(state: CartState, date: IsoDate, index: number): CartState {
  const rest = (state.menusByDate[date] ?? []).filter((_, i) => i !== index);
  if (rest.length > 0) {
    return { ...state, menusByDate: { ...state.menusByDate, [date]: rest } };
  }
  return {
    ...state,
    menusByDate: without(state.menusByDate, date),
    extrasByDate: without(state.extrasByDate, date),
  };
}

/** The days leave the cart, menus, extras and form alike. Nothing records why. */
export function removeDays(state: CartState, dates: readonly IsoDate[]): CartState {
  const gone = new Set(dates);
  const keep = <V>(record: Record<IsoDate, V>) =>
    Object.fromEntries(Object.entries(record).filter(([date]) => !gone.has(date)));
  return {
    ...state,
    menusByDate: keep(state.menusByDate),
    extrasByDate: keep(state.extrasByDate),
    formsByDate: keep(state.formsByDate),
  };
}

export function selectDate(state: CartState, date: IsoDate): CartState {
  return { ...state, activeDate: date };
}

function only<V>(record: Record<IsoDate, V>, keep: ReadonlySet<IsoDate>): Record<IsoDate, V> {
  return Object.fromEntries(Object.entries(record).filter(([date]) => keep.has(date)));
}

/**
 * Fits the cart to a fresh menu answer: every day that is no longer orderable leaves, menus,
 * extras and form alike. `dropped` lists the days that held menus, for the explanation. The
 * active day stays as it is: the screen resolves it, and a selected closed day must survive.
 */
export function reconcile(
  state: CartState,
  orderableDates: readonly IsoDate[],
): { state: CartState; dropped: IsoDate[] } {
  const keep = new Set(orderableDates);
  const dropped = Object.keys(state.menusByDate)
    .filter((date) => !keep.has(date))
    .sort();
  const stale = (record: Record<IsoDate, unknown>) =>
    Object.keys(record).some((date) => !keep.has(date));
  if (!stale(state.menusByDate) && !stale(state.extrasByDate) && !stale(state.formsByDate)) {
    return { state, dropped };
  }
  return {
    state: {
      activeDate: state.activeDate,
      menusByDate: only(state.menusByDate, keep),
      extrasByDate: only(state.extrasByDate, keep),
      formsByDate: only(state.formsByDate, keep),
    },
    dropped,
  };
}
