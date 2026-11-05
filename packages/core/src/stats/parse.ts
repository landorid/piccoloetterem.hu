import { slots } from '../menu/types';
import { isIsoDay } from './date';
import { customerRef, dishKey } from './keys';
import type { LegacyStatsFile } from './types';

/**
 * A legacy stats file that does not have the expected shape. The message names the first bad
 * path and what was expected there, never the value: the file holds personal data.
 */
export class LegacyStatsFileError extends Error {
  override readonly name = 'LegacyStatsFileError';

  constructor(
    readonly path: string,
    readonly expected: string,
  ) {
    super(`Invalid legacy stats file at ${path}: expected ${expected}`);
  }
}

type Json = Record<string, unknown>;

/** Checks `json` against `LegacyStatsFile` and returns it typed. Throws `LegacyStatsFileError`. */
export function parseLegacyStatsFile(json: unknown): LegacyStatsFile {
  const file = object(json, '$');
  if (file.formatVersion !== 1) {
    fail('$.formatVersion', 'format version 1');
  }
  const generatedAt = string(file.generatedAt, '$.generatedAt');
  if (Number.isNaN(Date.parse(generatedAt))) {
    fail('$.generatedAt', 'an ISO 8601 timestamp');
  }
  const span = object(file.span, '$.span');
  const from = date(span.from, '$.span.from');
  if (date(span.to, '$.span.to') < from) {
    fail('$.span.to', 'a date not before span.from');
  }
  each(file.closedDays, '$.closedDays', date);
  each(file.daily, '$.daily', dailyTotals);
  each(file.dishes, '$.dishes', dishDay);
  each(file.monthlyActive, '$.monthlyActive', (value, path) => {
    const row = object(value, path);
    month(row.month, `${path}.month`);
    count(row.customers, `${path}.customers`);
  });
  each(file.customers, '$.customers', customerHistory);
  return json as LegacyStatsFile;
}

function dailyTotals(value: unknown, path: string): void {
  const row = object(value, path);
  date(row.date, `${path}.date`);
  for (const field of [
    'orderDays',
    'revenue',
    'menus',
    'groupOrderDays',
    'mains',
    'mainsWithSoup',
    'mainsWithSide',
    'mainsWithDessert',
  ]) {
    count(row[field], `${path}.${field}`);
  }
}

function dishDay(value: unknown, path: string): void {
  const row = object(value, path);
  dish(row, path);
  if (!(slots as readonly unknown[]).includes(row.slot)) {
    fail(`${path}.slot`, `one of ${slots.join(', ')}`);
  }
  date(row.date, `${path}.date`);
  count(row.portions, `${path}.portions`);
  // Variation names are file content, so a bad entry is reported at the record, not by its name.
  for (const [key, portions] of Object.entries(object(row.variations, `${path}.variations`))) {
    if (key === '') {
      fail(`${path}.variations`, 'non-empty variation names');
    }
    count(portions, `${path}.variations`);
  }
}

function customerHistory(value: unknown, path: string): void {
  const row = object(value, path);
  const emailKey = string(row.emailKey, `${path}.emailKey`);
  if (row.ref !== customerRef(emailKey)) {
    fail(`${path}.ref`, 'customerRef(emailKey)');
  }
  string(row.name, `${path}.name`);
  string(row.email, `${path}.email`);
  nullableString(row.phone, `${path}.phone`);
  nullableString(row.address, `${path}.address`);
  let previous = '';
  each(row.orderDates, `${path}.orderDates`, (value, datePath) => {
    const day = date(value, datePath);
    if (day <= previous) {
      fail(datePath, 'dates in strictly ascending order');
    }
    previous = day;
  });
  const spend = object(row.monthlySpend, `${path}.monthlySpend`);
  for (const [key, amount] of Object.entries(spend)) {
    if (!isMonth(key)) {
      fail(`${path}.monthlySpend`, 'YYYY-MM keys');
    }
    count(amount, `${path}.monthlySpend.${key}`);
  }
  if (array(row.weekdayCounts, `${path}.weekdayCounts`).length !== 6) {
    fail(`${path}.weekdayCounts`, '6 counts, Monday … Saturday');
  }
  each(row.weekdayCounts, `${path}.weekdayCounts`, count);
  count(row.menus, `${path}.menus`);
  count(row.groupOrderDays, `${path}.groupOrderDays`);
  each(
    row.topDishes,
    `${path}.topDishes`,
    (value, dishPath) => {
      const top = object(value, dishPath);
      dish(top, dishPath);
      count(top.count, `${dishPath}.count`);
    },
    10,
  );
  each(
    row.lastOrders,
    `${path}.lastOrders`,
    (value, orderPath) => {
      const order = object(value, orderPath);
      date(order.date, `${orderPath}.date`);
      string(order.items, `${orderPath}.items`);
      count(order.menus, `${orderPath}.menus`);
      count(order.total, `${orderPath}.total`);
    },
    10,
  );
}

/** `dishKey` and `name`, where the key must be the name's key. */
function dish(row: Json, path: string): void {
  const key = string(row.dishKey, `${path}.dishKey`);
  if (key === '' || dishKey(string(row.name, `${path}.name`)) !== key) {
    fail(`${path}.dishKey`, 'dishKey(name), not empty');
  }
}

function object(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'an object');
  }
  return value as Json;
}

/** Checks every entry of the array at `path` with `check`, at `path[i]`. */
function each(
  value: unknown,
  path: string,
  check: (entry: unknown, path: string) => unknown,
  max?: number,
): void {
  array(value, path, max).forEach((entry, i) => {
    check(entry, `${path}[${i}]`);
  });
}

function array(value: unknown, path: string, max = Number.POSITIVE_INFINITY): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'an array');
  }
  if (value.length > max) {
    fail(path, `at most ${max} entries`);
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'a string');
  }
  return value;
}

function nullableString(value: unknown, path: string): void {
  if (value !== null && typeof value !== 'string') {
    fail(path, 'a string or null');
  }
}

function count(value: unknown, path: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(path, 'a non-negative integer');
  }
}

function date(value: unknown, path: string): string {
  if (typeof value !== 'string' || !isIsoDay(value)) {
    fail(path, 'a YYYY-MM-DD date');
  }
  return value;
}

function month(value: unknown, path: string): void {
  if (typeof value !== 'string' || !isMonth(value)) {
    fail(path, 'a YYYY-MM month');
  }
}

function isMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && isIsoDay(`${value}-01`);
}

function fail(path: string, expected: string): never {
  throw new LegacyStatsFileError(path, expected);
}
