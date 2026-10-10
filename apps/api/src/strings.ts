import type { PriceAdjustment, Slot } from '@piccolo/core';

/**
 * Every user-facing string the API produces: the order confirmation e-mail (O4). Hungarian, never
 * inlined (see AGENTS.md). The API's responses carry codes, not text; the frontends word them.
 *
 * The e-mail addresses the guest formally ("Ön"), as its subject does. The price labels are the
 * public site's (docs/design/megrendeles/strings.md). Restaurant facts come from
 * `RestaurantConfig`, never from here.
 */
export const strings = {
  forint: (amount: string) => `${amount} Ft`,
  confirmation: {
    subject: (weekLabel: string) => `Rendelését rögzítettük – ${weekLabel}`,
    preview: (grandTotal: string) => `Köszönjük a rendelését! Fizetendő összesen: ${grandTotal}.`,
    greeting: (name: string) => `Kedves ${name}!`,
    intro: 'Köszönjük a rendelését. Az alábbiakat rögzítettük:',
    menuTitle: (position: number) => `${position}. menü`,
    slots: {
      soup: 'Leves',
      main: 'Főétel',
      side: 'Köret',
      pickle: 'Savanyúság',
      dessert: 'Desszert',
    } satisfies Record<Slot, string>,
    item: (slot: string, name: string) => `${slot}: ${name}`,
    itemWithVariation: (slot: string, name: string, variation: string) =>
      `${slot}: ${name} – ${variation}`,
    adjustments: {
      no_soup_discount: 'Leves nélkül',
      soup_charge: 'Leves felár',
    } satisfies Record<PriceAdjustment['code'], string>,
    menuPrice: 'Menü ára',
    extrasTitle: 'Extrák',
    extra: (name: string, quantity: number, unitPrice: string) =>
      `${name}, ${quantity} × ${unitPrice}`,
    foodSubtotal: 'Ételek összesen',
    deliveryFee: 'Kiszállítás',
    dayTotal: 'Nap összesen',
    grandTotal: 'Fizetendő összesen',
    deliveryAddress: 'Szállítási cím',
    pickup: 'Személyes átvétel',
    note: 'Megjegyzés',
    contactTitle: 'Elérhetőség',
    replyNote: (replyTo: string) =>
      `Erre a levélre válaszolva közvetlenül nekünk írhat (${replyTo}).`,
  },
};
