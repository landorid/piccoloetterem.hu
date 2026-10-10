import type { PublicMenu } from '@piccolo/core';
import { createContext, useContext } from 'react';
import { createStore, type StoreApi, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  addMenu,
  type CartState,
  changeForm,
  editMenu,
  emptyCart,
  type IsoDate,
  reconcile,
  removeMenu,
  resetForm,
  selectDate,
} from './cart';
import { type Choice, choose, stepExtra } from './form';

export interface OrderStore extends CartState {
  /** Days a refetch removed from the cart, until the guest dismisses their banner. Not persisted. */
  droppedDates: IsoDate[];
  selectDate(date: IsoDate): void;
  choose(date: IsoDate, choice: Choice): void;
  stepExtra(date: IsoDate, key: string, delta: 1 | -1): void;
  resetForm(date: IsoDate): void;
  addMenu(date: IsoDate, publicMenu: PublicMenu): void;
  editMenu(date: IsoDate, index: number): void;
  removeMenu(date: IsoDate, index: number): void;
  /** Fits the cart to a fresh `open` answer and records the days it dropped. */
  reconcile(orderableDates: readonly IsoDate[]): void;
  /** Empties the cart for an answer with nothing to order; nothing is explained. */
  clear(): void;
  dismissDropped(date: IsoDate): void;
}

export type OrderStoreApi = StoreApi<OrderStore>;

export const storageKey = 'piccolo:order';

/**
 * The order of one browser tab, kept in `sessionStorage` so a reload keeps the cart. A stored
 * order of another version is discarded, not migrated.
 */
export function createOrderStore(storage?: StateStorage): OrderStoreApi {
  return createStore<OrderStore>()(
    persist(
      (set) => ({
        ...emptyCart,
        droppedDates: [],
        selectDate: (date) => set((state) => selectDate(state, date)),
        choose: (date, choice) =>
          set((state) => changeForm(state, date, (form) => choose(form, choice))),
        stepExtra: (date, key, delta) =>
          set((state) => changeForm(state, date, (form) => stepExtra(form, key, delta))),
        resetForm: (date) => set((state) => resetForm(state, date)),
        addMenu: (date, publicMenu) => set((state) => addMenu(state, date, publicMenu)),
        editMenu: (date, index) => set((state) => editMenu(state, date, index)),
        removeMenu: (date, index) => set((state) => removeMenu(state, date, index)),
        reconcile: (orderableDates) =>
          set((state) => {
            const { state: next, dropped } = reconcile(state, orderableDates);
            return dropped.length > 0
              ? { ...next, droppedDates: [...state.droppedDates, ...dropped] }
              : next;
          }),
        clear: () => set({ ...emptyCart, droppedDates: [] }),
        dismissDropped: (date) =>
          set((state) => ({ droppedDates: state.droppedDates.filter((d) => d !== date) })),
      }),
      {
        name: storageKey,
        version: 1,
        // Without a `sessionStorage` (the server render) the store simply does not persist.
        storage: createJSONStorage(() => storage ?? sessionStorage),
        partialize: ({ activeDate, menusByDate, extrasByDate, formsByDate }): CartState => ({
          activeDate,
          menusByDate,
          extrasByDate,
          formsByDate,
        }),
        migrate: () => emptyCart,
      },
    ),
  );
}

const OrderStoreContext = createContext<OrderStoreApi | null>(null);

export const OrderStoreProvider = OrderStoreContext.Provider;

/** Reads the order through `selector`; it must return a stable value (no new objects). */
export function useOrder<T>(selector: (state: OrderStore) => T): T {
  const store = useContext(OrderStoreContext);
  if (!store) {
    throw new Error('useOrder must be used inside an OrderStoreProvider');
  }
  return useStore(store, selector);
}
