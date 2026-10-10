import { isAdjectiveLine, startsDescription } from './vocabulary.hu';

/*
 * One dish's text on the card, a day cell's lines or one featured paragraph, as the parts of a
 * menu item. Pure string work that never throws. Splitting a name from its description is a
 * heuristic (dish.test.ts pins its known misses), but it is lossless: every word of the cell ends
 * up in the name, the description or a variation, unless it is an allergen number, a price or a
 * dash run.
 */

/** A dish as the card words it, before read.ts places and prices it. */
export interface DishText {
  /** Non-empty, without a trailing comma. */
  name: string;
  /** Verbatim, slashes and parentheses kept; `null` when the card has none. */
  description: string | null;
  /** `[]`, or `[topping, alternative]` for a dashed alternative line. */
  variations: readonly string[];
  /** The allergen numbers as listed; `null` when the card lists none. */
  allergenNumbers: readonly number[] | null;
  /** The cell's own price line (a Saturday dish's price); `null` without one. */
  price: number | null;
}

/** A line of allergen numbers only: `1`, `1,3,7`. */
const allergenLine = /^\d{1,2}(?:\s*,\s*\d{1,2})*$/;
/** Allergen numbers ending a line of text: `…rizzsel 1,3,7`, `…csirkemell1,3,7`, `…sajttal/ 1,3,7`. */
const allergenTail = /^(.*[^\d\s,])\s*(\d{1,2}(?:\s*,\s*\d{1,2})*)$/;
/** A line that is only a price: `3050 Ft`, `2 590 Ft`. */
const priceLine = /^\d[\d .]*\s*Ft$/i;
/** `-----szója fasírttal`: an alternative to the line above it. */
const dashLine = /^-{3,}\s*(?=\S)/;
/** An amount in forints: `2200 Ft`, `2850Ft`, `12 990 Ft`, `12.990 Ft`. */
const amount = /(\d{1,3}(?:[ .]\d{3})+|\d+)\s*Ft\b/gi;

/** Every amount in forints in `text`, in order: `3190 Ft 3290 Ft` → `[3190, 3290]`. */
export function readPrices(text: string): number[] {
  return [...text.matchAll(amount)].map((match) => Number(match[1]?.replace(/[ .]/g, '')));
}

/**
 * A day cell's lines as a dish, or `null` when the cell is not one. A dish ends in an allergen
 * line (or allergen numbers ending its last line), a price line, or both; `Zárva`, `Pünkösd`,
 * `05.26.` / `Kedd` and a greeting end in neither.
 */
export function readDayCell(lines: readonly string[]): DishText | null {
  const last = lines.at(-1) ?? '';
  const price = priceLine.test(last) ? Number(last.replace(/\D/g, '')) : null;
  const { text, allergenNumbers } = takeAllergens(price === null ? lines : lines.slice(0, -1));
  if (allergenNumbers === null && price === null) {
    return null;
  }
  const dish = splitDish(text);
  return dish.name === '' ? null : { ...dish, allergenNumbers, price };
}

/** A featured paragraph, `Name /details/ more details 1,3,7`, as a dish. */
export function readFeaturedLine(line: string): DishText {
  const { text, allergenNumbers } = takeAllergens([line]);
  return { ...splitDish(text), allergenNumbers, price: null };
}

/** `lines` without the allergen numbers that end them, and those numbers. */
function takeAllergens(lines: readonly string[]): {
  text: readonly string[];
  allergenNumbers: readonly number[] | null;
} {
  const last = lines.at(-1) ?? '';
  if (allergenLine.test(last)) {
    return { text: lines.slice(0, -1), allergenNumbers: numbersOf(last) };
  }
  const [, rest, tail] = allergenTail.exec(last) ?? [];
  const numbers = numbersOf(tail ?? '');
  // Inline numbers outside the legend are text: `Nyitás December 29` is no dish.
  if (rest === undefined || !numbers.every((n) => n >= 1 && n <= 14)) {
    return { text: lines, allergenNumbers: null };
  }
  return { text: [...lines.slice(0, -1), rest], allergenNumbers: numbers };
}

function numbersOf(text: string): number[] {
  return text.match(/\d+/g)?.map(Number) ?? [];
}

function nameOf(lines: readonly string[]): string {
  return lines.join(' ').replace(/[\s,]+$/, '');
}

/** The lines left once the numbers are taken, as name, description and variations. */
function splitDish(
  lines: readonly string[],
): Pick<DishText, 'name' | 'description' | 'variations'> {
  const dash = lines.findIndex((line) => dashLine.test(line));
  if (dash < 1) {
    return { ...splitName(lines), variations: [] };
  }
  const alternative = [lines[dash]?.replace(dashLine, ''), ...lines.slice(dash + 1)].join(' ');
  // With no topping line between the name and the alternative, there is nothing to choose from.
  if (dash === 1) {
    return { name: nameOf(lines.slice(0, 1)), description: alternative, variations: [] };
  }
  // Dávid, 2026-10-10: the topping line and its alternative are the dish's two variations.
  return {
    name: nameOf(lines.slice(0, dash - 1)),
    description: null,
    variations: [...new Set([lines[dash - 1] ?? '', alternative])],
  };
}

/**
 * One line (row c, a featured paragraph) splits at its first `/` or `(`. Several lines: the
 * description starts at the first line after the first that `startsDescription`; a lone
 * adjective line just before it joins it (`petrezselymes` / `burgonyával`), unless the line before
 * that is one too (`Barackos` / `máglyarakás` / `fahéjas porcukorral`). No such line: all name.
 */
function splitName(lines: readonly string[]): { name: string; description: string | null } {
  const [only] = lines;
  if (lines.length === 1 && only !== undefined) {
    const at = only.search(/[/(]/);
    return at > 0
      ? { name: nameOf([only.slice(0, at)]), description: only.slice(at) }
      : { name: nameOf(lines), description: null };
  }
  let start = lines.findIndex((line, i) => i > 0 && startsDescription(line));
  if (start === -1) {
    return { name: nameOf(lines), description: null };
  }
  const before = (n: number) => lines[start - n] ?? '';
  if (start >= 2 && isAdjectiveLine(before(1)) && !isAdjectiveLine(before(2))) {
    start -= 1;
  }
  return { name: nameOf(lines.slice(0, start)), description: lines.slice(start).join(' ') };
}
