import { datesOfIsoWeek } from '../../calendar';
import { type AllergenCode, allergenCodes } from '../../config/types';
import type { MenuItemContent } from '../edit';
import type { MenuDay } from '../types';
import {
  type DishText,
  isLegendNumber,
  readDayCell,
  readFeaturedLine,
  readPrices,
  withoutPrices,
} from './dish';
import { type Cell, type DocxFailure, type Row, readDocx, type Table } from './docx';
import {
  dateRange,
  dayByHeader,
  fold,
  headingKind,
  pricesHeader,
  saysNoSoup,
  withoutNoSoup,
} from './vocabulary.hu';

/*
 * The restaurant's weekly Word menu card read into a week of new items, and everything on the
 * card that did not become one. The card is one table: a header naming the days and the prices
 * column (`Áraink`), the day rows (soups, then mains priced per row), then full-width headings,
 * of which the featured dishes are read and the permanent menu ends the week's part.
 */

export interface IsoWeekRef {
  isoYear: number;
  isoWeek: number;
}

/** A week as the card gives it: every item new (no `id`), each list in card order. */
export interface ImportedWeek {
  days: Readonly<
    Record<MenuDay, { soups: readonly MenuItemContent[]; mains: readonly MenuItemContent[] }>
  >;
  featured: readonly MenuItemContent[];
}

/** A calendar day without a year, as the card prints it (`06.15.`). */
export interface MonthDay {
  month: number;
  day: number;
}

export interface DateRange {
  from: MonthDay;
  to: MonthDay;
}

/** Where on the card something sat: a day row's cell, by the row's label and the days it covers. */
export type CardPlace =
  | { part: 'daily'; row: string; days: readonly MenuDay[] }
  /** 1-based, in card order. */
  | { part: 'featured'; position: number };

/** Something staff should know about the card: what was left out, guessed, or not checked. */
export type ImportFinding =
  /** The card's first day is not the Monday of the week being edited. */
  | { kind: 'week_mismatch'; card: DateRange; week: DateRange }
  /** The card prints no `MM.DD.–MM.DD.`, so its week could not be checked. */
  | { kind: 'week_unverified' }
  /**
   * None of the day's own cells is a dish (`Zárva`, `Pünkösd`): nothing is imported for the day,
   * not even the dishes of cells it shares with other days (`withheld`).
   */
  | {
      kind: 'day_without_dishes';
      day: MenuDay;
      texts: readonly string[];
      withheld: readonly string[];
    }
  /**
   * Text that is not a dish: a day-row cell on an open day or shared by several days, or a
   * featured line with no name.
   */
  | { kind: 'cell_skipped'; where: CardPlace; text: string }
  /** The prices column of a mains row says more than the price and "no soup". */
  | { kind: 'price_note_ignored'; row: string; text: string }
  /** A main with no price on the card: left out rather than given an invented one. */
  | { kind: 'price_missing'; where: CardPlace; name: string }
  /** A Saturday main without its own price line: imported with the row's price only. */
  | { kind: 'weekend_price_missing'; where: CardPlace; name: string }
  /** A dish listed without allergen numbers: imported with none, which may be wrong. */
  | { kind: 'allergens_missing'; where: CardPlace; name: string }
  /** Numbers outside the card's legend (1–14), left out of the dish's allergens. */
  | { kind: 'allergen_unknown'; where: CardPlace; name: string; numbers: readonly number[] }
  /** The featured dishes and their price lines do not pair up: none of them is imported. */
  | { kind: 'featured_unpaired'; dishes: readonly string[]; prices: number }
  /** A full-width heading the reader does not know, and the rows under it. */
  | { kind: 'section_skipped'; title: string };

export type ImportFailure =
  | DocxFailure
  /** A .docx without a table whose header names Monday to Saturday and `Áraink`. */
  | 'no_menu_table'
  /** The table holds no dish at all. */
  | 'nothing_found';

export type CardImportResult =
  | { ok: true; draft: ImportedWeek; findings: readonly ImportFinding[] }
  | { ok: false; reason: ImportFailure };

/**
 * Reads the weekly menu card in `file` as the week `week`. Pure and deterministic; a file it
 * cannot read is a failure result, not an exception. Every item passes `validateMenuItem` in the
 * category of its list. Findings come in card order: the week check, days without dishes, the day
 * rows, the featured dishes.
 */
export function readMenuCard(file: Uint8Array, week: IsoWeekRef): CardImportResult {
  const docx = readDocx(file);
  if (!docx.ok) {
    return docx;
  }
  const table = findDayTable(docx.body.tables);
  if (!table) {
    return { ok: false, reason: 'no_menu_table' };
  }
  const daily = readDays(table);
  const featured = readFeatured(table.below, table.width);
  const count = menuDays.reduce(
    (sum, day) => sum + daily.days[day].soups.length + daily.days[day].mains.length,
    featured.items.length,
  );
  if (count === 0) {
    return { ok: false, reason: 'nothing_found' };
  }
  return {
    ok: true,
    draft: { days: daily.days, featured: featured.items },
    findings: [...checkWeek(docx.body.outsideText, week), ...daily.findings, ...featured.findings],
  };
}

const menuDays = [1, 2, 3, 4, 5, 6] as const satisfies readonly MenuDay[];

interface DayTable {
  /** Grid column → the day whose header covers it. Szerda and Péntek cover two columns each. */
  dayAt: ReadonlyMap<number, MenuDay>;
  pricesColumn: number;
  /** Grid columns in all: the span of a full-width row. */
  width: number;
  /** The rows between the header and the first full-width row. */
  dayRows: readonly Row[];
  /** The rows from that full-width row on. */
  below: readonly Row[];
}

const textOf = (cell: Cell | undefined) => cell?.lines.join(' ') ?? '';
const isFullWidth = (row: Row, width: number) => row.length === 1 && (row[0]?.span ?? 0) >= width;
const unique = <T>(values: readonly T[]) => [...new Set(values)];

function findDayTable(tables: readonly Table[]): DayTable | null {
  for (const table of tables) {
    const header = table.findIndex((row) => {
      const names = new Set(row.map((cell) => fold(textOf(cell))));
      return names.has(pricesHeader) && [...dayByHeader.keys()].every((day) => names.has(day));
    });
    const headerRow = table[header];
    if (!headerRow) {
      continue;
    }
    const dayAt = new Map<number, MenuDay>();
    let pricesColumn = -1;
    for (const cell of headerRow) {
      const name = fold(textOf(cell));
      const day = dayByHeader.get(name);
      for (let column = cell.column; day && column < cell.column + cell.span; column += 1) {
        dayAt.set(column, day);
      }
      pricesColumn = name === pricesHeader ? cell.column : pricesColumn;
    }
    const width = Math.max(...headerRow.map((cell) => cell.column + cell.span));
    const rest = table.slice(header + 1);
    const end = rest.findIndex((row) => isFullWidth(row, width));
    return {
      dayAt,
      pricesColumn,
      width,
      dayRows: end === -1 ? rest : rest.slice(0, end),
      below: end === -1 ? [] : rest.slice(end),
    };
  }
  return null;
}

/** A day row's cell that covers at least one day and holds text. */
interface DayCell {
  /** Ascending. One for a cell of the day's own; Monday to Friday for row c's. */
  days: readonly MenuDay[];
  text: string;
  dish: DishText | null;
}

function daysOf(cell: Cell, dayAt: ReadonlyMap<number, MenuDay>): MenuDay[] {
  const days = new Set<MenuDay>();
  for (let column = cell.column; column < cell.column + cell.span; column += 1) {
    const day = dayAt.get(column);
    if (day) {
      days.add(day);
    }
  }
  return [...days].sort((a, b) => a - b);
}

/** The words of a dish, without punctuation: equal for two wrappings of the same text. */
const wordsOf = (dish: DishText) =>
  fold([dish.name, dish.description, ...dish.variations].join(' '))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function readCopiesAsShared(cells: readonly DayCell[]): DayCell[] {
  const shared = cells.flatMap((cell) => (cell.dish && cell.days.length > 1 ? [cell.dish] : []));
  return cells.map((cell) => {
    const { dish } = cell;
    if (!dish || cell.days.length !== 1) {
      return cell;
    }
    const original = shared.find((other) => wordsOf(other) === wordsOf(dish));
    return original ? { ...cell, dish: { ...original, price: dish.price } } : cell;
  });
}

function readDayRows({ dayAt, pricesColumn, dayRows }: DayTable) {
  let pricedYet = false;
  return dayRows.map((row, index) => {
    const priceText = textOf(row.find((cell) => cell.column === pricesColumn));
    const price = readPrices(priceText)[0] ?? null;
    pricedYet ||= price !== null;
    const cells = row.flatMap((cell): DayCell[] => {
      const days = daysOf(cell, dayAt);
      return days.length > 0 && cell.lines.length > 0
        ? [{ days, text: textOf(cell), dish: readDayCell(cell.lines) }]
        : [];
    });
    return {
      label: textOf(row.find((cell) => cell.column === 0)) || String(index + 1),
      list: pricedYet ? ('mains' as const) : ('soups' as const),
      price,
      priceText,
      cells: readCopiesAsShared(cells),
    };
  });
}

/**
 * The day rows' dishes on the days they cover. A day is open when a cell of its own is a dish;
 * a cell shared by several days (row c) gives its dish to the open ones only.
 */
function readDays(table: DayTable) {
  const rows = readDayRows(table);
  const all = rows.flatMap((row) => row.cells);
  const open = new Set(
    all.flatMap((cell) => (cell.dish && cell.days.length === 1 ? cell.days : [])),
  );
  const findings: ImportFinding[] = menuDays
    .filter((day) => !open.has(day))
    .map((day) => {
      const covering = all.filter((cell) => cell.days.includes(day));
      return {
        kind: 'day_without_dishes',
        day,
        texts: unique(covering.filter((cell) => cell.days.length === 1).map((cell) => cell.text)),
        withheld: unique(
          covering.flatMap((cell) => (cell.dish && cell.days.length > 1 ? [cell.dish.name] : [])),
        ),
      };
    });

  const lists = () => ({ soups: [] as MenuItemContent[], mains: [] as MenuItemContent[] });
  const days = { 1: lists(), 2: lists(), 3: lists(), 4: lists(), 5: lists(), 6: lists() };
  for (const row of rows) {
    if (row.list === 'mains' && /\p{L}/u.test(withoutPrices(withoutNoSoup(row.priceText)))) {
      findings.push({ kind: 'price_note_ignored', row: row.label, text: row.priceText });
    }
    for (const { days: covered, text, dish } of row.cells) {
      const placed = covered.filter((day) => open.has(day));
      const where = { part: 'daily', row: row.label, days: placed } as const;
      if (!dish) {
        const listedUnderClosedDay = covered.length === 1 && placed.length === 0;
        if (!listedUnderClosedDay) {
          findings.push({
            kind: 'cell_skipped',
            where: { ...where, days: placed.length > 0 ? placed : covered },
            text,
          });
        }
        continue;
      }
      if (placed.length === 0) {
        continue;
      }
      const { allergens, unknown } = allergensOf(dish.allergenNumbers);
      const soupIncluded = !saysNoSoup(row.priceText) && !saysNoSoup(text);
      const unpriced: MenuDay[] = [];
      for (const day of placed) {
        if (row.list === 'soups') {
          days[day].soups.push(itemOf(dish, allergens, 0, null, false));
          continue;
        }
        const { weekday, weekend } = mainPricesOn(day, row.price, dish.price);
        if (weekday === null) {
          unpriced.push(day);
        } else {
          days[day].mains.push(itemOf(dish, allergens, weekday, weekend, soupIncluded));
        }
      }
      const name = dish.name;
      if (unpriced.length > 0) {
        findings.push({ kind: 'price_missing', where: { ...where, days: unpriced }, name });
      }
      if (row.list === 'mains' && placed.includes(6) && row.price !== null && dish.price === null) {
        findings.push({ kind: 'weekend_price_missing', where: { ...where, days: [6] }, name });
      }
      if (unpriced.length < placed.length) {
        findings.push(...allergenFindings(dish, where, unknown));
      }
    }
  }
  return { days, findings };
}

function mainPricesOn(day: MenuDay, rowPrice: number | null, cellPrice: number | null) {
  return day === 6 && rowPrice !== null && cellPrice !== null
    ? { weekday: rowPrice, weekend: cellPrice }
    : { weekday: cellPrice ?? rowPrice, weekend: null };
}

/** The featured dishes under the `Kiemelt ajánlatunk` heading; the permanent menu ends them. */
function readFeatured(rows: readonly Row[], width: number) {
  const items: MenuItemContent[] = [];
  const findings: ImportFinding[] = [];
  let featured = false;
  let position = 0;
  for (const row of rows) {
    if (isFullWidth(row, width)) {
      const title = textOf(row[0]);
      const kind = headingKind(title);
      if (kind === 'permanent') {
        break;
      }
      if (kind === 'other' && title !== '') {
        findings.push({ kind: 'section_skipped', title });
      }
      featured = kind === 'featured' || (featured && title === '');
      continue;
    }
    if (!featured) {
      continue;
    }
    const lines = row[0]?.lines ?? [];
    const priceLines = row.length > 1 ? (row.at(-1)?.lines ?? []) : [];
    const prices = priceLines.filter((line) => readPrices(line).length > 0);
    if (lines.length !== prices.length) {
      findings.push({
        kind: 'featured_unpaired',
        dishes: lines.map((line) => readFeaturedLine(line).name),
        prices: prices.length,
      });
      position += lines.length;
      continue;
    }
    for (const [i, line] of lines.entries()) {
      position += 1;
      const dish = readFeaturedLine(line);
      const priceLine = prices[i] ?? '';
      const where = { part: 'featured', position } as const;
      if (dish.name === '') {
        findings.push({ kind: 'cell_skipped', where, text: line });
        continue;
      }
      const [weekday = 0, saturday = null] = readPrices(priceLine);
      const { allergens, unknown } = allergensOf(dish.allergenNumbers);
      const soupIncluded = !saysNoSoup(line) && !saysNoSoup(priceLine);
      const weekend = saturday === weekday ? null : saturday;
      items.push(itemOf(dish, allergens, weekday, weekend, soupIncluded));
      findings.push(...allergenFindings(dish, where, unknown));
    }
  }
  return { items, findings };
}

function itemOf(
  dish: DishText,
  allergens: readonly AllergenCode[],
  priceWeekday: number,
  priceWeekend: number | null,
  soupIncluded: boolean,
): MenuItemContent {
  return {
    name: dish.name,
    description: dish.description,
    priceWeekday,
    priceWeekend,
    variations: dish.variations,
    allergens,
    soupIncluded,
    requiresSide: false,
  };
}

/** The card's legend numbers the EU allergens in core's order: n is `allergenCodes[n - 1]`. */
function allergensOf(numbers: readonly number[] | null) {
  const listed = new Set(numbers);
  return {
    allergens: allergenCodes.filter((_, index) => listed.has(index + 1)),
    unknown: [...listed].filter((n) => !isLegendNumber(n)),
  };
}

function allergenFindings(
  { name, allergenNumbers }: DishText,
  where: CardPlace,
  unknown: readonly number[],
): ImportFinding[] {
  if (allergenNumbers === null) {
    return [{ kind: 'allergens_missing', where, name }];
  }
  return unknown.length > 0 ? [{ kind: 'allergen_unknown', where, name, numbers: unknown }] : [];
}

/** Whether the card's dates start on the Monday of `week`, as far as a year-less date can tell. */
function checkWeek(outsideText: readonly string[], week: IsoWeekRef): ImportFinding[] {
  const range = outsideText.map((line) => dateRange.exec(line)).find((match) => match !== null);
  if (!range) {
    return [{ kind: 'week_unverified' }];
  }
  const at = (group: number): MonthDay => ({
    month: Number(range[group]),
    day: Number(range[group + 1]),
  });
  const card = { from: at(1), to: at(3) };
  const dates = datesOfIsoWeek(week.isoYear, week.isoWeek, 'UTC');
  const monthDay = (date: (typeof dates)[number]): MonthDay => ({
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
  const monday = monthDay(dates[0]);
  return monday.month === card.from.month && monday.day === card.from.day
    ? []
    : [{ kind: 'week_mismatch', card, week: { from: monday, to: monthDay(dates[5]) } }];
}
