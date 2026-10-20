import type { MenuItem, PublicMenu, Slot } from '../menu/types';

function itemsForSlot(
  publicMenu: PublicMenu,
  deliveryDate: string,
  slot: Slot,
): readonly MenuItem[] {
  const day = Object.values(publicMenu.days).find((entry) => entry.date === deliveryDate);
  if (slot === 'soup') return day?.soups ?? [];
  if (slot === 'main') {
    return [...(day?.mains ?? []), ...publicMenu.featured, ...publicMenu.permanent.allWeek];
  }
  if (slot === 'side') {
    return [...publicMenu.permanent.sides, ...publicMenu.permanent.sideExtras];
  }
  if (slot === 'pickle') return publicMenu.permanent.pickles;
  return publicMenu.permanent.desserts;
}

export function findItem(
  publicMenu: PublicMenu,
  deliveryDate: string,
  slot: Slot,
  id: string,
): MenuItem | undefined {
  return itemsForSlot(publicMenu, deliveryDate, slot).find((item) => item.id === id);
}
