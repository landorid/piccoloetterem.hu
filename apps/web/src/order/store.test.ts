import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { dish, openMenu } from '../test/fixtures';
import { formFor } from './cart';
import { createOrderStore, storageKey } from './store';

const menu = openMenu.menu;
const wed = '2026-09-09';
const thu = '2026-09-10';

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function orderOnWednesday(storage: StateStorage) {
  const store = createOrderStore(storage);
  const order = store.getState();
  order.selectDate(wed);
  order.choose(wed, { slot: 'soup', id: null });
  order.choose(wed, { slot: 'main', item: dish('sze-paprikas-csirke') });
  order.stepExtra(wed, 'doboz', 1);
  order.addMenu(wed, menu);
  return store;
}

describe('createOrderStore', () => {
  it('keeps the cart across a reload of the tab', () => {
    const storage = memoryStorage();
    const before = orderOnWednesday(storage);
    before.getState().choose(thu, { slot: 'soup', id: 'cs-gulyas' });

    const after = createOrderStore(storage).getState();
    expect(after.activeDate).toBe(wed);
    expect(after.menusByDate).toEqual({ [wed]: [{ mainId: 'sze-paprikas-csirke' }] });
    expect(after.extrasByDate).toEqual({ [wed]: { doboz: 1 } });
    expect(formFor(after, thu).soupId).toBe('cs-gulyas');
  });

  it('does not keep the cut-off banners across a reload', () => {
    const storage = memoryStorage();
    const before = orderOnWednesday(storage);
    before.getState().reconcile([thu]);
    expect(before.getState().droppedDates).toEqual([wed]);

    const after = createOrderStore(storage).getState();
    expect(after.droppedDates).toEqual([]);
    expect(after.menusByDate).toEqual({});
  });

  it('dismisses one banner at a time', () => {
    const store = orderOnWednesday(memoryStorage());
    store.getState().reconcile([thu]);
    store.getState().dismissDropped(wed);
    expect(store.getState().droppedDates).toEqual([]);
  });

  it('empties the cart without explaining it when nothing can be ordered', () => {
    const store = orderOnWednesday(memoryStorage());
    store.getState().clear();
    const { activeDate, menusByDate, extrasByDate, formsByDate, droppedDates } = store.getState();
    expect({ activeDate, menusByDate, extrasByDate, formsByDate, droppedDates }).toEqual({
      activeDate: null,
      menusByDate: {},
      extrasByDate: {},
      formsByDate: {},
      droppedDates: [],
    });
  });

  it('discards a cart stored by another version of the page', () => {
    const storage = memoryStorage();
    orderOnWednesday(storage);
    const stored = JSON.parse(storage.data.get(storageKey) ?? '{}');
    storage.setItem(storageKey, JSON.stringify({ ...stored, version: 0 }));

    expect(createOrderStore(storage).getState().menusByDate).toEqual({});
  });
});
