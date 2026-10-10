import { type Fulfilment, type Slot, slots } from '@piccolo/core';
import {
  and,
  type Db,
  eq,
  inArray,
  isNull,
  orderExtras,
  orderItems,
  orderMenus,
  orders,
  sql,
} from '@piccolo/db';

/**
 * A submission as stored, which is all the confirmation e-mail prints: the snapshots O3 wrote,
 * never the live menu. Orders run by delivery date, menus by position, items in slot order.
 */
export interface StoredSubmission {
  submissionId: string;
  orders: StoredOrder[];
}

export interface StoredOrder {
  id: string;
  /** `YYYY-MM-DD` in the restaurant's timezone. */
  deliveryDate: string;
  fulfilment: Fulfilment;
  name: string;
  phone: string;
  email: string;
  /** `''` for pickup. */
  address: string;
  /** The same on every order of a submission. */
  note: string | null;
  foodSubtotal: number;
  deliveryFee: number;
  total: number;
  confirmationSentAt: Date | null;
  menus: StoredMenu[];
  extras: StoredExtra[];
}

export interface StoredMenu {
  /** From 1 within the day: `1. menü`. */
  position: number;
  /** Adjustments included: `storedMenuAdjustment` recovers them. */
  price: number;
  items: StoredItem[];
}

export interface StoredItem {
  slot: Slot;
  name: string;
  variation: string | null;
  unitPrice: number;
}

export interface StoredExtra {
  extraKey: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/** The flat rows of one submission, as the tables hold them. */
export interface SubmissionRowsRead {
  orders: readonly Omit<StoredOrder, 'menus' | 'extras'>[];
  menus: readonly (Omit<StoredMenu, 'items'> & { id: string; orderId: string })[];
  items: readonly (StoredItem & { orderMenuId: string })[];
  extras: readonly (StoredExtra & { orderId: string })[];
}

/**
 * Nests the rows of a submission and puts them in display order. Extras keep the rows' order; the
 * table has no position, so the e-mail orders them by the config.
 */
export function groupSubmission(submissionId: string, rows: SubmissionRowsRead): StoredSubmission {
  const ordersById = new Map<string, StoredOrder>();
  for (const order of rows.orders) {
    ordersById.set(order.id, { ...order, menus: [], extras: [] });
  }
  const menusById = new Map<string, StoredMenu>();
  for (const { id, orderId, position, price } of rows.menus) {
    const menu: StoredMenu = { position, price, items: [] };
    menusById.set(id, menu);
    lookUp(ordersById, orderId, 'order').menus.push(menu);
  }
  for (const { orderMenuId, slot, name, variation, unitPrice } of rows.items) {
    lookUp(menusById, orderMenuId, 'menu').items.push({ slot, name, variation, unitPrice });
  }
  for (const { orderId, extraKey, name, quantity, unitPrice } of rows.extras) {
    lookUp(ordersById, orderId, 'order').extras.push({ extraKey, name, quantity, unitPrice });
  }

  const grouped = [...ordersById.values()].toSorted((a, b) =>
    a.deliveryDate.localeCompare(b.deliveryDate),
  );
  for (const order of grouped) {
    order.menus.sort((a, b) => a.position - b.position);
    for (const menu of order.menus) {
      menu.items.sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
    }
  }
  return { submissionId, orders: grouped };
}

function lookUp<T>(byId: ReadonlyMap<string, T>, id: string, what: string): T {
  const found = byId.get(id);
  if (!found) {
    throw new Error(`No ${what} ${id} in the submission's rows`);
  }
  return found;
}

/**
 * Reads a submission's snapshots, in four statements: its orders, their menus, the menus' items,
 * the orders' extras. `null` when no order has `submissionId`. Never joins `menu_items`: the
 * e-mail shows what was ordered, even if staff renamed or deleted the dish since.
 */
export async function loadSubmissionForEmail(
  db: Db,
  submissionId: string,
): Promise<StoredSubmission | null> {
  const orderRows = await db
    .select({
      id: orders.id,
      deliveryDate: orders.deliveryDate,
      fulfilment: orders.fulfilment,
      name: orders.name,
      phone: orders.phone,
      email: orders.email,
      address: orders.address,
      note: orders.note,
      foodSubtotal: orders.foodSubtotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      confirmationSentAt: orders.confirmationSentAt,
    })
    .from(orders)
    .where(eq(orders.submissionId, submissionId));
  if (orderRows.length === 0) {
    return null;
  }
  const orderIds = orderRows.map((order) => order.id);
  const menuRows = await db
    .select({
      id: orderMenus.id,
      orderId: orderMenus.orderId,
      position: orderMenus.position,
      price: orderMenus.price,
    })
    .from(orderMenus)
    .where(inArray(orderMenus.orderId, orderIds));
  const itemRows =
    menuRows.length === 0
      ? []
      : await db
          .select({
            orderMenuId: orderItems.orderMenuId,
            slot: orderItems.slot,
            name: orderItems.name,
            variation: orderItems.variation,
            unitPrice: orderItems.unitPrice,
          })
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderMenuId,
              menuRows.map((menu) => menu.id),
            ),
          );
  const extraRows = await db
    .select({
      orderId: orderExtras.orderId,
      extraKey: orderExtras.extraKey,
      name: orderExtras.name,
      quantity: orderExtras.quantity,
      unitPrice: orderExtras.unitPrice,
    })
    .from(orderExtras)
    .where(inArray(orderExtras.orderId, orderIds));

  return groupSubmission(submissionId, {
    orders: orderRows,
    menus: menuRows,
    items: itemRows,
    extras: extraRows,
  });
}

/**
 * Records that the submission's confirmation went out. Only orders not marked yet are touched, so
 * the first time stays the recorded one.
 */
export async function markConfirmationSent(db: Db, submissionId: string): Promise<void> {
  await db
    .update(orders)
    .set({ confirmationSentAt: sql`now()` })
    .where(and(eq(orders.submissionId, submissionId), isNull(orders.confirmationSentAt)));
}
