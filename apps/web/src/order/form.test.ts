import { maxExtraQuantity, orderMessagesHu } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { strings } from '../strings';
import { dish, openMenu } from '../test/fixtures';
import {
  type Choice,
  choose,
  emptyForm,
  formStatus,
  fromComposedMenu,
  type MenuForm,
  stepExtra,
  toComposedMenu,
} from './form';

const menu = openMenu.menu;
const wed = '2026-09-09';

const fill = (...choices: Choice[]): MenuForm => choices.reduce(choose, emptyForm());
const main = (id: string): Choice => ({ slot: 'main', item: dish(id) });

describe('choose', () => {
  it('clears the variation when the main changes', () => {
    const form = fill(main('sze-rantott-szelet'), { slot: 'variation', value: 'Csirkemell' });
    expect(choose(form, main('sze-sertessult')).variation).toBeNull();
  });

  it('keeps the side only if the new main needs one too', () => {
    const withSide = fill(main('sze-rantott-szelet'), { slot: 'side', id: 'parolt-rizs' });
    expect(choose(withSide, main('sze-sertessult')).sideId).toBe('parolt-rizs');
    expect(choose(withSide, main('sze-paprikas-csirke')).sideId).toBeNull();
    expect(choose(withSide, { slot: 'main', item: null }).sideId).toBeNull();
  });
});

describe('stepExtra', () => {
  it('counts up to the maximum and no further', () => {
    let form = emptyForm();
    for (let i = 0; i < maxExtraQuantity + 3; i++) form = stepExtra(form, 'doboz', 1);
    expect(form.extras).toEqual({ doboz: maxExtraQuantity });
  });

  it('drops the extra at zero instead of keeping a 0', () => {
    const form = stepExtra(stepExtra(emptyForm(), 'kenyer', 1), 'kenyer', -1);
    expect(form.extras).toEqual({});
    expect(stepExtra(form, 'kenyer', -1).extras).toEqual({});
  });
});

describe('toComposedMenu and fromComposedMenu', () => {
  it('leaves unanswered and declined slots out of the menu', () => {
    const form = fill(main('sze-paprikas-csirke'), { slot: 'pickle', id: null });
    expect(toComposedMenu(form)).toEqual({ mainId: 'sze-paprikas-csirke' });
  });

  it('brings a committed menu back with its soup answered, declined when it had none', () => {
    expect(fromComposedMenu({ mainId: 'sze-paprikas-csirke' }).soupId).toBeNull();
    expect(fromComposedMenu({ soupId: 'sze-husleves' }).soupId).toBe('sze-husleves');
  });
});

describe('formStatus', () => {
  const status = (form: MenuForm, date = wed) => formStatus(form, menu, date);

  it('says nothing about an untouched form, and does not let it be added', () => {
    expect(status(emptyForm())).toEqual({ canAdd: false, message: null });
  });

  it('wants the soup answered, and "Nem kérek" is an answer', () => {
    const form = fill(main('sze-paprikas-csirke'));
    expect(status(form)).toEqual({ canAdd: false, message: strings.composer.unanswered });
    expect(status(choose(form, { slot: 'soup', id: null }))).toEqual({
      canAdd: true,
      message: null,
    });
  });

  it('names a missing variation before a missing side, and both before the soup', () => {
    const form = fill(main('sze-rantott-szelet'));
    expect(status(form).message).toBe(orderMessagesHu.variation_required);
    const varied = choose(form, { slot: 'variation', value: 'Csirkemell' });
    expect(status(varied).message).toBe(orderMessagesHu.side_required);
    const sided = choose(varied, { slot: 'side', id: 'parolt-rizs' });
    expect(status(sided).message).toBe(strings.composer.unanswered);
  });

  it('refuses a sold-out dish', () => {
    const form = fill({ slot: 'soup', id: null }, main('sze-gombas-csirkemell'), {
      slot: 'side',
      id: 'parolt-rizs',
    });
    expect(status(form)).toEqual({ canAdd: false, message: orderMessagesHu.sold_out });
  });

  it('asks for a dish when the soup is declined and nothing else is chosen', () => {
    expect(status(fill({ slot: 'soup', id: null }))).toEqual({
      canAdd: false,
      message: strings.composer.emptyMenu,
    });
  });

  it('takes the soup as declined on a day without soups', () => {
    const noSoups = {
      ...menu,
      days: { ...menu.days, 3: { ...menu.days[3], soups: [] } },
    };
    expect(formStatus(fill(main('sze-paprikas-csirke')), noSoups, wed).canAdd).toBe(true);
  });
});
