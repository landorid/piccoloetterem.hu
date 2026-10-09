import {
  type AllergenCode,
  type MenuItem,
  type PermanentItemDraft,
  type PermanentItemsDraft,
  type PermanentMenu,
  type PermanentSection,
  permanentSections,
  planPermanentItems,
} from '@piccolo/core';

/*
 * The `/etlap` editor's state: the whole permanent menu as staff edit it, before it is sent with
 * `PUT /api/admin/menu/items`. Pure, so the page stays thin. The rules an item must pass are
 * core's (`planPermanentItems`); this module only turns rows into a draft and back.
 *
 * Within a section the rows are in the order guests see them: active rows first, inactive ones
 * after them. That order is also the payload's, so a row's index is its `sortOrder` and the
 * index in an error path (`sides.2.name`) points at the row.
 */

export const sections = Object.keys(permanentSections) as PermanentSection[];

/** One item as the editor holds it. Prices stay text until the save, so any input can be typed. */
export interface ItemRow {
  /** Stable React key: the stored item's id, or a client key for a row not saved yet. */
  key: string;
  /** The stored item; `undefined` for a row not saved yet. */
  id: string | undefined;
  name: string;
  description: string;
  priceWeekday: string;
  /** Empty: the weekday price also applies on the weekend. */
  priceWeekend: string;
  variations: readonly string[];
  allergens: readonly AllergenCode[];
  /** Not edited on this page; kept as stored. */
  soupIncluded: boolean;
  requiresSide: boolean;
  /** Shown, never saved with the rest: it has its own immediate route. */
  soldOut: boolean;
  active: boolean;
}

export type EditorState = Readonly<Record<PermanentSection, readonly ItemRow[]>>;

/** The fields a row's inputs edit, in the order they appear. */
export type ItemField =
  | 'name'
  | 'description'
  | 'priceWeekday'
  | 'priceWeekend'
  | 'variations'
  | 'requiresSide'
  | 'allergens';

/** Row key → field (`name`, `priceWeekday`, `id`…) → error code (core's, or the API's). */
export type RowErrors = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Each section's row keys in payload order: what an error path's index refers to. */
export type RowKeys = Readonly<Record<PermanentSection, readonly string[]>>;

function rowFromItem(item: MenuItem): ItemRow {
  return {
    key: item.id,
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    priceWeekday: String(item.priceWeekday),
    priceWeekend: item.priceWeekend === null ? '' : String(item.priceWeekend),
    variations: item.variations,
    allergens: item.allergens,
    soupIncluded: item.soupIncluded,
    requiresSide: item.requiresSide,
    soldOut: item.soldOut,
    active: item.active,
  };
}

/** The editor's starting point: the permanent menu as `GET /items` returns it. */
export function editorFromMenu(menu: PermanentMenu): EditorState {
  const section = (name: PermanentSection) => {
    const rows = menu[name].map(rowFromItem);
    return [...rows.filter((row) => row.active), ...rows.filter((row) => !row.active)];
  };
  return {
    allWeek: section('allWeek'),
    desserts: section('desserts'),
    pickles: section('pickles'),
    sides: section('sides'),
    sideExtras: section('sideExtras'),
  };
}

/** Whether the editor differs from `base` in anything the save would send. */
export function isDirty(state: EditorState, base: EditorState): boolean {
  const comparable = (editor: EditorState) =>
    JSON.stringify(sections.map((name) => editor[name].map(({ soldOut: _, ...row }) => row)));
  return comparable(state) !== comparable(base);
}

/**
 * A price as typed: whole forints, spaces allowed as thousands separators. Anything else is
 * `NaN`, which core reports as `not_integer`.
 */
export function parsePrice(text: string): number {
  const compact = text.replace(/\s/g, '');
  return /^-?\d+$/.test(compact) ? Number(compact) : Number.NaN;
}

function draftFromRow(row: ItemRow): PermanentItemDraft {
  const description = row.description.trim();
  return {
    ...(row.id === undefined ? {} : { id: row.id }),
    name: row.name.trim(),
    description: description === '' ? null : description,
    priceWeekday: parsePrice(row.priceWeekday),
    priceWeekend: row.priceWeekend.trim() === '' ? null : parsePrice(row.priceWeekend),
    variations: row.variations,
    allergens: row.allergens,
    soupIncluded: row.soupIncluded,
    requiresSide: row.requiresSide,
    active: row.active,
  };
}

/** The body of `PUT /items`: every row, in the editor's order. */
export function draftFromEditor(state: EditorState): PermanentItemsDraft {
  return {
    allWeek: state.allWeek.map(draftFromRow),
    desserts: state.desserts.map(draftFromRow),
    pickles: state.pickles.map(draftFromRow),
    sides: state.sides.map(draftFromRow),
    sideExtras: state.sideExtras.map(draftFromRow),
  };
}

export function rowKeys(state: EditorState): RowKeys {
  return {
    allWeek: state.allWeek.map((row) => row.key),
    desserts: state.desserts.map((row) => row.key),
    pickles: state.pickles.map((row) => row.key),
    sides: state.sides.map((row) => row.key),
    sideExtras: state.sideExtras.map((row) => row.key),
  };
}

/**
 * Error paths (`allWeek.0.name: 'required'`), as core and the API key them, attached to the rows
 * they were reported on. A path that names no row is dropped.
 */
export function errorsByRow(fields: Readonly<Record<string, string>>, keys: RowKeys): RowErrors {
  const errors: Record<string, Record<string, string>> = {};
  for (const [path, code] of Object.entries(fields)) {
    const [section, index, field] = path.split('.');
    if (!section || !Object.hasOwn(keys, section) || field === undefined) {
      continue;
    }
    const key = keys[section as PermanentSection][Number(index)];
    if (key !== undefined) {
      errors[key] = { ...errors[key], [field]: code };
    }
  }
  return errors;
}

export function errorCount(errors: RowErrors): number {
  return Object.values(errors).reduce((count, row) => count + Object.keys(row).length, 0);
}

/** `errors` without that row's error on `field`, once staff have changed the field. */
export function withoutError(errors: RowErrors, key: string, field: string): RowErrors {
  const row = errors[key];
  if (!row || !(field in row)) {
    return errors;
  }
  const { [field]: _, ...rest } = row;
  const { [key]: __, ...others } = errors;
  return Object.keys(rest).length > 0 ? { ...others, [key]: rest } : others;
}

export type SaveCheck =
  | { ok: true; draft: PermanentItemsDraft; keys: RowKeys }
  | { ok: false; errors: RowErrors };

/**
 * What the save would send, checked with core's `planPermanentItems` against the stored menu, so
 * staff see every error the API would report without a round trip.
 */
export function checkSave(state: EditorState, stored: PermanentMenu): SaveCheck {
  const draft = draftFromEditor(state);
  const keys = rowKeys(state);
  const byId = new Map(sections.flatMap((name) => stored[name]).map((item) => [item.id, item]));
  const result = planPermanentItems(draft, byId);
  return result.ok
    ? { ok: true, draft, keys }
    : { ok: false, errors: errorsByRow(result.fields, keys) };
}

// ---- Edits ----

/** An empty row for a new item. A side has no price, so its weekday price starts at 0. */
export function newRow(section: PermanentSection, key: string): ItemRow {
  return {
    key,
    id: undefined,
    name: '',
    description: '',
    priceWeekday: section === 'sides' ? '0' : '',
    priceWeekend: '',
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
    soldOut: false,
    active: true,
  };
}

function activeCount(rows: readonly ItemRow[]): number {
  return rows.filter((row) => row.active).length;
}

function withSection(
  state: EditorState,
  section: PermanentSection,
  rows: readonly ItemRow[],
): EditorState {
  return { ...state, [section]: rows };
}

/** Adds a row at the end of the section's active items. */
export function addRow(state: EditorState, section: PermanentSection, row: ItemRow): EditorState {
  const rows = [...state[section]];
  rows.splice(activeCount(rows), 0, row);
  return withSection(state, section, rows);
}

export function updateRow(
  state: EditorState,
  section: PermanentSection,
  key: string,
  patch: Partial<Pick<ItemRow, ItemField>>,
): EditorState {
  return withSection(
    state,
    section,
    state[section].map((row) => (row.key === key ? { ...row, ...patch } : row)),
  );
}

/** Drops a row that was never saved. A stored item is deactivated instead, never removed. */
export function removeNewRow(
  state: EditorState,
  section: PermanentSection,
  key: string,
): EditorState {
  return withSection(
    state,
    section,
    state[section].filter((row) => row.key !== key || row.id !== undefined),
  );
}

/** Swaps an active row with its neighbour; inactive rows and the ends of the list stay put. */
export function moveRow(
  state: EditorState,
  section: PermanentSection,
  key: string,
  direction: -1 | 1,
): EditorState {
  const rows = [...state[section]];
  const from = rows.findIndex((row) => row.key === key);
  const to = from + direction;
  const row = rows[from];
  const other = rows[to];
  if (!row?.active || !other?.active) {
    return state;
  }
  rows[from] = other;
  rows[to] = row;
  return withSection(state, section, rows);
}

/**
 * Deactivating moves a row to the top of the inactive items, reactivating to the end of the
 * active ones, so the active items keep their order and inactive ones stay at the bottom.
 */
export function setActive(
  state: EditorState,
  section: PermanentSection,
  key: string,
  active: boolean,
): EditorState {
  const row = state[section].find((candidate) => candidate.key === key);
  if (!row || row.active === active) {
    return state;
  }
  const rows = state[section].filter((candidate) => candidate.key !== key);
  rows.splice(activeCount(rows), 0, { ...row, active });
  return withSection(state, section, rows);
}

/** Sets the sold-out flag of the stored item `id`, wherever it is listed. */
export function setSoldOut(state: EditorState, id: string, soldOut: boolean): EditorState {
  const section = sections.find((name) => state[name].some((row) => row.id === id));
  if (!section) {
    return state;
  }
  return withSection(
    state,
    section,
    state[section].map((row) => (row.id === id ? { ...row, soldOut } : row)),
  );
}

/** The same, on the permanent menu as the API returns it (the query cache). */
export function menuWithSoldOut<T extends { id: string; soldOut: boolean }>(
  menu: Readonly<Record<PermanentSection, readonly T[]>>,
  id: string,
  soldOut: boolean,
): Record<PermanentSection, T[]> {
  const section = (name: PermanentSection) =>
    menu[name].map((item) => (item.id === id ? { ...item, soldOut } : item));
  return {
    allWeek: section('allWeek'),
    desserts: section('desserts'),
    pickles: section('pickles'),
    sides: section('sides'),
    sideExtras: section('sideExtras'),
  };
}
