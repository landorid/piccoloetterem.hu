import { weekdayNamesHu } from '../../config/labels.hu';
import type { MenuDay } from '../types';

/*
 * Every Hungarian word the card reader recognises, in one place: if the restaurant rewords its
 * card, this is the file that changes. Input vocabulary, not output text; the admin's messages
 * about a card live in its strings.ts.
 *
 * Matching is on `fold`ed text, so `Hétfő`, `HETFO` and `hétfő ` are one word.
 */

/** Lowercase, accents and other marks removed, whitespace collapsed. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A header cell naming Monday … Saturday, as core names the days. */
export const dayByHeader: ReadonlyMap<string, MenuDay> = new Map(
  ([1, 2, 3, 4, 5, 6] as const).map((day) => [fold(weekdayNamesHu[day]), day]),
);

/** The header cell of the prices column. */
export const pricesHeader = fold('Áraink');

/**
 * What a full-width heading row below the day table opens: the featured dishes (`Kiemelt
 * ajánlatunk …`), the permanent menu (`Egész héten rendelhető ételek …`, which ends the week's
 * part of the card), or something else.
 */
export function headingKind(text: string): 'featured' | 'permanent' | 'other' {
  const folded = fold(text);
  if (folded.startsWith('kiemelt')) {
    return 'featured';
  }
  return folded.startsWith('egesz heten') ? 'permanent' : 'other';
}

/**
 * `Nem tartalmaz levest!`, `levest nem tartalmaz`, `leves nélkül`: the price does not include a
 * soup. It takes the soup word: the soup rows' `a menü ára tartalmaz` says the opposite, and a dish
 * that `nem tartalmaz glutént` still comes with its soup.
 */
const noSoup = /nem tartalmaz\w* leves\w*|leves\w* (?:nem(?: tartalmaz\w*)?|nelkul)/;

export function saysNoSoup(text: string): boolean {
  return noSoup.test(fold(text));
}

/** `text` folded, without its no-soup phrase. */
export function withoutNoSoup(text: string): string {
  return fold(text).replace(noSoup, '');
}

/** The card's week above the table, `06.15.–06.20.` (month.day, no year), any dash. */
export const dateRange = /(\d{1,2})\.\s*(\d{1,2})\.\s*[-–—]\s*(\d{1,2})\.\s*(\d{1,2})\./;

/**
 * A line that starts a dish's description rather than continuing its name: it opens with `/`, or
 * its last word is a "with …" or "on a bed of …" form (`rizzsel`, `kolbásszal`, `tésztaágyon`).
 */
export function startsDescription(line: string): boolean {
  const folded = fold(line);
  return folded.startsWith('/') || /(?:al|el|agyon)\W*$/.test(folded);
}

/** A one-word line that reads as an adjective (`petrezselymes`, `vaníliás`). */
export function isAdjectiveLine(line: string): boolean {
  return !line.includes(' ') && fold(line).endsWith('s');
}
