import { describe, expect, it } from 'vitest';
import { fixtureSubmission } from './fixture';
import { groupSubmission, type SubmissionRowsRead } from './submission';

/** The fixture as flat table rows, the way the loader's four selects return them. */
function flatRows(): SubmissionRowsRead {
  const rows: {
    orders: SubmissionRowsRead['orders'][number][];
    menus: SubmissionRowsRead['menus'][number][];
    items: SubmissionRowsRead['items'][number][];
    extras: SubmissionRowsRead['extras'][number][];
  } = { orders: [], menus: [], items: [], extras: [] };
  for (const { menus, extras, ...order } of fixtureSubmission.orders) {
    rows.orders.push(order);
    for (const { items, ...menu } of menus) {
      const id = `${order.id}-menu-${menu.position}`;
      rows.menus.push({ ...menu, id, orderId: order.id });
      rows.items.push(...items.map((item) => ({ ...item, orderMenuId: id })));
    }
    rows.extras.push(...extras.map((extra) => ({ ...extra, orderId: order.id })));
  }
  return rows;
}

describe('groupSubmission', () => {
  it('puts rows that arrive in any order back in display order', () => {
    const rows = flatRows();
    // The loader's selects have no ORDER BY: orders, menus and items may come in any order.
    const shuffled = {
      ...rows,
      orders: rows.orders.toReversed(),
      menus: rows.menus.toReversed(),
      items: rows.items.toReversed(),
    };

    expect(groupSubmission(fixtureSubmission.submissionId, shuffled)).toEqual(fixtureSubmission);
  });

  it('refuses a row whose parent is not among the rows', () => {
    const rows = flatRows();
    expect(() =>
      groupSubmission(fixtureSubmission.submissionId, { ...rows, orders: rows.orders.slice(1) }),
    ).toThrow(/^No order .+ in the submission's rows$/);
  });
});
