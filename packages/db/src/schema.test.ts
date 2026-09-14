import { permanentCategories, slots, weeklyCategories } from '@piccolo/core';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  categoryEnum,
  closedDates,
  createDb,
  customers,
  menuItems,
  menuSchedule,
  menuWeeks,
  orderExtras,
  orderItems,
  orderMenus,
  orders,
  sql,
} from './index';

const nullableColumns = (table: PgTable) =>
  getTableConfig(table)
    .columns.filter((column) => !column.notNull)
    .map((column) => column.name);

describe('enums', () => {
  it('take their categories and slots from packages/core', () => {
    expect(categoryEnum.enumValues).toEqual([...weeklyCategories, ...permanentCategories]);
    expect(orderItems.slot.enumValues).toEqual([...slots]);
  });
});

describe('nullability', () => {
  it('leaves only the columns that can be absent nullable', () => {
    expect(nullableColumns(customers)).toEqual([]);
    expect(nullableColumns(menuItems)).toEqual(['description', 'price_weekend']);
    expect(nullableColumns(menuWeeks)).toEqual(['published_at']);
    expect(nullableColumns(menuSchedule)).toEqual(['day']);
    expect(nullableColumns(orders)).toEqual(['note', 'processed_at', 'cancelled_at']);
    expect(nullableColumns(orderMenus)).toEqual([]);
    expect(nullableColumns(orderItems)).toEqual(['menu_item_id', 'variation']);
    expect(nullableColumns(orderExtras)).toEqual([]);
    expect(nullableColumns(closedDates)).toEqual([]);
  });
});

describe('createDb', () => {
  it('opens a pool of one connection, lazily', async () => {
    const db = createDb('postgres://user:secret@localhost:1/none');
    expect(db.$client.options.max).toBe(1);
    expect(db.$client.totalCount).toBe(0);
    await db.$client.end();
  });

  // Runs only when DATABASE_URL is set in the shell, e.g. against a Neon branch or a local
  // container. Read-only.
  describe.skipIf(!process.env.DATABASE_URL)('against DATABASE_URL', () => {
    it('queries the migrated schema', async () => {
      const db = createDb(process.env.DATABASE_URL ?? '');
      try {
        const { rows } = await db.execute<{ ok: number }>(sql`select 1 as ok`);
        expect(rows).toEqual([{ ok: 1 }]);
        await expect(db.select().from(closedDates).limit(1)).resolves.toBeInstanceOf(Array);
      } finally {
        await db.$client.end();
      }
    });
  });
});
