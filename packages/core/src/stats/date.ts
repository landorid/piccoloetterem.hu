import type { Weekday } from '../config/types';

/*
 * Calendar arithmetic on `YYYY-MM-DD` strings. The statistics work on calendar dates that are
 * already in the restaurant's timezone, so a day is a whole number counted from 1970-01-01 and no
 * instant, host clock or host timezone is involved.
 */

const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const msPerDay = 86_400_000;

/** Whether `iso` is a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDay(iso: string): boolean {
  const match = isoPattern.exec(iso);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Days since 1970-01-01. Throws on anything but a real `YYYY-MM-DD` date. */
export function dayNumber(iso: string): number {
  if (!isIsoDay(iso)) {
    throw new RangeError(`Not a valid ISO date (YYYY-MM-DD): "${iso}"`);
  }
  return (
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8))) / msPerDay
  );
}

/** The `YYYY-MM-DD` date of a day number. */
export function fromDayNumber(day: number): string {
  return new Date(day * msPerDay).toISOString().slice(0, 10);
}

/** ISO weekday of a day number: 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: number): Weekday {
  // 1970-01-01 was a Thursday.
  return (((((day + 3) % 7) + 7) % 7) + 1) as Weekday;
}

/** `iso` plus `days` days. */
export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

/**
 * `iso` plus `months` calendar months. The day is clamped to the target month's length, so
 * 2024-03-31 minus one month is 2024-02-29.
 */
export function addMonths(iso: string, months: number): string {
  dayNumber(iso);
  const index = Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1 + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const day = Math.min(Number(iso.slice(8)), daysInMonth(year, month));
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** The first day of the month `iso` falls in. */
export function startOfMonth(iso: string): string {
  dayNumber(iso);
  return `${iso.slice(0, 8)}01`;
}

/** The last day of the month `iso` falls in. */
export function endOfMonth(iso: string): string {
  dayNumber(iso);
  const [year, month] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7))];
  return `${iso.slice(0, 8)}${pad2(daysInMonth(year, month))}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
