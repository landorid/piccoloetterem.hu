import { loadConfig } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { fixturePriced, fixtureSubmission } from './fixture';
import type { StoredOrder } from './submission';
import { confirmationEmail } from './view';

const config = loadConfig({ RESTAURANT: 'piccolo' });

const withOrders = (change: (order: StoredOrder) => Partial<StoredOrder>) => ({
  ...fixtureSubmission,
  orders: fixtureSubmission.orders.map((order) => ({ ...order, ...change(order) })),
});

describe('confirmationEmail', () => {
  const email = confirmationEmail(fixtureSubmission, config);

  it('goes to the orders’ address, from the restaurant, replies to info@', () => {
    expect(email.to).toBe('kovacs.anna@example.com');
    expect(email.from).toEqual({
      name: 'Piccolo Club Étterem',
      address: 'rendeles@piccoloetterem.hu',
    });
    expect(email.replyTo).toBe('info@piccoloetterem.hu');
    expect(email.subject).toBe('Rendelését rögzítettük – 2026/42. hét (10.12 – 10.17)');
  });

  it('lists every day, menu, item, adjustment and extra the submission stored', () => {
    expect(email.view).toEqual({
      preview: 'Köszönjük a rendelését! Fizetendő összesen: 11 150 Ft.',
      greeting: 'Kedves Kovács Anna!',
      intro: 'Köszönjük a rendelését. Az alábbiakat rögzítettük:',
      days: [
        {
          date: '2026. október 13., kedd',
          fulfilment: { label: 'Szállítási cím', value: '9700 Szombathely, Fő tér 12. 2. em. 5.' },
          menus: [
            {
              title: '1. menü',
              lines: [
                { label: 'Leves: Újházi tyúkhúsleves', amount: 0 },
                { label: 'Főétel: Sertéspörkölt galuskával', amount: 2190 },
              ],
              total: { label: 'Menü ára', amount: 2190 },
            },
            {
              title: '2. menü',
              lines: [
                { label: 'Leves: Újházi tyúkhúsleves', amount: 0 },
                { label: 'Főétel: Grillezett lazacfilé – citromos vajjal', amount: 3490 },
                { label: 'Köret: Párolt jázminrizs', amount: 490 },
                { label: 'Leves felár', amount: 650 },
              ],
              total: { label: 'Menü ára', amount: 4630 },
            },
          ],
          // The config's order (Doboz before Kenyér), not the order they were added in.
          extras: {
            title: 'Extrák',
            lines: [
              { label: 'Doboz, 2 × 100 Ft', amount: 200 },
              { label: 'Kenyér, 2 × 50 Ft', amount: 100 },
            ],
          },
          totals: [
            { label: 'Ételek összesen', amount: 7120 },
            { label: 'Kiszállítás', amount: 150 },
            { label: 'Nap összesen', amount: 7270 },
          ],
        },
        {
          date: '2026. október 15., csütörtök',
          fulfilment: { label: 'Szállítási cím', value: '9700 Szombathely, Fő tér 12. 2. em. 5.' },
          menus: [
            {
              title: '1. menü',
              lines: [
                { label: 'Főétel: Rántott csirkemell burgonyapürével', amount: 2290 },
                { label: 'Savanyúság: Csemege uborka', amount: 350 },
                { label: 'Desszert: Túrós palacsinta', amount: 690 },
                { label: 'Leves nélkül', amount: -100 },
              ],
              total: { label: 'Menü ára', amount: 3230 },
            },
          ],
          extras: {
            title: 'Extrák',
            lines: [
              { label: 'Doboz, 1 × 100 Ft', amount: 100 },
              { label: 'Tartármártás, 1 × 400 Ft', amount: 400 },
            ],
          },
          totals: [
            { label: 'Ételek összesen', amount: 3730 },
            { label: 'Kiszállítás', amount: 150 },
            { label: 'Nap összesen', amount: 3880 },
          ],
        },
      ],
      note: { label: 'Megjegyzés', text: 'Kérem, a kapucsengőn a 25-öt nyomják.' },
      grandTotal: { label: 'Fizetendő összesen', amount: 11150 },
      contact: {
        title: 'Elérhetőség',
        name: 'Piccolo Club Étterem',
        address: '9700 Szombathely, Mátyás Király utca 12.',
        phone: { text: '+36 30 490 1122', href: 'tel:+36304901122' },
        email: { text: 'info@piccoloetterem.hu', href: 'mailto:info@piccoloetterem.hu' },
        openingHours: 'Hétfő–szombat 11:00–16:00',
      },
      replyNote: 'Erre a levélre válaszolva közvetlenül nekünk írhat (info@piccoloetterem.hu).',
    });
  });

  it('prints the totals core priced: per menu, per day and for the submission', () => {
    const amountOf = (lines: { label: string; amount: number }[], label: string) =>
      lines.find((line) => line.label === label)?.amount;

    expect(email.view.days).toHaveLength(fixturePriced.days.length);
    for (const [index, day] of email.view.days.entries()) {
      const priced = fixturePriced.days[index];
      expect(day.menus.map((menu) => menu.total.amount)).toEqual(
        priced?.menus.map((menu) => menu.price),
      );
      expect(amountOf(day.totals, 'Ételek összesen')).toBe(priced?.foodSubtotal);
      expect(amountOf(day.totals, 'Kiszállítás')).toBe(priced?.deliveryFee);
      expect(amountOf(day.totals, 'Nap összesen')).toBe(priced?.total);
    }
    expect(email.view.grandTotal.amount).toBe(fixturePriced.total);
  });

  it('shows a pickup day without an address or a delivery fee', () => {
    const pickup = confirmationEmail(
      withOrders((order) => ({
        fulfilment: 'pickup',
        address: '',
        deliveryFee: 0,
        total: order.foodSubtotal,
      })),
      config,
    );
    const [day] = pickup.view.days;

    expect(day?.fulfilment).toEqual({ label: 'Személyes átvétel', value: null });
    expect(day?.totals).toEqual([
      { label: 'Ételek összesen', amount: 7120 },
      { label: 'Nap összesen', amount: 7120 },
    ]);
    expect(pickup.view.grandTotal.amount).toBe(7120 + 3730);
  });

  it('leaves out the note and the extras when there are none', () => {
    const plain = confirmationEmail(
      withOrders(() => ({ note: null, extras: [] })),
      config,
    );

    expect(plain.view.note).toBeNull();
    expect(plain.view.days.map((day) => day.extras)).toEqual([null, null]);
  });

  it('puts an extra the config no longer has after the known ones', () => {
    const [tuesday] = withOrders((order) => ({
      extras: [
        { extraKey: 'retired', name: 'Szalvéta', quantity: 1, unitPrice: 20 },
        ...order.extras,
      ],
    })).orders;
    const view = confirmationEmail(
      { submissionId: fixtureSubmission.submissionId, orders: tuesday ? [tuesday] : [] },
      config,
    ).view;

    expect(view.days[0]?.extras?.lines.map((line) => line.label)).toEqual([
      'Doboz, 2 × 100 Ft',
      'Kenyér, 2 × 50 Ft',
      'Szalvéta, 1 × 20 Ft',
    ]);
  });

  it('refuses a submission without orders', () => {
    expect(() => confirmationEmail({ submissionId: 'none', orders: [] }, config)).toThrow(
      'Submission none has no orders',
    );
  });
});
