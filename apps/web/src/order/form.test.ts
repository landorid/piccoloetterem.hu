import { maxExtraQuantity, orderMessagesHu } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { strings } from '../strings';
import { dish, openMenu } from '../test/fixtures';
import {
  type Choice,
  choose,
  emptyForm,
  formStatus,
  formSteps,
  fromComposedMenu,
  type MenuForm,
  stepExtra,
  toComposedMenu,
} from './form';

const menu = openMenu.menu;
const wed = '2026-09-09';

const fill = (...choices: Choice[]): MenuForm => choices.reduce(choose, emptyForm());
const main = (id: string, variation?: string): Choice => ({
  slot: 'main',
  item: dish(id),
  variation,
});

describe('choose', () => {
  it('takes the variation with the main, and drops it with the next main', () => {
    const form = fill(main('sze-rantott-szelet', 'Csirkemell'));
    expect(form).toMatchObject({ mainId: 'sze-rantott-szelet', variation: 'Csirkemell' });
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

describe('formSteps', () => {
  const steps = (form: MenuForm, publicMenu = menu) => formSteps(form, publicMenu, wed);

  it('opens the main once the soup is answered, and the rest once the main is', () => {
    expect(steps(emptyForm())).toEqual({ soupAnswered: false, mainAnswered: false });
    const declined = fill({ slot: 'soup', id: null });
    expect(steps(declined)).toEqual({ soupAnswered: true, mainAnswered: false });
    expect(steps(choose(declined, { slot: 'main', item: null }))).toEqual({
      soupAnswered: true,
      mainAnswered: true,
    });
  });

  it('starts at the main on a day without soups', () => {
    const noSoups = { ...menu, days: { ...menu.days, 3: { ...menu.days[3], soups: [] } } };
    expect(steps(emptyForm(), noSoups).soupAnswered).toBe(true);
  });

  it('brings a committed menu back with both steps answered', () => {
    expect(steps(fromComposedMenu({ soupId: 'sze-brokkoli' }))).toEqual({
      soupAnswered: true,
      mainAnswered: true,
    });
  });
});

describe('formStatus', () => {
  const status = (form: MenuForm, date = wed) => formStatus(form, menu, date);

  it('does not let an untouched form be added, and says what to answer first', () => {
    expect(status(emptyForm())).toEqual({
      canAdd: false,
      message: strings.composer.unanswered,
    });
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
    const varied = choose(form, main('sze-rantott-szelet', 'Csirkemell'));
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

  it('wants the main answered after the soup, and "Nem kérek" is an answer', () => {
    const form = fill({ slot: 'soup', id: 'sze-brokkoli' });
    expect(status(form)).toEqual({ canAdd: false, message: strings.composer.mainUnanswered });
    expect(status(choose(form, { slot: 'main', item: null }))).toEqual({
      canAdd: true,
      message: null,
    });
  });

  it('asks for a dish when the soup and the main are declined and nothing else is chosen', () => {
    expect(status(fill({ slot: 'soup', id: null }, { slot: 'main', item: null }))).toEqual({
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
