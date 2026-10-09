import {
  allergenCodes,
  datesOfIsoWeek,
  isIsoWeek,
  isoDate,
  isoWeekOf,
  type MenuDay,
  parseIsoDate,
  type TZDate,
  type WeekDraft,
  type WeekItemDraft,
} from '@piccolo/core';
import { addDays } from 'date-fns';

/*
 * The weekly menu grid as staff edit it, and its round trip to the API's week shape. Pure, so the
 * page stays thin and this is unit-tested on its own (model.test.ts).
 *
 * The grid holds rows, not items: prices are the inputs' text, and a blank row (nothing typed in
 * it yet) is an empty slot that is left out of the save. A new week starts as the old system's
 * template, 2 soups and 5 mains per day, so staff fill in slots instead of adding rows.
 */

export const menuDays = [1, 2, 3, 4, 5, 6] as const satisfies readonly MenuDay[];

export type IsoWeek = { isoYear: number; isoWeek: number };

/** The three kinds of list in a week. Each fixes its items' category on the server. */
export type ListKind = 'soups' | 'mains' | 'featured';

/** Where a list sits in the week: `days.3.mains`, `featured`. The API's error paths start with it. */
export type ListPath = `days.${MenuDay}.soups` | `days.${MenuDay}.mains` | 'featured';

/** One row of the grid. */
export interface Row {
  /** Stable React key, unique in the grid. */
  key: string;
  /** The stored weekly item, or undefined for a row that has never been saved. */
  id: string | undefined;
  name: string;
  description: string;
  /** The price inputs' text. An empty weekend price means the weekday price applies. */
  priceWeekday: string;
  priceWeekend: string;
  variations: readonly string[];
  allergens: readonly string[];
  soupIncluded: boolean;
  /** Not edited in the grid; kept as stored. */
  requiresSide: boolean;
}

export interface Grid {
  days: Record<MenuDay, { soups: Row[]; mains: Row[] }>;
  featured: Row[];
}

/** The editable fields of a row, the keys the API's error paths end with. */
export type RowField = Exclude<keyof Row, 'key'>;

/** Per row key, the error code of each invalid field: core's codes, or this module's. */
export type RowErrors = Record<string, Partial<Record<RowField, string>>>;

export const maxFeatured = 5;

const templateSoups = 2;

/** The old system's default prices of the five daily mains; Saturday's weekend price is +100. */
const defaultMainPrices = [1020, 1020, 1120, 1120, 1170] as const;
const saturdaySurcharge = 100;

let lastKey = 0;
function newKey(): string {
  lastKey += 1;
  return `new-${lastKey}`;
}

/** The list a path names. */
export function listAt(grid: Grid, path: ListPath): Row[] {
  if (path === 'featured') {
    return grid.featured;
  }
  const [, day, kind] = path.split('.') as [string, `${MenuDay}`, 'soups' | 'mains'];
  return grid.days[Number(day) as MenuDay][kind];
}

export function listPath(kind: ListKind, day: MenuDay | null): ListPath {
  return kind === 'featured' || day === null ? 'featured' : `days.${day}.${kind}`;
}

export function kindOf(path: ListPath): ListKind {
  return path === 'featured' ? 'featured' : path.endsWith('.soups') ? 'soups' : 'mains';
}

function dayOf(path: ListPath): MenuDay | null {
  return path === 'featured' ? null : (Number(path.split('.')[1]) as MenuDay);
}

/**
 * A new, blank row for position `index` of a list. Daily soups are free (the menu's price
 * includes them); mains get the old system's default price for their position, and Saturday's a
 * weekend price too; featured rows start without prices. Mains and featured include a soup.
 */
export function newRow(path: ListPath, index: number): Row {
  const kind = kindOf(path);
  const blank = {
    key: newKey(),
    id: undefined,
    name: '',
    description: '',
    variations: [],
    allergens: [],
    requiresSide: false,
  };
  if (kind === 'soups') {
    return { ...blank, priceWeekday: '0', priceWeekend: '', soupIncluded: false };
  }
  if (kind === 'featured') {
    return { ...blank, priceWeekday: '', priceWeekend: '', soupIncluded: true };
  }
  const price = defaultMainPrices[Math.min(index, defaultMainPrices.length - 1)] ?? 0;
  const saturday = dayOf(path) === 6;
  return {
    ...blank,
    priceWeekday: String(price),
    priceWeekend: saturday ? String(price + saturdaySurcharge) : '',
    soupIncluded: true,
  };
}

function rowFromItem(path: ListPath, item: WeekItemDraft): Row {
  return {
    key: item.id === undefined ? newKey() : `${path}/${item.id}`,
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    priceWeekday: String(item.priceWeekday),
    priceWeekend: item.priceWeekend === null ? '' : String(item.priceWeekend),
    variations: item.variations,
    allergens: item.allergens,
    soupIncluded: item.soupIncluded,
    requiresSide: item.requiresSide,
  };
}

/** Every list of a week, with its path. */
function listsOf<T>(week: {
  days: Readonly<Record<MenuDay, { soups: T; mains: T }>>;
  featured: T;
}): [ListPath, T][] {
  return [
    ...menuDays.flatMap((day): [ListPath, T][] => [
      [`days.${day}.soups`, week.days[day].soups],
      [`days.${day}.mains`, week.days[day].mains],
    ]),
    ['featured', week.featured],
  ];
}

export function isEmptyWeek(week: WeekDraft): boolean {
  return listsOf(week).every(([, list]) => list.length === 0);
}

/**
 * The grid of a stored week, row for item. A week with no items opens as the template: 2 soups
 * and 5 mains a day, no featured rows.
 */
export function gridFromWeek(week: WeekDraft): Grid {
  if (isEmptyWeek(week)) {
    const day = (d: MenuDay) => ({
      soups: Array.from({ length: templateSoups }, (_, i) => newRow(`days.${d}.soups`, i)),
      mains: defaultMainPrices.map((_, i) => newRow(`days.${d}.mains`, i)),
    });
    return {
      days: { 1: day(1), 2: day(2), 3: day(3), 4: day(4), 5: day(5), 6: day(6) },
      featured: [],
    };
  }
  const day = (d: MenuDay) => ({
    soups: week.days[d].soups.map((item) => rowFromItem(`days.${d}.soups`, item)),
    mains: week.days[d].mains.map((item) => rowFromItem(`days.${d}.mains`, item)),
  });
  return {
    days: { 1: day(1), 2: day(2), 3: day(3), 4: day(4), 5: day(5), 6: day(6) },
    featured: week.featured.map((item) => rowFromItem('featured', item)),
  };
}

/** A row nothing has been typed into: no name, description, variation or allergen. */
export function isBlank(row: Row): boolean {
  return (
    row.name.trim() === '' &&
    row.description.trim() === '' &&
    row.variations.length === 0 &&
    row.allergens.length === 0
  );
}

/** The grid with the list at `path` replaced by `update(list)`. */
export function updateList(grid: Grid, path: ListPath, update: (list: Row[]) => Row[]): Grid {
  if (path === 'featured') {
    return { ...grid, featured: update(grid.featured) };
  }
  const day = dayOf(path) as MenuDay;
  const kind = kindOf(path) as 'soups' | 'mains';
  return {
    ...grid,
    days: { ...grid.days, [day]: { ...grid.days[day], [kind]: update(grid.days[day][kind]) } },
  };
}

/** Allergen codes in the EU list's order, unknown ones dropped. */
export function sortAllergens(codes: Iterable<string>): string[] {
  const set = new Set(codes);
  return allergenCodes.filter((code) => set.has(code));
}

type Price = { ok: true; value: number | null } | { ok: false; code: 'required' | 'not_integer' };

/**
 * A price input's text as forints. Spaces are ignored (`1 020`). Empty is `null` where the price
 * is optional. A number that is not whole, or negative, is sent as typed: the API's rules reject
 * it, and their error is shown at the field.
 */
export function parsePrice(text: string, optional: boolean): Price {
  const compact = text.replace(/\s/g, '');
  if (compact === '') {
    return optional ? { ok: true, value: null } : { ok: false, code: 'required' };
  }
  if (!/^-?\d+(\.\d+)?$/.test(compact)) {
    return { ok: false, code: 'not_integer' };
  }
  return { ok: true, value: Number(compact) };
}

export interface BuiltDraft {
  /** The body of `PUT /weeks/:year/:week`. */
  draft: WeekDraft;
  /** Which row each item came from: `days.1.mains.0` → row key. Blank rows are not sent. */
  rowAt: ReadonlyMap<string, string>;
  /** Fields that cannot be sent at all (a price that is not a number). Empty when it can be saved. */
  errors: RowErrors;
}

type Content = Omit<WeekItemDraft, 'id'>;

function contentOf(item: WeekItemDraft): Content {
  return {
    name: item.name,
    description: item.description,
    priceWeekday: item.priceWeekday,
    priceWeekend: item.priceWeekend,
    variations: item.variations,
    allergens: item.allergens,
    soupIncluded: item.soupIncluded,
    requiresSide: item.requiresSide,
  };
}

const sameContent = (a: Content, b: Content) =>
  JSON.stringify(contentOf(a)) === JSON.stringify(contentOf(b));

/**
 * The `PUT` body for the grid, leaving blank rows out. Names and descriptions are trimmed, and an
 * empty description is `null`.
 *
 * One stored item may sit in several lists (the API allows it, with identical content). When a
 * row of such an item is edited, that row is saved as a new item, so the edit stays in its own
 * cell instead of being rejected as a conflict. `stored` is the week the grid was loaded from.
 */
export function buildDraft(grid: Grid, stored: WeekDraft): BuiltDraft {
  const storedById = new Map<string, Content>();
  for (const [, list] of listsOf(stored)) {
    for (const item of list) {
      if (item.id !== undefined) {
        storedById.set(item.id, contentOf(item));
      }
    }
  }
  const lists = listsOf(grid).map(
    ([path, rows]) => [path, rows.filter((row) => !isBlank(row))] as const,
  );
  const uses = new Map<string, number>();
  for (const [, rows] of lists) {
    for (const row of rows) {
      if (row.id !== undefined) {
        uses.set(row.id, (uses.get(row.id) ?? 0) + 1);
      }
    }
  }

  const errors: RowErrors = {};
  const rowAt = new Map<string, string>();
  const toItems = (path: ListPath, rows: readonly Row[]): WeekItemDraft[] =>
    rows.map((row, index) => {
      rowAt.set(`${path}.${index}`, row.key);
      const weekday = parsePrice(row.priceWeekday, false);
      const weekend = parsePrice(row.priceWeekend, true);
      const rowErrors: Partial<Record<RowField, string>> = {};
      if (!weekday.ok) {
        rowErrors.priceWeekday = weekday.code;
      }
      if (!weekend.ok) {
        rowErrors.priceWeekend = weekend.code;
      }
      if (Object.keys(rowErrors).length > 0) {
        errors[row.key] = rowErrors;
      }
      const description = row.description.trim();
      const content: Content = {
        name: row.name.trim(),
        description: description === '' ? null : description,
        priceWeekday: weekday.ok ? (weekday.value ?? 0) : 0,
        priceWeekend: weekend.ok ? weekend.value : null,
        variations: row.variations,
        allergens: row.allergens,
        soupIncluded: row.soupIncluded,
        requiresSide: row.requiresSide,
      };
      const original = row.id === undefined ? undefined : storedById.get(row.id);
      const forked =
        (uses.get(row.id ?? '') ?? 0) > 1 && original && !sameContent(original, content);
      return row.id === undefined || forked ? content : { id: row.id, ...content };
    });

  const items = new Map(lists.map(([path, rows]) => [path, toItems(path, rows)]));
  const list = (path: ListPath) => items.get(path) ?? [];
  const day = (d: MenuDay) => ({
    soups: list(`days.${d}.soups`),
    mains: list(`days.${d}.mains`),
  });
  return {
    draft: {
      days: { 1: day(1), 2: day(2), 3: day(3), 4: day(4), 5: day(5), 6: day(6) },
      featured: list('featured'),
    },
    rowAt,
    errors,
  };
}

/**
 * What the grid would save, as a string: equal for two grids exactly when saving either writes
 * the same week. Blank rows, untrimmed text and how a price is spelled do not count.
 */
export function fingerprint(grid: Grid): string {
  const price = (text: string) => {
    const parsed = parsePrice(text, true);
    return parsed.ok ? parsed.value : text;
  };
  return JSON.stringify(
    listsOf(grid).map(([path, rows]) => [
      path,
      rows
        .filter((row) => !isBlank(row))
        .map((row) => [
          row.id ?? null,
          row.name.trim(),
          row.description.trim(),
          price(row.priceWeekday),
          price(row.priceWeekend),
          row.variations,
          row.allergens,
          row.soupIncluded,
          row.requiresSide,
        ]),
    ]),
  );
}

/**
 * The API's validation `fields` (`days.1.mains.0.priceWeekday` → `negative`) by row, using the
 * `rowAt` of the draft that was sent. A path that names no row, or no field of one, is returned
 * in `unplaced`.
 */
export function placeErrors(
  fields: Readonly<Record<string, string>>,
  rowAt: ReadonlyMap<string, string>,
): { errors: RowErrors; unplaced: Record<string, string> } {
  const errors: RowErrors = {};
  const unplaced: Record<string, string> = {};
  for (const [path, code] of Object.entries(fields)) {
    const match = /^((?:days\.[1-6]\.(?:soups|mains)|featured)\.\d+)\.(\w+)$/.exec(path);
    const key = match?.[1] === undefined ? undefined : rowAt.get(match[1]);
    const field = match?.[2] as RowField | undefined;
    if (key === undefined || field === undefined || !rowFields.has(field)) {
      unplaced[path] = code;
      continue;
    }
    errors[key] = { ...errors[key], [field]: code };
  }
  return { errors, unplaced };
}

const rowFields = new Set<string>([
  'id',
  'name',
  'description',
  'priceWeekday',
  'priceWeekend',
  'variations',
  'allergens',
  'soupIncluded',
  'requiresSide',
] satisfies RowField[]);

/** The days of a stored week without a main course. Publishing warns about them. */
export function daysWithoutMains(week: WeekDraft): MenuDay[] {
  return menuDays.filter((day) => week.days[day].mains.length === 0);
}

// ---- Weeks ----

/** `2026-W42`, the format of `GET /api/menu?week=`. */
export function formatWeek({ isoYear, isoWeek }: IsoWeek): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/** A week written as `formatWeek` writes it, or null. */
export function parseWeek(value: string | null): IsoWeek | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value ?? '');
  const isoYear = Number(match?.[1]);
  const isoWeek = Number(match?.[2]);
  return match && isIsoWeek(isoYear, isoWeek) ? { isoYear, isoWeek } : null;
}

/** Monday … Saturday of the week as `YYYY-MM-DD`. */
export function weekDates({ isoYear, isoWeek }: IsoWeek): Record<MenuDay, string> {
  // Only calendar fields are read, so any fixed zone gives the same dates.
  const week = datesOfIsoWeek(isoYear, isoWeek, 'UTC');
  return {
    1: isoDate(week[0]),
    2: isoDate(week[1]),
    3: isoDate(week[2]),
    4: isoDate(week[3]),
    5: isoDate(week[4]),
    6: isoDate(week[5]),
  };
}

/** The ISO week of a `YYYY-MM-DD` date. */
export function weekOfDate(date: string): IsoWeek {
  return isoWeekOf(parseIsoDate(date, 'UTC'));
}

/** The week `weeks` weeks after (or before, when negative) `week`. */
export function shiftWeek(week: IsoWeek, weeks: number): IsoWeek {
  const [monday] = datesOfIsoWeek(week.isoYear, week.isoWeek, 'UTC');
  return isoWeekOf(addDays<TZDate>(monday, weeks * 7));
}
