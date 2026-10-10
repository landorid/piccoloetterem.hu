import {
  adjustmentsOf,
  type OrderStatus,
  phoneSearchFragment,
  type Slot,
  type StatusChange,
  slots,
  statusesBefore,
} from '@piccolo/core';
import {
  and,
  asc,
  type Db,
  desc,
  eq,
  ilike,
  inArray,
  naturalSort,
  ne,
  or,
  orderExtras,
  orderItems,
  orderMenus,
  orders,
  type SQL,
  sql,
} from '@piccolo/db';
import { type OrderListQuery, orderPageSize } from './admin.schemas';

/*
 * The staff's order queries. Each is one statement, so one round trip, and every count and sum is
 * Postgres's (docs/STACK.md rule 5). Item names, variations and prices are the snapshots stored
 * at submission; nothing here joins `menu_items`.
 */

const notePreviewLength = 100;

/*
 * The correlated subqueries are written out with their own aliases. Drizzle writes the columns of
 * a one-table select unqualified, and inside a subquery an unqualified `id` would be the
 * subquery's own table's.
 */

const menuCount = sql<number>`(select count(*)::int from order_menus m where m.order_id = "orders"."id")`;

/** One row of the order list, and what a status change returns. */
const rowColumns = {
  id: orders.id,
  name: orders.name,
  phone: orders.phone,
  /** `''` for pickup. */
  address: orders.address,
  fulfilment: orders.fulfilment,
  status: orders.status,
  total: orders.total,
  menuCount,
  /** The note, cut to 100 characters with `…`; `null` without one. */
  notePreview: sql<
    string | null
  >`case when char_length(${orders.note}) > ${sql.raw(String(notePreviewLength))}
    then left(${orders.note}, ${sql.raw(String(notePreviewLength - 1))}) || '…'
    else ${orders.note} end`,
  createdAt: orders.createdAt,
  processedAt: orders.processedAt,
  cancelledAt: orders.cancelledAt,
};

/** Escapes `%`, `_` and `\` for `ILIKE`, whose escape character is `\`. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/** `q` inside the name or the e-mail; or, when `q` is a phone number, inside the stored `+36…` phone. */
function search(q: string): SQL | undefined {
  const phone = phoneSearchFragment(q);
  return or(
    ilike(orders.name, `%${likeLiteral(q)}%`),
    ilike(orders.email, `%${likeLiteral(q)}%`),
    phone === null ? undefined : ilike(orders.phone, `%${likeLiteral(phone)}%`),
  );
}

/**
 * The orders of one delivery date, newest first, `orderPageSize` per page. A page after the first
 * starts below the order its cursor names (by `created_at`, then `id`), so orders created while
 * staff page through cannot shift a page.
 */
export async function listOrders(db: Db, { date, status, q, cursor }: OrderListQuery) {
  const rows = await db
    .select(rowColumns)
    .from(orders)
    .where(
      and(
        eq(orders.deliveryDate, date),
        status === 'all' ? undefined : eq(orders.status, status),
        q ? search(q) : undefined,
        cursor === undefined
          ? undefined
          : sql`(${orders.createdAt}, ${orders.id}) <
              (select created_at, id from ${orders} as cursor where cursor.id = ${cursor})`,
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(orderPageSize + 1);
  const page = rows.slice(0, orderPageSize);
  return {
    orders: page,
    nextCursor: rows.length > orderPageSize ? (page.at(-1)?.id ?? null) : null,
  };
}

interface StoredItem {
  slot: Slot;
  name: string;
  variation: string | null;
  unitPrice: number;
}

interface StoredMenu {
  position: number;
  price: number;
  /** In slot order: soup, main, side, pickle, dessert. */
  items: StoredItem[];
}

interface StoredExtra {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface Sibling {
  id: string;
  /** `YYYY-MM-DD`. */
  deliveryDate: string;
  status: OrderStatus;
}

/**
 * One order with everything stored for it, or `null`. Each menu also carries its adjustments,
 * read back from its prices. `siblings` are the other days of the same submission.
 */
export async function readOrder(db: Db, id: string) {
  const [row] = await db
    .select({
      id: orders.id,
      submissionId: orders.submissionId,
      customerId: orders.customerId,
      deliveryDate: orders.deliveryDate,
      fulfilment: orders.fulfilment,
      status: orders.status,
      name: orders.name,
      phone: orders.phone,
      email: orders.email,
      address: orders.address,
      note: orders.note,
      foodSubtotal: orders.foodSubtotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      createdAt: orders.createdAt,
      processedAt: orders.processedAt,
      cancelledAt: orders.cancelledAt,
      menus: sql<StoredMenu[]>`coalesce((
        select json_agg(json_build_object(
          'position', m.position,
          'price', m.price,
          'items', coalesce((
            select json_agg(json_build_object(
              'slot', i.slot, 'name', i.name, 'variation', i.variation, 'unitPrice', i.unit_price
            ) order by i.slot)
            from order_items i where i.order_menu_id = m.id
          ), '[]'::json)
        ) order by m.position)
        from order_menus m where m.order_id = "orders"."id"
      ), '[]'::json)`,
      extras: sql<StoredExtra[]>`coalesce((
        select json_agg(json_build_object(
          'key', e.extra_key, 'name', e.name, 'quantity', e.quantity, 'unitPrice', e.unit_price
        ) order by e.name)
        from order_extras e where e.order_id = "orders"."id"
      ), '[]'::json)`,
      siblings: sql<Sibling[]>`coalesce((
        select json_agg(json_build_object(
          'id', sibling.id, 'deliveryDate', sibling.delivery_date, 'status', sibling.status
        ) order by sibling.delivery_date)
        from orders sibling
        where sibling.submission_id = "orders"."submission_id" and sibling.id <> "orders"."id"
      ), '[]'::json)`,
    })
    .from(orders)
    .where(eq(orders.id, id));
  if (!row) {
    return null;
  }
  return {
    ...row,
    menus: row.menus.map((menu) => ({
      ...menu,
      adjustments: adjustmentsOf(
        menu.price,
        menu.items.map((item) => item.unitPrice),
      ),
    })),
  };
}

export type StatusChangeResult =
  | { ok: true; order: Awaited<ReturnType<typeof listOrders>>['orders'][number] }
  | { ok: false; current: OrderStatus | null };

/**
 * Sets `to` and its timestamp, in one conditional `UPDATE`, only if the order is in a status `to`
 * may follow: of two staff changing the same order at once, the second sees the first's result.
 * `current` is the order's status when the change was not allowed, `null` when there is no order.
 */
export async function changeStatus(
  db: Db,
  id: string,
  to: StatusChange,
): Promise<StatusChangeResult> {
  const [order] = await db
    .update(orders)
    .set(
      to === 'processed'
        ? { status: to, processedAt: sql`now()` }
        : { status: to, cancelledAt: sql`now()` },
    )
    .where(and(eq(orders.id, id), inArray(orders.status, [...statusesBefore(to)])))
    .returning(rowColumns);
  if (order) {
    return { ok: true, order };
  }
  const [found] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id));
  return { ok: false, current: found?.status ?? null };
}

interface Dish {
  name: string;
  variation: string | null;
  count: number;
}

// A type, not an interface: `execute` needs an index signature.
type SummaryRow = {
  orderCount: number;
  menuCount: number;
  revenue: number;
  deliveryCount: number;
  pickupCount: number;
  dishes: (Dish & { slot: Slot })[];
  extras: { key: string; name: string; quantity: number }[];
};

/**
 * The kitchen's view of a delivery date, over its orders that are not cancelled: how many of each
 * dish (`name` and `variation` as snapshotted) per slot, most first, then by name; each extra's
 * total quantity; the order and menu counts and the revenue (the sum of `total`, delivery fees
 * included). Names sort with `natural_sort`, as the delivery list's addresses do.
 */
export async function daySummary(db: Db, date: string) {
  const collation = sql.identifier(naturalSort);
  const {
    rows: [summary],
  } = await db.execute<SummaryRow>(sql`
    with day_orders as (
      select ${orders.id}, ${orders.fulfilment}, ${orders.total} from ${orders}
      where ${orders.deliveryDate} = ${date} and ${orders.status} <> 'cancelled'
    ),
    day_menus as (
      select ${orderMenus.id} from ${orderMenus}
      where ${orderMenus.orderId} in (select id from day_orders)
    ),
    dishes as (
      select ${orderItems.slot} as slot, ${orderItems.name} as name,
        ${orderItems.variation} as variation, count(*)::int as count
      from ${orderItems} where ${orderItems.orderMenuId} in (select id from day_menus)
      group by 1, 2, 3
    ),
    extras as (
      select ${orderExtras.extraKey} as key, min(${orderExtras.name}) as name,
        sum(${orderExtras.quantity})::int as quantity
      from ${orderExtras} where ${orderExtras.orderId} in (select id from day_orders)
      group by 1
    )
    select
      count(*)::int as "orderCount",
      (select count(*)::int from day_menus) as "menuCount",
      coalesce(sum(total), 0)::int as revenue,
      (count(*) filter (where fulfilment = 'delivery'))::int as "deliveryCount",
      (count(*) filter (where fulfilment = 'pickup'))::int as "pickupCount",
      (select coalesce(json_agg(dishes order by slot, count desc, name collate ${collation},
          variation collate ${collation} nulls first), '[]'::json)
        from dishes) as dishes,
      (select coalesce(json_agg(extras order by name collate ${collation}), '[]'::json)
        from extras) as extras
    from day_orders`);
  // An aggregate without `group by` always returns one row.
  const { dishes, ...counts } = summary as SummaryRow;
  return {
    date,
    ...counts,
    dishes: Object.fromEntries(
      slots.map((slot) => [
        slot,
        dishes.flatMap(({ slot: of, ...dish }) => (of === slot ? [dish] : [])),
      ]),
    ) as Record<Slot, Dish[]>,
  };
}

/**
 * The courier's list for a delivery date: its delivery orders that are not cancelled, by address
 * in natural order with case and accents ignored (`natural_sort`), so one street's numbers follow
 * each other.
 */
export async function deliveryList(db: Db, date: string) {
  const rows = await db
    .select({
      id: orders.id,
      name: orders.name,
      phone: orders.phone,
      address: orders.address,
      menuCount,
      total: orders.total,
      note: orders.note,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryDate, date),
        eq(orders.fulfilment, 'delivery'),
        ne(orders.status, 'cancelled'),
      ),
    )
    .orderBy(
      sql`${orders.address} collate ${sql.identifier(naturalSort)}`,
      asc(orders.createdAt),
      asc(orders.id),
    );
  return { date, orders: rows };
}
