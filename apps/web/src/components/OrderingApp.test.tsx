// @vitest-environment jsdom
import { maxExtraQuantity, orderMessagesHu } from '@piccolo/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forint } from '../format';
import { storageKey } from '../order/store';
import { strings } from '../strings';
import { openMenu, publicConfig } from '../test/fixtures';
import { OrderingApp } from './OrderingApp';

let answer: unknown;

beforeEach(() => {
  answer = openMenu;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/api/menu')
        ? Response.json(answer)
        : Response.json({ error: 'not_found' }, { status: 404 }),
    ),
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

/** Wednesday 9 September 2026, 08:00: Monday and Tuesday are past, Wednesday is orderable. */
const wednesdayMorning = () => new Date(2026, 8, 9, 8, 0);

async function renderOrderPage() {
  const view = render(<OrderingApp initial={{ config: publicConfig }} now={wednesdayMorning} />);
  await screen.findByRole('region', { name: /menü összeállítása$/ });
  // The page mounts after an async fetch, outside act. React subscribes its components to the
  // store in passive effects, so a click in the very tick of the commit would change the store
  // before they listen and the DOM would catch up too late for the assertion. A guest cannot
  // click that fast; the tests wait for the effects.
  await settle();
  return view;
}

const composer = () => screen.getByRole('region', { name: /menü összeállítása$/ });
const block = (name: RegExp) => within(composer()).getByRole('group', { name });
const footerPrice = () => composer().querySelector('.foot-price')?.textContent;
const addButton = () => within(composer()).getByRole('button', { name: strings.composer.add });
const cart = () => screen.getByRole('heading', { name: strings.cart.title }).closest('.card');
const grandTotal = () => document.querySelector('.only-desktop .grand .amt')?.textContent;
const tab = (name: RegExp) => screen.getByRole('tab', { name });

/** The tab comes back into view, which refetches the menu. */
function comeBack() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  fireEvent(document, new Event('visibilitychange'));
}

/** Lets a pending refetch finish when the screen shows nothing to wait for. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const menuFetches = () =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/api/menu')).length;

function pickSoup(name: string) {
  fireEvent.click(within(block(/^Leves/)).getByRole('radio', { name }));
}

function pickMain(name: string) {
  fireEvent.click(
    within(composer()).getByRole('button', { name: /^Főétel: Válassz$| — Módosítás$/ }),
  );
  const dialog = screen.getByRole('dialog', { name: strings.composer.pickerTitle('Főétel') });
  fireEvent.click(within(dialog).getByRole('button', { name }));
}

describe('the order form', () => {
  it("composes O1's worked examples at the tested prices, and the summary adds the delivery fee", async () => {
    await renderOrderPage();

    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    expect(footerPrice()).toBe(forint(650));
    fireEvent.click(addButton());
    expect(grandTotal()).toBe(forint(650 + 150));
    expect(document.querySelector('.only-desktop .grand .amt')?.getAttribute('aria-live')).toBe(
      'polite',
    );

    pickSoup(strings.composer.none);
    pickMain('Paprikás csirke');
    expect(footerPrice()).toBe(forint(920));
    fireEvent.click(addButton());
    expect(grandTotal()).toBe(forint(650 + 920 + 150));

    pickSoup('Húsleves cérnametélttel');
    pickMain('Csirkés cézársaláta');
    expect(footerPrice()).toBe(forint(2100));
    fireEvent.click(addButton());
    expect(grandTotal()).toBe(forint(650 + 920 + 2100 + 150));
    expect(within(cart() as HTMLElement).getByText(strings.cart.menuNumber(3))).toBeTruthy();
  });

  it('disables the days whose intake is over', async () => {
    await renderOrderPage();
    expect(tab(/^Hétfő/)).toHaveProperty('disabled', true);
    expect(tab(/^Hétfő/).title).toBe(strings.days.pastTitle);
    expect(tab(/^Szerda/)).toHaveProperty('disabled', false);
  });

  it('says why a menu cannot be added only once "Hozzáadás" is clicked, then keeps it current', async () => {
    await renderOrderPage();
    const message = () => composer().querySelector('.cf-foot .error')?.textContent ?? null;

    fireEvent.click(addButton());
    expect(message()).toBe(strings.composer.unanswered);
    expect(within(cart() as HTMLElement).getByText(strings.cart.empty)).toBeTruthy();

    pickSoup(strings.composer.none);
    expect(message()).toBe(strings.composer.mainUnanswered);

    pickMain('Rántott szelet — Csirkemell');
    expect(
      within(composer()).getByRole('button', {
        name: strings.composer.mainChosen('Rántott szelet — Csirkemell'),
      }),
    ).toBeTruthy();
    expect(within(composer()).queryByText(/^Változat/)).toBeNull();
    expect(block(/^Köret$/)).toBeTruthy();
    expect(message()).toBe(orderMessagesHu.side_required);

    fireEvent.click(within(block(/^Köret$/)).getByRole('radio', { name: 'Párolt rizs' }));
    expect(message()).toBeNull();
    fireEvent.click(addButton());
    expect(within(cart() as HTMLElement).queryByText(strings.cart.empty)).toBeNull();
    expect(message()).toBeNull();
  });

  it('keeps the main and then the rest blurred and inert until the steps before are answered', async () => {
    await renderOrderPage();
    const step = (label: RegExp) => (block(label) as HTMLElement).closest('.cf-step');
    const main = () =>
      within(composer()).getByText(strings.composer.slots.main).closest('.cf-step');
    const locked = (el: Element | null) => el?.hasAttribute('inert') === true;

    expect(locked(main())).toBe(true);
    expect(locked(step(/^Savanyúság$/))).toBe(true);

    pickSoup('Brokkolikrémleves');
    expect(locked(main())).toBe(false);
    expect(locked(step(/^Savanyúság$/))).toBe(true);

    pickMain(strings.composer.none);
    expect(
      within(composer()).getByRole('button', {
        name: strings.composer.mainChosen(strings.composer.none),
      }),
    ).toBeTruthy();
    expect(locked(step(/^Savanyúság$/))).toBe(false);

    fireEvent.click(within(composer()).getByRole('button', { name: strings.composer.reset }));
    expect(locked(main())).toBe(true);
    expect(locked(step(/^Savanyúság$/))).toBe(true);
  });

  it('lists each variation of a main as its own row in the picker', async () => {
    await renderOrderPage();
    fireEvent.click(within(composer()).getByRole('button', { name: strings.composer.mainPrompt }));
    const dialog = screen.getByRole('dialog');
    for (const variation of ['Sertéskaraj', 'Csirkemell', 'Trapista sajt']) {
      expect(
        within(dialog).getByRole('button', { name: `Rántott szelet — ${variation}` }),
      ).toBeTruthy();
    }
    expect(within(dialog).queryByRole('button', { name: 'Rántott szelet' })).toBeNull();
  });

  it('shows a sold-out dish but does not let it be chosen', async () => {
    await renderOrderPage();
    fireEvent.click(within(composer()).getByRole('button', { name: strings.composer.mainPrompt }));
    const dialog = screen.getByRole('dialog');
    const soldOut = within(dialog).getByRole('button', { name: 'Gombás csirkemell' });
    expect(
      within(dialog)
        .getByRole('button', { name: strings.composer.none })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(soldOut).toHaveProperty('disabled', true);
    expect(within(dialog).getByText(strings.dish.soldOut)).toBeTruthy();

    fireEvent.click(soldOut);
    fireEvent.click(within(dialog).getByRole('button', { name: strings.common.close }));
    expect(
      within(composer()).getByRole('button', { name: strings.composer.mainPrompt }),
    ).toBeTruthy();
  });
});

describe('what a guest selects', () => {
  const message = () => composer().querySelector('.cf-foot .error')?.textContent ?? null;
  const checked = (group: RegExp) =>
    within(block(group))
      .getAllByRole('radio')
      .filter((radio) => (radio as HTMLInputElement).checked)
      .map((radio) => radio.getAttribute('aria-label') ?? radio.closest('label')?.textContent);
  const menusInCart = () => within(cart() as HTMLElement).queryAllByText(/^\d+\. menü$/).length;

  it('drops the side with a main that needs none, and asks for one again with a main that does', async () => {
    await renderOrderPage();
    pickSoup('Húsleves cérnametélttel');
    pickMain('Rántott szelet — Csirkemell');
    fireEvent.click(within(block(/^Köret$/)).getByRole('radio', { name: 'Párolt rizs' }));

    pickMain('Paprikás csirke');
    expect(within(composer()).queryByRole('group', { name: /^Köret$/ })).toBeNull();
    expect(footerPrice()).toBe(forint(1020));

    pickMain('Rántott szelet — Csirkemell');
    fireEvent.click(addButton());
    expect(message()).toBe(orderMessagesHu.side_required);
    expect(menusInCart()).toBe(0);
  });

  it('keeps the side when only the variation changes', async () => {
    await renderOrderPage();
    pickSoup('Húsleves cérnametélttel');
    pickMain('Rántott szelet — Csirkemell');
    fireEvent.click(within(block(/^Köret$/)).getByRole('radio', { name: 'Párolt rizs' }));

    pickMain('Rántott szelet — Sertéskaraj');
    expect(
      (within(block(/^Köret$/)).getByRole('radio', { name: 'Párolt rizs' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    fireEvent.click(addButton());
    expect(within(cart() as HTMLElement).getByText(/Rántott szelet — Sertéskaraj/)).toBeTruthy();
  });

  it('charges a paid side on top of the main', async () => {
    await renderOrderPage();
    pickSoup('Húsleves cérnametélttel');
    pickMain('Sertéssült');
    fireEvent.click(within(block(/^Köret$/)).getByRole('radio', { name: /^Steak burgonya/ }));
    expect(footerPrice()).toBe(forint(1120 + 350));
  });

  it('reprices the menu as the soup is changed after the main', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain('Paprikás csirke');
    expect(footerPrice()).toBe(forint(1020));
    pickSoup(strings.composer.none);
    expect(footerPrice()).toBe(forint(920));
    pickSoup('Húsleves cérnametélttel');
    expect(footerPrice()).toBe(forint(1020));
  });

  it('wants a dish when soup and main are declined, extras alone do not count, a dessert does', async () => {
    await renderOrderPage();
    pickSoup(strings.composer.none);
    pickMain(strings.composer.none);
    fireEvent.click(within(block(/^Extra/)).getByRole('button', { name: 'Több: Doboz' }));
    fireEvent.click(addButton());
    expect(message()).toBe(strings.composer.emptyMenu);
    expect(menusInCart()).toBe(0);

    fireEvent.click(within(block(/^Desszert$/)).getByRole('radio', { name: /^Somlói galuska/ }));
    expect(message()).toBeNull();
    fireEvent.click(addButton());
    expect(menusInCart()).toBe(1);
    expect(grandTotal()).toBe(forint(690 + 100 + 150));
  });

  it('keeps each day’s half-built menu across day switches and a reload', async () => {
    const first = await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    fireEvent.click(tab(/^Csütörtök/));
    expect(checked(/^Leves/)).toEqual([]);
    pickSoup('Gulyásleves');

    fireEvent.click(tab(/^Szerda/));
    expect(
      (
        within(block(/^Leves/)).getByRole('radio', {
          name: 'Brokkolikrémleves',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);

    first.unmount();
    await renderOrderPage();
    expect(
      (
        within(block(/^Leves/)).getByRole('radio', {
          name: 'Brokkolikrémleves',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(tab(/^Csütörtök/));
    expect(
      (within(block(/^Leves/)).getByRole('radio', { name: 'Gulyásleves' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('keeps the main chosen before when the picker is closed or its backdrop is tapped', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain('Paprikás csirke');
    const chosen = () =>
      within(composer()).getByRole('button', {
        name: strings.composer.mainChosen('Paprikás csirke'),
      });

    fireEvent.click(chosen());
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: strings.common.close }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chosen()).toBeTruthy();

    fireEvent.click(chosen());
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chosen()).toBeTruthy();
  });

  it('adds one menu for a double tap on "Hozzáadás"', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    fireEvent.click(addButton());
    expect(menusInCart()).toBe(1);
  });

  it('starts with an empty cart when the stored one cannot be read', async () => {
    sessionStorage.setItem(storageKey, '{"state": {"menusByDate":');
    await renderOrderPage();
    expect(screen.queryByRole('tab', { name: /menü a kosárban/ })).toBeNull();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    expect(menusInCart()).toBe(1);
  });
});

describe('the day cart', () => {
  it('counts menus on the day tab, and removing the last menu drops the day with its extras', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(within(composer()).getByRole('button', { name: 'Több: Doboz' }));
    fireEvent.click(addButton());

    expect(tab(/^Szerda, szept\. 9\., 1 menü a kosárban/)).toBeTruthy();
    const day = within(cart() as HTMLElement);
    expect(day.getByText(strings.cart.extraLine('Doboz', 1))).toBeTruthy();

    fireEvent.click(day.getByRole('button', { name: strings.cart.remove }));
    expect(tab(/^Szerda, szept\. 9\.$/)).toBeTruthy();
    expect(
      within(cart() as HTMLElement).queryByText(strings.cart.extraLine('Doboz', 1)),
    ).toBeNull();
    expect(within(cart() as HTMLElement).getByText(strings.cart.empty)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: strings.cart.title }));
    expect(grandTotal()).toBeUndefined();
  });

  it('keeps the cart when the page is loaded again in the same tab', async () => {
    const first = await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    first.unmount();

    await renderOrderPage();
    expect(tab(/1 menü a kosárban/)).toBeTruthy();
    expect(within(cart() as HTMLElement).getByText(strings.cart.menuNumber(1))).toBeTruthy();
    expect(grandTotal()).toBe(forint(650 + 150));
  });

  it('drops a day that stopped being orderable when the tab comes back, and says why', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());

    answer = { ...openMenu, orderableDates: ['2026-09-10', '2026-09-11', '2026-09-12'] };
    comeBack();

    expect(await screen.findByText(strings.errors.cutoffTitle)).toBeTruthy();
    expect(screen.getByText(strings.errors.cutoffBody('Szerda', '9:30'))).toBeTruthy();
    expect(tab(/^Szerda/)).toHaveProperty('disabled', true);
    expect(tab(/^Csütörtök/).getAttribute('aria-selected')).toBe('true');
    expect(grandTotal()).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: strings.errors.cutoffAction }));
    expect(screen.queryByText(strings.errors.cutoffTitle)).toBeNull();
  });

  it('ignores an older refetch that answers after a newer one', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    const replies: ((menu: unknown) => void)[] = [];
    vi.mocked(fetch).mockImplementation(
      () => new Promise((resolve) => replies.push((menu) => resolve(Response.json(menu)))),
    );

    comeBack();
    comeBack();
    replies[1]?.({ ...openMenu, orderableDates: ['2026-09-10', '2026-09-11', '2026-09-12'] });
    expect(await screen.findByText(strings.errors.cutoffTitle)).toBeTruthy();
    replies[0]?.(openMenu);
    await settle();

    expect(tab(/^Szerda/)).toHaveProperty('disabled', true);
    expect(tab(/^Csütörtök/).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the screen and the cart when a refetch fails', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'internal' }, { status: 500 }));

    comeBack();
    await settle();

    expect(menuFetches()).toBe(2);
    expect(screen.queryByText(strings.errors.loadFailedTitle)).toBeNull();
    expect(tab(/^Szerda, szept\. 9\., 1 menü a kosárban/)).toBeTruthy();
    expect(grandTotal()).toBe(forint(650 + 150));
  });

  it('empties the cart and shows the message when a refetch finds nothing to order', async () => {
    const first = await renderOrderPage();
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());

    answer = { state: 'closed' };
    comeBack();
    expect(
      await screen.findByRole('heading', { name: strings.errors.emptyWeekTitle }),
    ).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    first.unmount();

    answer = openMenu;
    await renderOrderPage();
    expect(screen.queryByRole('tab', { name: /menü a kosárban/ })).toBeNull();
    expect(grandTotal()).toBeUndefined();
  });

  it('moves the extras with − and + only, adds them to the day and brings them back on edit', async () => {
    await renderOrderPage();
    const extras = () => within(block(/^Extra/));
    const more = () => extras().getByRole('button', { name: 'Több: Doboz' });

    expect(extras().queryByRole('button', { name: 'Kevesebb: Doboz' })).toBeNull();
    fireEvent.click(more());
    expect(extras().getByRole('button', { name: 'Kevesebb: Doboz' })).toBeTruthy();
    expect(extras().getByText('1')).toBeTruthy();
    expect(document.activeElement).toBe(more());

    fireEvent.click(extras().getByRole('button', { name: 'Kevesebb: Doboz' }));
    expect(extras().queryByRole('button', { name: 'Kevesebb: Doboz' })).toBeNull();
    expect(document.activeElement).toBe(more());

    for (let i = 0; i < maxExtraQuantity + 2; i++) fireEvent.click(more());
    expect(extras().getByText(String(maxExtraQuantity))).toBeTruthy();
    expect(more().getAttribute('aria-disabled')).toBe('true');
    extras().getByRole('button', { name: 'Kevesebb: Doboz' }).focus();
    more().focus();
    fireEvent.click(more());
    expect(document.activeElement).toBe(more());
    expect(extras().getByText(String(maxExtraQuantity))).toBeTruthy();

    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(addButton());
    pickSoup('Brokkolikrémleves');
    pickMain(strings.composer.none);
    fireEvent.click(extras().getByRole('button', { name: 'Több: Kenyér' }));
    fireEvent.click(addButton());
    const day = within(cart() as HTMLElement);
    expect(day.getByText(strings.cart.extraLine('Doboz', maxExtraQuantity))).toBeTruthy();
    expect(day.getByText(strings.cart.extraLine('Kenyér', 1))).toBeTruthy();

    fireEvent.click(day.getAllByRole('button', { name: strings.cart.edit })[0] as HTMLElement);
    expect(day.queryByText(strings.cart.extraLine('Kenyér', 1))).toBeNull();
    expect(extras().getByText(String(maxExtraQuantity))).toBeTruthy();
    expect(extras().getByRole('button', { name: 'Kevesebb: Kenyér' })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: strings.composer.formTitle(2) }),
    );
  });
});

describe("the phone's bar", () => {
  const bar = () => document.querySelector<HTMLElement>('.sumbar.only-mobile');
  const barButton = (name: string) => within(bar() as HTMLElement).getByRole('button', { name });

  it('stays away until a menu can be added, adds it, then leads to checkout', async () => {
    await renderOrderPage();
    expect(bar()).toBeNull();
    pickSoup('Brokkolikrémleves');
    expect(bar()).toBeNull();

    pickMain(strings.composer.none);
    expect(within(bar() as HTMLElement).getByText(strings.cart.menuNumber(1))).toBeTruthy();
    fireEvent.click(barButton(strings.summary.addToCart));

    expect(tab(/^Szerda, szept\. 9\., 1 menü a kosárban/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: strings.composer.formTitle(2) }),
    );
    expect(barButton(strings.summary.continue)).toHaveProperty('disabled', false);

    pickSoup('Brokkolikrémleves');
    expect(barButton(strings.summary.continue)).toBeTruthy();
    pickMain(strings.composer.none);
    expect(within(bar() as HTMLElement).getByText(strings.summary.nextMenu(2, 1))).toBeTruthy();
  });

  it("drops the form's message about a menu the bar added", async () => {
    await renderOrderPage();
    const message = () => composer().querySelector('.cf-foot .error');
    pickSoup('Brokkolikrémleves');
    fireEvent.click(addButton());
    expect(message()?.textContent).toBe(strings.composer.mainUnanswered);

    pickMain(strings.composer.none);
    fireEvent.click(barButton(strings.summary.addToCart));
    expect(message()).toBeNull();
  });
});

describe('the day rail', () => {
  it('lets a closed day be selected to say it cannot be ordered, and disables past days', async () => {
    answer = {
      ...openMenu,
      orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'],
      closedDates: ['2026-09-10'],
    };
    await renderOrderPage();

    expect(tab(/^Hétfő/)).toHaveProperty('disabled', true);
    const closed = tab(/^Csütörtök, szept\. 10\., Zárva$/);
    expect(closed).toHaveProperty('disabled', false);
    expect(closed.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(closed);
    expect(screen.getByText(strings.errors.closedDay)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /menü összeállítása$/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: strings.cart.title })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Csütörtök, szept. 10.' }),
    );
  });

  it('shows today closed, not past, when staff closed it and its intake is still open', async () => {
    answer = {
      ...openMenu,
      orderableDates: ['2026-09-10', '2026-09-11', '2026-09-12'],
      closedDates: ['2026-09-09'],
    };
    await renderOrderPage();

    expect(tab(/^Kedd/)).toHaveProperty('disabled', true);
    const today = tab(/^Szerda, szept\. 9\., Zárva$/);
    expect(today).toHaveProperty('disabled', false);
    expect(today.getAttribute('aria-disabled')).toBe('true');
    expect(tab(/^Csütörtök/).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText(strings.week.cutoffPassed('9:30'))).toBeNull();

    fireEvent.click(today);
    expect(screen.getByText(strings.errors.closedDay)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /menü összeállítása$/ })).toBeNull();
  });

  it('keeps a selected closed day when the tab comes back to the same menu', async () => {
    answer = {
      ...openMenu,
      orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'],
      closedDates: ['2026-09-10'],
    };
    await renderOrderPage();
    fireEvent.click(tab(/^Csütörtök/));

    comeBack();
    await settle();

    expect(menuFetches()).toBe(2);
    expect(screen.getByText(strings.errors.closedDay)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /menü összeállítása$/ })).toBeNull();
  });

  it('moves focus with the arrow keys and to the form when a day is selected', async () => {
    await renderOrderPage();
    expect(screen.getByText(strings.week.cutoffToday('9:30'))).toBeTruthy();

    const wednesday = tab(/^Szerda/);
    wednesday.focus();
    fireEvent.keyDown(wednesday, { key: 'ArrowRight' });
    const thursday = tab(/^Csütörtök/);
    expect(document.activeElement).toBe(thursday);
    expect(thursday.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(thursday);
    expect(thursday.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: strings.composer.formTitle(1) }),
    );
  });
});

describe('a week with nothing to order', () => {
  it.each([
    [{ state: 'next_week_not_published' }, strings.errors.nextWeekTitle],
    [{ state: 'closed' }, strings.errors.emptyWeekTitle],
  ])('shows the message and nothing else for %o', async (menu, title) => {
    answer = menu;
    render(<OrderingApp initial={{ config: publicConfig }} now={wednesdayMorning} />);
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('region', { name: /menü összeállítása$/ })).toBeNull();
    expect(screen.getByRole('link', { name: publicConfig.contact.phone })).toBeTruthy();
  });
});
