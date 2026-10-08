import {
  type Category,
  type MenuDay,
  type MenuItem,
  type MenuItemContent,
  type PermanentCategory,
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
  type SQL,
  sql,
} from '@piccolo/db';

/*
 * The admin menu queries. Thin: the rules (what a valid item, week or order is) are checked by
 * `packages/core` before anything here runs.
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

/** The next free `sort_order` in a category, so a new or moved item goes last. */
function endOf(category: Category): SQL<number> {
  return sql<number>`(select coalesce(max(${menuItems.sortOrder}) + 1, 0) from ${menuItems} where ${menuItems.category} = ${category})`;
}

const inWeek = (isoYear: number, isoWeek: number) =>
  and(eq(menuSchedule.isoYear, isoYear), eq(menuSchedule.isoWeek, isoWeek));

// ---- Items ------------------------------------------------------------------------------------

/** Permanent items, active and inactive, by `sort_order`. All permanent categories when omitted. */
export async function listPermanentItems(
  db: Db,
  category?: PermanentCategory,
): Promise<MenuItem[]> {
  const rows = await db
    .select()
    .from(menuItems)
    .where(
      category
        ? eq(menuItems.category, category)
        : inArray(menuItems.category, [...permanentCategories]),
    )
    .orderBy(asc(menuItems.category), asc(menuItems.sortOrder), asc(menuItems.id));
  return rows.map(toMenuItem);
}

export async function getMenuItem(db: Db, id: string): Promise<MenuItem | null> {
  const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id));
  return row ? toMenuItem(row) : null;
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

/** Inserts an active, not sold-out item at the end of its category. */
export async function insertPermanentItem(
  db: Db,
  category: PermanentCategory,
  content: MenuItemContent,
): Promise<MenuItem> {
  const [row] = await db
    .insert(menuItems)
    .values({
      ...contentValues(content),
      category,
      soldOut: false,
      active: true,
      sortOrder: endOf(category),
    })
    .returning();
  if (!row) {
    throw new Error('Insert returned no menu item');
  }
  return toMenuItem(row);
}

/** Overwrites an item's content, category and `active`. A new category puts it last there. */
export async function updatePermanentItem(
  db: Db,
  id: string,
  fields: MenuItemContent & { category: Category; active: boolean },
  categoryChanged: boolean,
): Promise<MenuItem | null> {
  const [row] = await db
    .update(menuItems)
    .set({
      ...contentValues(fields),
      category: fields.category,
      active: fields.active,
      ...(categoryChanged ? { sortOrder: endOf(fields.category) } : {}),
    })
    .where(eq(menuItems.id, id))
    .returning();
  return row ? toMenuItem(row) : null;
}

export async function deactivateItem(db: Db, id: string): Promise<MenuItem | null> {
  const [row] = await db
    .update(menuItems)
    .set({ active: false })
    .where(eq(menuItems.id, id))
    .returning();
  return row ? toMenuItem(row) : null;
}

export async function setSoldOut(db: Db, id: string, soldOut: boolean): Promise<MenuItem | null> {
  const [row] = await db.update(menuItems).set({ soldOut }).where(eq(menuItems.id, id)).returning();
  return row ? toMenuItem(row) : null;
}

/** Every item of every category that one of `ids` belongs to. */
export async function categoryMembers(
  db: Db,
  ids: readonly string[],
): Promise<{ id: string; category: Category }[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({ id: menuItems.id, category: menuItems.category })
    .from(menuItems)
    .where(
      inArray(
        menuItems.category,
        db
          .selectDistinct({ category: menuItems.category })
          .from(menuItems)
          .where(inArray(menuItems.id, [...ids])),
      ),
    );
}

/** Sets each item's `sort_order` to its index in `ids`, in one statement. */
export async function applyOrder(db: Db, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const position = sql.join(
    ids.map((id, index) => sql`when ${id}::uuid then ${index}::integer`),
    sql` `,
  );
  await db
    .update(menuItems)
    .set({ sortOrder: sql`case ${menuItems.id} ${position} end` })
    .where(inArray(menuItems.id, [...ids]));
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
 * Makes the week match `plan` in one transaction: creates the week as a draft if it has no row,
 * inserts new items, updates changed ones (active again), and rewrites the week's schedule.
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
