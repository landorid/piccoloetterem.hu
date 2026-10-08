import type { Category, PermanentCategory, WeeklyCategory } from '../config/types';
import { isWeeklyCategory, type MenuItemErrorCode, validateMenuItem } from './rules';
import type { MenuDay, MenuItem, MenuItemInput } from './types';

/*
 * Staff edits to the menu: a week's items and schedule, and the order of a permanent category.
 * Pure: the caller loads the stored items and writes the result.
 */

/**
 * The fields of a menu item staff edit directly. The server owns the rest: the category (fixed by
 * where a weekly item is placed, chosen once for a permanent one), `soldOut` (its own switch),
 * `active` and `sortOrder`.
 */
export type MenuItemContent = Pick<
  MenuItemInput,
  | 'name'
  | 'description'
  | 'priceWeekday'
  | 'priceWeekend'
  | 'variations'
  | 'allergens'
  | 'soupIncluded'
  | 'requiresSide'
>;

/** A dish in a week draft. With `id` it is that stored weekly item; without, a new one. */
export interface WeekItemDraft extends MenuItemContent {
  id?: string | undefined;
}

export interface WeekDayDraft {
  soups: readonly WeekItemDraft[];
  mains: readonly WeekItemDraft[];
}

/** A whole week as staff submit it. The order of each list is the order guests see. */
export interface WeekDraft {
  days: Readonly<Record<MenuDay, WeekDayDraft>>;
  featured: readonly WeekItemDraft[];
}

export interface PlannedItem {
  /** `null`: a new item to insert. */
  id: string | null;
  /** Fixed by the list the item was placed in. */
  category: WeeklyCategory;
  content: MenuItemContent;
  /**
   * Whether the item must be written: always for a new one; for a stored one when its content
   * or category differs, or when it is inactive (placing an item on a week reactivates it).
   */
  changed: boolean;
}

export interface PlannedScheduleEntry {
  /** Index into `WeekPlan.items`. */
  item: number;
  /** `null` for featured items. */
  day: MenuDay | null;
  /** Position within its list (that day's soups, that day's mains, or featured). */
  sortOrder: number;
}

/** What to write so the week matches the draft. Items are listed once, in first-seen order. */
export interface WeekPlan {
  items: readonly PlannedItem[];
  schedule: readonly PlannedScheduleEntry[];
}

export type WeekDraftErrorCode =
  | MenuItemErrorCode
  /** The `id` is not a stored item. */
  | 'unknown_item'
  /** The `id` is a permanent item; those are not scheduled. */
  | 'not_weekly'
  /** The item is already in this list. */
  | 'duplicate'
  /** The item appears elsewhere in the draft in another list kind, or with different content. */
  | 'conflict';

/** Field path (`days.1.soups.0.name`, `featured.2.id`) → the first rule it breaks. */
export type WeekDraftErrors = Record<string, WeekDraftErrorCode>;

export type WeekPlanResult = { ok: true; plan: WeekPlan } | { ok: false; fields: WeekDraftErrors };

const menuDays: readonly MenuDay[] = [1, 2, 3, 4, 5, 6];

/**
 * Checks a week draft and works out what to write. A list fixes its items' category: soups are
 * `daily_soup`, mains `daily_main`, featured `featured`. Every item must pass `validateMenuItem`
 * in that category. An `id` must be a stored weekly item (`stored` holds every item the draft
 * references); the same `id` may appear in several lists of one kind, with identical content,
 * but only once per list.
 *
 * Items that were scheduled on the week and are missing from the draft are the caller's to
 * detach: they are not part of the plan.
 */
export function planWeek(draft: WeekDraft, stored: ReadonlyMap<string, MenuItem>): WeekPlanResult {
  const fields: WeekDraftErrors = {};
  const items: PlannedItem[] = [];
  const schedule: PlannedScheduleEntry[] = [];
  const indexById = new Map<string, number>();
  const placed = new Set<string>();

  const place = (
    list: readonly WeekItemDraft[],
    category: WeeklyCategory,
    day: MenuDay | null,
    path: string,
  ) => {
    for (const [sortOrder, entry] of list.entries()) {
      const at = `${path}.${sortOrder}`;
      const { id, ...content } = entry;
      const errors = validateMenuItem({
        ...content,
        category,
        soldOut: false,
        active: true,
        sortOrder,
      });
      for (const [field, code] of Object.entries(errors ?? {})) {
        fields[`${at}.${field}`] = code;
      }
      if (errors) {
        continue;
      }

      if (id === undefined) {
        items.push({ id: null, category, content, changed: true });
        schedule.push({ item: items.length - 1, day, sortOrder });
        continue;
      }

      const current = stored.get(id);
      const idError = !current
        ? 'unknown_item'
        : !isWeeklyCategory(current.category)
          ? 'not_weekly'
          : placed.has(`${day}:${category}:${id}`)
            ? 'duplicate'
            : null;
      if (idError) {
        fields[`${at}.id`] = idError;
        continue;
      }

      const known = indexById.get(id);
      const first = known === undefined ? undefined : items[known];
      if (first && (first.category !== category || !sameContent(first.content, content))) {
        fields[`${at}.id`] = 'conflict';
        continue;
      }

      let index = known;
      if (index === undefined) {
        const changed =
          !current?.active || current.category !== category || !sameContent(current, content);
        index = items.push({ id, category, content, changed }) - 1;
        indexById.set(id, index);
      }
      placed.add(`${day}:${category}:${id}`);
      schedule.push({ item: index, day, sortOrder });
    }
  };

  for (const day of menuDays) {
    place(draft.days[day].soups, 'daily_soup', day, `days.${day}.soups`);
    place(draft.days[day].mains, 'daily_main', day, `days.${day}.mains`);
  }
  place(draft.featured, 'featured', null, 'featured');

  return Object.keys(fields).length > 0
    ? { ok: false, fields }
    : { ok: true, plan: { items, schedule } };
}

/** Every stored item the draft references, once each: the items `planWeek` needs in `stored`. */
export function weekDraftIds(draft: WeekDraft): string[] {
  const lists = [
    ...menuDays.flatMap((day) => [draft.days[day].soups, draft.days[day].mains]),
    draft.featured,
  ];
  const ids = lists.flat().flatMap((item) => (item.id === undefined ? [] : [item.id]));
  return [...new Set(ids)];
}

function sameContent(a: MenuItemContent, b: MenuItemContent): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.priceWeekday === b.priceWeekday &&
    a.priceWeekend === b.priceWeekend &&
    a.soupIncluded === b.soupIncluded &&
    a.requiresSide === b.requiresSide &&
    sameList(a.variations, b.variations) &&
    sameList(a.allergens, b.allergens)
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

export type ReorderErrorCode =
  /** No ids, or an id listed twice. */
  | 'invalid'
  /** An id that is not a stored item. */
  | 'unknown_item'
  /** The ids span more than one category. */
  | 'mixed_categories'
  /** The ids are weekly items; their order comes from the week's schedule. */
  | 'weekly_category'
  /** Some item of the category is missing from the list. */
  | 'incomplete';

export type ReorderResult =
  | { ok: true; category: PermanentCategory }
  | { ok: false; code: ReorderErrorCode };

/**
 * Checks a new order for one permanent category. `ids` must list every item of that category,
 * active or not, exactly once. `stored` holds every item of every category the ids belong to.
 * On success the caller sets each item's `sortOrder` to its index in `ids`.
 */
export function checkReorder(
  ids: readonly string[],
  stored: readonly { id: string; category: Category }[],
): ReorderResult {
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    return { ok: false, code: 'invalid' };
  }
  const categoryById = new Map(stored.map((item) => [item.id, item.category]));
  const categories = new Set<Category>();
  for (const id of ids) {
    const category = categoryById.get(id);
    if (!category) {
      return { ok: false, code: 'unknown_item' };
    }
    categories.add(category);
  }
  const [category] = categories;
  if (categories.size !== 1 || !category) {
    return { ok: false, code: 'mixed_categories' };
  }
  if (isWeeklyCategory(category)) {
    return { ok: false, code: 'weekly_category' };
  }
  const members = stored.filter((item) => item.category === category);
  if (members.length !== ids.length) {
    return { ok: false, code: 'incomplete' };
  }
  return { ok: true, category };
}
