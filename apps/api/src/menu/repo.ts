import {
  type MenuDay,
  type MenuItem,
  type MenuItemContent,
  type PermanentItemsPlan,
  permanentCategories,
  type WeekPlan,
} from '@piccolo/core';
import {
  and,
  asc,
  closedDates,
  type Db,
  eq,
  gte,
  inArray,
  lte,
  menuItems,
  menuSchedule,
  menuWeeks,
  notExists,
  notInArray,
  sql,
} from '@piccolo/db';

/*
 * The admin menu queries. Thin: the rules (what a valid item, week or permanent menu is) are
 * checked by `packages/core` before anything here runs.
 */

export interface IsoWeek {
  isoYear: number;
  isoWeek: number;
}

/** One week as the admin edits it: every scheduled item in full, in schedule order. */
export interface AdminWeek {
  week: IsoWeek & { publishedAt: Date | null };
  days: Record<MenuDay, { soups: MenuItem[]; mains: MenuItem[] }>;
  featured: MenuItem[];
}

type MenuItemRow = typeof menuItems.$inferSelect;

function toMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    priceWeekday: row.priceWeekday,
    priceWeekend: row.priceWeekend,
    variations: row.variations,
    allergens: row.allergens,
    soupIncluded: row.soupIncluded,
    requiresSide: row.requiresSide,
    soldOut: row.soldOut,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

function contentValues(content: MenuItemContent) {
  return {
    name: content.name,
    description: content.description,
    priceWeekday: content.priceWeekday,
    priceWeekend: content.priceWeekend,
    variations: [...content.variations],
    // `validateMenuItem` has checked every code.
    allergens: [...content.allergens] as MenuItem['allergens'][number][],
    soupIncluded: content.soupIncluded,
    requiresSide: content.requiresSide,
  };
}

const inWeek = (isoYear: number, isoWeek: number) =>
  and(eq(menuSchedule.isoYear, isoYear), eq(menuSchedule.isoWeek, isoWeek));

// ---- Items ------------------------------------------------------------------------------------

/** Every permanent item, active and inactive, by category and `sort_order`. */
export async function listPermanentItems(db: Db): Promise<MenuItem[]> {
  const rows = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.category, [...permanentCategories]))
    .orderBy(asc(menuItems.category), asc(menuItems.sortOrder), asc(menuItems.id));
  return rows.map(toMenuItem);
}

export async function getMenuItems(db: Db, ids: readonly string[]): Promise<MenuItem[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.id, [...ids]));
  return rows.map(toMenuItem);
}

/**
 * Makes the permanent menu match `plan` in one transaction, holding a lock that serialises these
 * saves: inserts new items, updates changed ones, and sets every other active permanent item
 * inactive (never deleted, so orders keep their reference). `soldOut` is left as it is.
 */
export async function writePermanentItems(db: Db, plan: PermanentItemsPlan): Promise<void> {
  await db.transaction(async (tx) => {
    // There is no row that stands for the permanent menu, so a transaction-scoped advisory lock
    // does: without it two saves in flight (a double click) would each keep their new items.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('piccolo.permanent_items'))`);

    const ids = plan.items.map((item) => item.id ?? crypto.randomUUID());
    const inserts = plan.items.flatMap((item, index) =>
      item.id === null
        ? [
            {
              ...contentValues(item.content),
              id: ids[index],
              category: item.category,
              soldOut: false,
              active: item.active,
              sortOrder: item.sortOrder,
            },
          ]
        : [],
    );
    if (inserts.length > 0) {
      await tx.insert(menuItems).values(inserts);
    }
    for (const item of plan.items) {
      if (item.id !== null && item.changed) {
        await tx
          .update(menuItems)
          .set({
            ...contentValues(item.content),
            category: item.category,
            active: item.active,
            sortOrder: item.sortOrder,
          })
          .where(eq(menuItems.id, item.id));
      }
    }

    await tx
      .update(menuItems)
      .set({ active: false })
      .where(
        and(
          inArray(menuItems.category, [...permanentCategories]),
          eq(menuItems.active, true),
          ids.length > 0 ? notInArray(menuItems.id, ids) : undefined,
        ),
      );
  });
}

export async function setSoldOut(db: Db, id: string, soldOut: boolean): Promise<MenuItem | null> {
  const [row] = await db.update(menuItems).set({ soldOut }).where(eq(menuItems.id, id)).returning();
  return row ? toMenuItem(row) : null;
}

/** The weeks any of `ids` is scheduled on. */
export async function weeksOfItems(db: Db, ids: readonly string[]): Promise<IsoWeek[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .selectDistinct({ isoYear: menuSchedule.isoYear, isoWeek: menuSchedule.isoWeek })
    .from(menuSchedule)
    .where(inArray(menuSchedule.menuItemId, [...ids]));
}

// ---- Weeks ------------------------------------------------------------------------------------

/** The week with its schedule. A week without a row is an empty draft. */
export async function readWeek(db: Db, isoYear: number, isoWeek: number): Promise<AdminWeek> {
  const [week] = await db
    .select({ publishedAt: menuWeeks.publishedAt })
    .from(menuWeeks)
    .where(and(eq(menuWeeks.isoYear, isoYear), eq(menuWeeks.isoWeek, isoWeek)));

  const result: AdminWeek = {
    week: { isoYear, isoWeek, publishedAt: week?.publishedAt ?? null },
    days: {
      1: { soups: [], mains: [] },
      2: { soups: [], mains: [] },
      3: { soups: [], mains: [] },
      4: { soups: [], mains: [] },
      5: { soups: [], mains: [] },
      6: { soups: [], mains: [] },
    },
    featured: [],
  };
  if (!week) {
    return result;
  }

  const rows = await db
    .select({ day: menuSchedule.day, item: menuItems })
    .from(menuSchedule)
    .innerJoin(menuItems, eq(menuSchedule.menuItemId, menuItems.id))
    .where(inWeek(isoYear, isoWeek))
    .orderBy(asc(menuSchedule.sortOrder), asc(menuSchedule.id));

  for (const { day, item } of rows) {
    if (day === null) {
      result.featured.push(toMenuItem(item));
      continue;
    }
    const list = result.days[day as MenuDay];
    if (!list) {
      throw new Error(`menu_schedule has day ${day} for ${isoYear}/${isoWeek}`);
    }
    (item.category === 'daily_soup' ? list.soups : list.mains).push(toMenuItem(item));
  }
  return result;
}

/**
 * Makes the week match `plan` in one transaction, holding the week's row lock: creates the week as
 * a draft if it has no row, inserts new items, updates changed ones (active again), and rewrites
 * the week's schedule.
 *
 * Items that were scheduled on the week and are not any more are detached and set inactive, never
 * deleted, so orders keep their reference. An item still scheduled on another week stays active.
 *
 * Returns the item ids in plan order.
 */
export async function writeWeek(
  db: Db,
  isoYear: number,
  isoWeek: number,
  plan: WeekPlan,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    await tx.insert(menuWeeks).values({ isoYear, isoWeek }).onConflictDoNothing();
    // Serialises writers of one week. Without it two saves in flight (a double click) would each
    // miss the schedule rows the other inserts, and the week would end up with both.
    await tx
      .select({ isoYear: menuWeeks.isoYear })
      .from(menuWeeks)
      .where(and(eq(menuWeeks.isoYear, isoYear), eq(menuWeeks.isoWeek, isoWeek)))
      .for('update');

    const previous = await tx
      .selectDistinct({ id: menuSchedule.menuItemId })
      .from(menuSchedule)
      .where(inWeek(isoYear, isoWeek));

    const ids = plan.items.map((item) => item.id ?? crypto.randomUUID());
    const inserts = plan.items.flatMap((item, index) =>
      item.id === null
        ? [
            {
              ...contentValues(item.content),
              id: ids[index],
              category: item.category,
              soldOut: false,
              active: true,
              sortOrder: 0,
            },
          ]
        : [],
    );
    if (inserts.length > 0) {
      await tx.insert(menuItems).values(inserts);
    }
    for (const item of plan.items) {
      if (item.id !== null && item.changed) {
        await tx
          .update(menuItems)
          .set({ ...contentValues(item.content), category: item.category, active: true })
          .where(eq(menuItems.id, item.id));
      }
    }

    await tx.delete(menuSchedule).where(inWeek(isoYear, isoWeek));
    if (plan.schedule.length > 0) {
      await tx.insert(menuSchedule).values(
        plan.schedule.map((entry) => ({
          isoYear,
          isoWeek,
          day: entry.day,
          menuItemId: ids[entry.item] as string,
          sortOrder: entry.sortOrder,
        })),
      );
    }

    if (previous.length > 0) {
      await tx
        .update(menuItems)
        .set({ active: false })
        .where(
          and(
            inArray(
              menuItems.id,
              previous.map((row) => row.id),
            ),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(menuSchedule)
                .where(eq(menuSchedule.menuItemId, menuItems.id)),
            ),
          ),
        );
    }

    return ids;
  });
}

/**
 * Sets `published_at` unless it is already set, and returns it: publishing twice keeps the first
 * timestamp. `null` when the week has no row.
 */
export async function publishWeek(db: Db, isoYear: number, isoWeek: number): Promise<Date | null> {
  const [row] = await db
    .update(menuWeeks)
    .set({ publishedAt: sql`coalesce(${menuWeeks.publishedAt}, now())` })
    .where(and(eq(menuWeeks.isoYear, isoYear), eq(menuWeeks.isoWeek, isoWeek)))
    .returning({ publishedAt: menuWeeks.publishedAt });
  return row?.publishedAt ?? null;
}

// ---- Closed dates -----------------------------------------------------------------------------

/** Closed dates from `from` to `to`, both included, ascending. */
export async function listClosedDates(db: Db, from: string, to: string): Promise<string[]> {
  const rows = await db
    .select({ date: closedDates.date })
    .from(closedDates)
    .where(and(gte(closedDates.date, from), lte(closedDates.date, to)))
    .orderBy(asc(closedDates.date));
  return rows.map((row) => row.date);
}

/** `true` when the date was added; `false` when it was already closed. */
export async function addClosedDate(db: Db, date: string): Promise<boolean> {
  const rows = await db
    .insert(closedDates)
    .values({ date })
    .onConflictDoNothing()
    .returning({ date: closedDates.date });
  return rows.length > 0;
}

/** `true` when the date was removed; `false` when it was not closed. */
export async function removeClosedDate(db: Db, date: string): Promise<boolean> {
  const rows = await db
    .delete(closedDates)
    .where(eq(closedDates.date, date))
    .returning({ date: closedDates.date });
  return rows.length > 0;
}
