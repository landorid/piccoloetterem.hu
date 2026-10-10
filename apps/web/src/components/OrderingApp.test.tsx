// @vitest-environment jsdom
import { maxExtraQuantity } from '@piccolo/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forint } from '../format';
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

  it('keeps "Hozzáadás" disabled until the soup is answered and the main has its variation and side', async () => {
    await renderOrderPage();
    expect(addButton()).toHaveProperty('disabled', true);

    pickMain('Rántott szelet');
    expect(addButton()).toHaveProperty('disabled', true);
    expect(within(composer()).getByText('Válassz változatot.')).toBeTruthy();

    fireEvent.click(within(block(/^Változat/)).getByRole('radio', { name: 'Csirkemell' }));
    expect(addButton()).toHaveProperty('disabled', true);
    fireEvent.click(within(block(/^Köret/)).getByRole('radio', { name: 'Párolt rizs' }));
    expect(addButton()).toHaveProperty('disabled', true);
    expect(within(composer()).getByText(strings.composer.unanswered)).toBeTruthy();

    pickSoup(strings.composer.none);
    expect(addButton()).toHaveProperty('disabled', false);
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

describe('the day cart', () => {
  it('counts menus on the day tab, and removing the last menu drops the day with its extras', async () => {
    await renderOrderPage();
    pickSoup('Brokkolikrémleves');
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
    fireEvent.click(addButton());
    pickSoup('Brokkolikrémleves');
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

describe('the day rail', () => {
  it('lets a closed day be selected to say it cannot be ordered, and disables past days', async () => {
    answer = { ...openMenu, orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'] };
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

  it('keeps a selected closed day when the tab comes back to the same menu', async () => {
    answer = { ...openMenu, orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'] };
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
