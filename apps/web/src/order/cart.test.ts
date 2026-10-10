import { maxExtraQuantity } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { dish, openMenu } from '../test/fixtures';
import {
  addMenu,
  type CartState,
  changeForm,
  editMenu,
  emptyCart,
  formFor,
  reconcile,
  removeMenu,
  resetForm,
} from './cart';
import { type Choice, choose, emptyForm, stepExtra } from './form';

const menu = openMenu.menu;
const wed = '2026-09-09';
const thu = '2026-09-10';

const answer = (state: CartState, date: string, ...choices: Choice[]) =>
  changeForm(state, date, (form) => choices.reduce(choose, form));
const extra = (state: CartState, date: string, key: string, times: number) => {
  let next = state;
  for (let i = 0; i < times; i++) next = changeForm(next, date, (f) => stepExtra(f, key, 1));
  return next;
};
const paprikas: Choice[] = [
  { slot: 'soup', id: null },
  { slot: 'main', item: dish('sze-paprikas-csirke') },
];
const soupOnly: Choice[] = [{ slot: 'soup', id: 'sze-brokkoli' }];

/** The invariants the cart promises after every transition. */
function expectInvariants(state: CartState) {
  for (const [date, menus] of Object.entries(state.menusByDate)) {
    expect(menus.length, `menus of ${date}`).toBeGreaterThan(0);
  }
  for (const date of Object.keys(state.extrasByDate)) {
    expect(state.menusByDate[date], `extras of ${date} without a menu`).toBeDefined();
  }
  for (const quantities of Object.values(state.extrasByDate)) {
    expect(Object.keys(quantities).length, 'an empty extras record').toBeGreaterThan(0);
    for (const quantity of Object.values(quantities)) {
      expect(quantity).toBeGreaterThanOrEqual(1);
      expect(quantity).toBeLessThanOrEqual(maxExtraQuantity);
    }
  }
}

describe('addMenu', () => {
  it('commits the form as a menu, moves its extras to the day and empties the form', () => {
    const filled = extra(answer(emptyCart, wed, ...paprikas), wed, 'doboz', 2);
    const added = addMenu(filled, wed, menu);
    expect(added.menusByDate[wed]).toEqual([{ mainId: 'sze-paprikas-csirke' }]);
    expect(added.extrasByDate[wed]).toEqual({ doboz: 2 });
    expect(formFor(added, wed)).toBe(emptyForm());
    expect(added.formsByDate).toEqual({});
    expectInvariants(added);
  });

  it('never commits a form whose soup is unanswered', () => {
    const unanswered = answer(emptyCart, wed, { slot: 'main', item: dish('sze-paprikas-csirke') });
    expect(addMenu(unanswered, wed, menu)).toBe(unanswered);
  });

  it('sums the extras into the day, capped at the maximum', () => {
    let state = addMenu(extra(answer(emptyCart, wed, ...paprikas), wed, 'doboz', 15), wed, menu);
    state = addMenu(extra(answer(state, wed, ...soupOnly), wed, 'doboz', 15), wed, menu);
    state = addMenu(extra(answer(state, wed, ...soupOnly), wed, 'kenyer', 1), wed, menu);
    expect(state.menusByDate[wed]).toHaveLength(3);
    expect(state.extrasByDate[wed]).toEqual({ doboz: maxExtraQuantity, kenyer: 1 });
    expectInvariants(state);
  });
});

describe('editMenu', () => {
  const twoMenus = () => {
    let state = addMenu(extra(answer(emptyCart, wed, ...paprikas), wed, 'doboz', 12), wed, menu);
    state = addMenu(answer(state, wed, ...soupOnly), wed, menu);
    return state;
  };

  it('pulls the menu and the day’s extras back into the form', () => {
    const edited = editMenu(twoMenus(), wed, 0);
    expect(edited.menusByDate[wed]).toEqual([{ soupId: 'sze-brokkoli' }]);
    expect(edited.extrasByDate[wed]).toBeUndefined();
    expect(formFor(edited, wed)).toEqual({
      ...emptyForm(),
      soupId: null,
      mainId: 'sze-paprikas-csirke',
      extras: { doboz: 12 },
    });
    expectInvariants(edited);
  });

  it('sums the day’s extras with the ones pending in the form, capped', () => {
    const pending = extra(twoMenus(), wed, 'doboz', 10);
    expect(formFor(editMenu(pending, wed, 1), wed).extras).toEqual({ doboz: maxExtraQuantity });
  });

  it('removes the day when its last menu goes back to the form', () => {
    let state = editMenu(twoMenus(), wed, 1);
    state = resetForm(state, wed);
    state = editMenu(state, wed, 0);
    expect(state.menusByDate[wed]).toBeUndefined();
    expect(formFor(state, wed).mainId).toBe('sze-paprikas-csirke');
    expectInvariants(state);
  });
});

describe('removeMenu', () => {
  it('keeps the day’s extras while a menu is left, and drops them with the last one', () => {
    let state = addMenu(extra(answer(emptyCart, wed, ...paprikas), wed, 'kenyer', 3), wed, menu);
    state = addMenu(answer(state, wed, ...soupOnly), wed, menu);
    state = removeMenu(state, wed, 0);
    expect(state.menusByDate[wed]).toEqual([{ soupId: 'sze-brokkoli' }]);
    expect(state.extrasByDate[wed]).toEqual({ kenyer: 3 });
    state = removeMenu(state, wed, 0);
    expect(state.menusByDate).toEqual({});
    expect(state.extrasByDate).toEqual({});
    expectInvariants(state);
  });
});

describe('resetForm', () => {
  it('drops the half-built dishes and the pending extras', () => {
    const state = resetForm(extra(answer(emptyCart, wed, ...paprikas), wed, 'doboz', 1), wed);
    expect(formFor(state, wed)).toBe(emptyForm());
  });
});

describe('reconcile', () => {
  const cart = () => {
    let state: CartState = { ...emptyCart, activeDate: wed };
    state = addMenu(extra(answer(state, wed, ...paprikas), wed, 'doboz', 1), wed, menu);
    state = addMenu(answer(state, thu, { slot: 'soup', id: 'cs-gulyas' }), thu, menu);
    return answer(state, wed, { slot: 'soup', id: 'sze-husleves' });
  };

  it('drops every day that is no longer orderable and leaves the active day to the screen', () => {
    const { state, dropped } = reconcile(cart(), [thu, '2026-09-11']);
    expect(dropped).toEqual([wed]);
    expect(Object.keys(state.menusByDate)).toEqual([thu]);
    expect(state.extrasByDate).toEqual({});
    expect(state.formsByDate).toEqual({});
    expect(state.activeDate).toBe(wed);
    expectInvariants(state);
  });

  it('reports only days that held menus', () => {
    const onlyForm = answer({ ...emptyCart, activeDate: wed }, wed, ...soupOnly);
    const { state, dropped } = reconcile(onlyForm, [thu]);
    expect(dropped).toEqual([]);
    expect(state.formsByDate).toEqual({});
  });

  it('leaves a cart that still fits untouched', () => {
    const before = cart();
    expect(reconcile(before, [wed, thu]).state).toBe(before);
  });

  it('leaves the active day to the screen, a selected closed day and an empty week included', () => {
    const closedDay: CartState = { ...emptyCart, activeDate: thu };
    expect(reconcile(closedDay, [wed, '2026-09-11']).state).toBe(closedDay);
    expect(reconcile(emptyCart, [thu]).state.activeDate).toBeNull();
    const { state, dropped } = reconcile(cart(), []);
    expect(dropped).toEqual([wed, thu]);
    expect(state).toEqual({ ...emptyCart, activeDate: wed });
  });
});
