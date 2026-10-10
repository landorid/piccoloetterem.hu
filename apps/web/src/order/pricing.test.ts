import { describe, expect, it } from 'vitest';
import { dish, openMenu, publicConfig } from '../test/fixtures';
import { addMenu, type CartState, changeForm, emptyCart } from './cart';
import { type Choice, choose, emptyForm, type MenuForm, stepExtra } from './form';
import { priceCart, priceForm, priceLines, pricingConfig, soupEffect, unitPrice } from './pricing';

const menu = openMenu.menu;
const config = pricingConfig(publicConfig);
const wed = '2026-09-09';
const thu = '2026-09-10';
const sat = '2026-09-12';

const fill = (...choices: Choice[]): MenuForm => choices.reduce(choose, emptyForm());
const main = (id: string): Choice => ({ slot: 'main', item: dish(id) });
const formPrice = (form: MenuForm, date = wed) => priceForm(form, menu, date, config);

describe("O1's worked examples, priced the way the page prices them", () => {
  it('a soup on its own is 650', () => {
    expect(formPrice(fill({ slot: 'soup', id: 'sze-brokkoli' })).total).toBe(650);
  });

  it('a 1020 daily main without its soup is 920', () => {
    const form = fill({ slot: 'soup', id: null }, main('sze-paprikas-csirke'));
    expect(formPrice(form).total).toBe(920);
  });

  it('a 1450 all-week main with a soup is 2100', () => {
    const form = fill({ slot: 'soup', id: 'sze-husleves' }, main('cezarsalata'));
    expect(formPrice(form).total).toBe(2100);
  });
});

describe('the delivery date decides the price', () => {
  it('charges the weekend price on Saturday although the page prices in UTC', () => {
    expect(config.timezone).toBe('UTC');
    expect(unitPrice(dish('szo-rantott-szelet'), sat)).toBe(1220);
    expect(unitPrice(dish('cordon-bleu'), sat)).toBe(1790);
    expect(unitPrice(dish('cordon-bleu'), thu)).toBe(1690);
    const form = fill(
      { slot: 'soup', id: 'szo-husleves' },
      main('szo-rantott-szelet'),
      { slot: 'variation', value: 'Csirkemell' },
      { slot: 'side', id: 'parolt-rizs' },
    );
    expect(formPrice(form, sat).total).toBe(1220);
  });
});

describe('priceForm', () => {
  it('adds the pending extras to the live price and totals them apart', () => {
    let form = fill({ slot: 'soup', id: null }, main('sze-paprikas-csirke'));
    form = stepExtra(stepExtra(stepExtra(form, 'doboz', 1), 'doboz', 1), 'kenyer', 1);
    const priced = formPrice(form);
    expect(priced.menu.price).toBe(920);
    expect(priced.extrasSubtotal).toBe(250);
    expect(priced.total).toBe(1170);
  });
});

describe('soupEffect', () => {
  const effect = (form: MenuForm, soupId: string | null) =>
    soupEffect(form, soupId, menu, wed, config);

  it('has no amount for a soup dish before a main is chosen', () => {
    expect(effect(emptyForm(), 'sze-husleves')).toBeNull();
    expect(effect(emptyForm(), null)).toBe(0);
  });

  it('beside a daily main: the soup is included, declining it saves 100', () => {
    const form = fill(main('sze-paprikas-csirke'));
    expect(effect(form, 'sze-husleves')).toBe(0);
    expect(effect(form, null)).toBe(-100);
  });

  it('beside an all-week main: the soup costs 650, declining it costs nothing', () => {
    const form = fill(main('cezarsalata'));
    expect(effect(form, 'sze-husleves')).toBe(650);
    expect(effect(form, null)).toBe(0);
  });
});

describe('priceLines', () => {
  it('reads soup, main, the adjustment, then side, pickle and dessert', () => {
    const form = fill(
      { slot: 'soup', id: 'sze-husleves' },
      main('csirkemellcsikok'),
      { slot: 'side', id: 'steak-burgonya' },
      { slot: 'pickle', id: 'vegyes-vagott' },
      { slot: 'dessert', id: 'almas-pite' },
    );
    const lines = priceLines(formPrice(form).menu).map((line) =>
      line.kind === 'item' ? line.item.slot : line.adjustment.code,
    );
    expect(lines).toEqual(['soup', 'main', 'soup_charge', 'side', 'pickle', 'dessert']);
  });
});

describe('priceCart', () => {
  const answer = (state: CartState, date: string, ...choices: Choice[]) =>
    changeForm(state, date, (form) => choices.reduce(choose, form));

  it('prices each day with its own delivery fee and totals the submission', () => {
    let state = answer(emptyCart, thu, { slot: 'soup', id: 'cs-gulyas' });
    state = changeForm(state, thu, (form) => stepExtra(form, 'doboz', 1));
    state = addMenu(state, thu, menu);
    state = addMenu(
      answer(state, wed, { slot: 'soup', id: null }, main('sze-paprikas-csirke')),
      wed,
      menu,
    );
    state = addMenu(
      answer(state, wed, { slot: 'soup', id: 'sze-husleves' }, main('cezarsalata')),
      wed,
      menu,
    );

    const cart = priceCart(state, menu, config);
    expect(cart.days.map((day) => day.date)).toEqual([wed, thu]);
    expect(cart.days.map((day) => day.priced.foodSubtotal)).toEqual([920 + 2100, 650 + 100]);
    expect(cart.days.map((day) => day.priced.deliveryFee)).toEqual([150, 150]);
    expect(cart.menuCount).toBe(3);
    expect(cart.foodSubtotal).toBe(3770);
    expect(cart.deliveryFee).toBe(300);
    expect(cart.total).toBe(4070);
  });

  it('is empty for an empty cart', () => {
    expect(priceCart(emptyCart, menu, config)).toEqual({
      days: [],
      menuCount: 0,
      foodSubtotal: 0,
      deliveryFee: 0,
      total: 0,
    });
  });
});
