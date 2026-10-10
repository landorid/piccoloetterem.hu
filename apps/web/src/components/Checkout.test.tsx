// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forint } from '../format';
import { customerStorageKey } from '../order/checkout';
import { storageKey } from '../order/store';
import { strings } from '../strings';
import { openMenu, publicConfig } from '../test/fixtures';
import { OrderingApp } from './OrderingApp';

const { checkout, errors, success } = strings;

let menuAnswer: unknown;
/** What `POST /api/orders` answers next; each call takes the next reply, the last one repeats. */
let orderReplies: Array<() => Promise<Response>>;
const orderBodies: unknown[] = [];

const stored = (body: { days: Array<{ deliveryDate: string }> }) =>
  Response.json(
    {
      submissionId: 'sub-1',
      orders: body.days.map((day, i) => ({
        id: `order-${i + 1}`,
        deliveryDate: day.deliveryDate,
        total: 999 + i,
      })),
      grandTotal: 4321,
    },
    { status: 201 },
  );

beforeEach(() => {
  menuAnswer = openMenu;
  orderBodies.length = 0;
  orderReplies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/menu')) return Response.json(menuAnswer);
      if (url.includes('/api/orders') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        orderBodies.push(body);
        const reply = orderReplies.length > 1 ? orderReplies.shift() : orderReplies[0];
        return reply ? reply() : stored(body);
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const wednesdayMorning = () => new Date(2026, 8, 9, 8, 0);
/** Testing Library matches text with its spaces collapsed; `forint` writes a no-break space. */
const spaced = (text: string) => text.replace(/\s+/g, ' ');
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

async function renderOrderPage() {
  const view = render(<OrderingApp initial={{ config: publicConfig }} now={wednesdayMorning} />);
  await screen.findByRole('region', { name: /menü összeállítása$/ });
  await settle();
  return view;
}

const composer = () => screen.getByRole('region', { name: /menü összeállítása$/ });

function addMenu({ soup, main, day }: { soup: string; main?: string; day?: RegExp }) {
  if (day) fireEvent.click(screen.getByRole('tab', { name: day }));
  const soups = within(composer()).getByRole('group', { name: /^Leves/ });
  fireEvent.click(within(soups).getByRole('radio', { name: soup }));
  if (main) {
    fireEvent.click(within(composer()).getByRole('button', { name: /^Főétel: Válassz$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: main }));
  }
  fireEvent.click(within(composer()).getByRole('button', { name: strings.composer.add }));
}

async function toCheckout() {
  fireEvent.click(screen.getAllByRole('button', { name: strings.summary.continue })[0] as Element);
  return screen.findByRole('heading', { name: checkout.title });
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const name = () => field(/^Név/);
const phone = () => field(/^Telefonszám/);
const email = () => field(/^E-mail cím/);
const address = () => field(/^Szállítási cím/);
const submitButton = () => screen.getByRole('button', { name: /Rendelés elküldése|Küldés/ });

function fillContact() {
  fireEvent.change(name(), { target: { value: 'Kovács Anna' } });
  fireEvent.change(phone(), { target: { value: '06 30 123 4567' } });
  fireEvent.change(email(), { target: { value: 'anna@example.hu' } });
  fireEvent.change(address(), { target: { value: 'Szombathely, Fő tér 1.' } });
}

async function submit() {
  fireEvent.click(submitButton());
  await settle();
}

describe('checkout', () => {
  it('names each day under the minimum with its difference, and does not block on it', async () => {
    await renderOrderPage();
    addMenu({ soup: 'Brokkolikrémleves' });
    addMenu({ soup: strings.composer.none, main: 'Paprikás csirke' });
    addMenu({ soup: 'Gulyásleves', day: /^Csütörtök/ });
    expect(await toCheckout()).toBe(document.activeElement);

    expect(screen.getByText(checkout.minimumTitle)).toBeTruthy();
    // Wednesday: 650 + 920 = 1570, 630 short of 2200. Thursday: a soup alone, 1550 short.
    expect(
      screen.getByText(spaced(checkout.minimumDay('Szerda, szept. 9.', forint(630)))),
    ).toBeTruthy();
    expect(
      screen.getByText(spaced(checkout.minimumDay('Csütörtök, szept. 10.', forint(1550)))),
    ).toBeTruthy();
    expect(submitButton()).toHaveProperty('disabled', false);

    fillContact();
    await submit();
    expect(await screen.findByRole('heading', { name: success.title })).toBeTruthy();
  });

  it('checks the fields on blur and on submit, with a summary, and sends nothing while one is wrong', async () => {
    await renderOrderPage();
    addMenu({ soup: 'Brokkolikrémleves' });
    await toCheckout();

    fireEvent.change(phone(), { target: { value: '123' } });
    fireEvent.blur(phone());
    expect(screen.getByText(checkout.errors.phoneInvalid)).toBeTruthy();
    expect(phone().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(phone(), { target: { value: '06 30 123 4567' } });
    expect(screen.queryByText(checkout.errors.phoneInvalid)).toBeNull();

    // Pressing submit leaves focus in the field, so no blur error moves the button mid-click.
    expect(fireEvent.mouseDown(submitButton())).toBe(false);
    await submit();
    expect(screen.getByText(checkout.errors.summary)).toBeTruthy();
    expect(screen.getByText(checkout.errors.nameRequired)).toBeTruthy();
    expect(screen.getByText(checkout.errors.emailRequired)).toBeTruthy();
    expect(screen.getByText(checkout.errors.addressRequired)).toBeTruthy();
    expect(document.activeElement).toBe(name());
    expect(orderBodies).toHaveLength(0);
  });

  it('sends the cart once, empties it, remembers the guest and prefills the next checkout', async () => {
    const first = await renderOrderPage();
    addMenu({ soup: 'Brokkolikrémleves' });
    addMenu({ soup: 'Gulyásleves', day: /^Csütörtök/ });
    await toCheckout();
    fillContact();
    fireEvent.change(field(/^Megjegyzés/), { target: { value: 'A portán.' } });

    let release: () => void = () => {};
    orderReplies = [
      () =>
        new Promise((resolve) => {
          release = () => resolve(stored(orderBodies[0] as never));
        }),
    ];
    fireEvent.click(submitButton());
    fireEvent.click(submitButton());
    await settle();
    expect(orderBodies).toHaveLength(1);
    expect(submitButton().textContent).toBe(checkout.submitting);
    expect(submitButton()).toHaveProperty('disabled', true);

    expect(orderBodies[0]).toEqual({
      name: 'Kovács Anna',
      phone: '06 30 123 4567',
      email: 'anna@example.hu',
      address: 'Szombathely, Fő tér 1.',
      note: 'A portán.',
      days: [
        {
          deliveryDate: '2026-09-09',
          fulfilment: 'delivery',
          menus: [{ soupId: 'sze-brokkoli' }],
          extras: [],
        },
        {
          deliveryDate: '2026-09-10',
          fulfilment: 'delivery',
          menus: [{ soupId: 'cs-gulyas' }],
          extras: [],
        },
      ],
    });

    await act(async () => release());
    expect(await screen.findByRole('heading', { name: success.title })).toBe(
      document.activeElement,
    );
    expect(screen.getByText(success.lead('anna@example.hu'))).toBeTruthy();
    expect(screen.getByText(success.orderId('order-1'))).toBeTruthy();
    expect(screen.getByText(success.orderId('order-2'))).toBeTruthy();
    expect(screen.getByText(spaced(forint(4321)))).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(customerStorageKey) ?? '{}')).toEqual({
      name: 'Kovács Anna',
      phone: '06 30 123 4567',
      email: 'anna@example.hu',
      address: 'Szombathely, Fő tér 1.',
    });
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? '{}').state.menusByDate).toEqual({});

    // A reload after success: an empty cart, and the next checkout is prefilled.
    first.unmount();
    await renderOrderPage();
    expect(screen.queryByRole('tab', { name: /menü a kosárban/ })).toBeNull();
    addMenu({ soup: 'Brokkolikrémleves' });
    await toCheckout();
    expect(name().value).toBe('Kovács Anna');
    expect(address().value).toBe('Szombathely, Fő tér 1.');
    expect(field(/^Megjegyzés/).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: checkout.forgetLabel }));
    expect(name().value).toBe('');
    expect(localStorage.getItem(customerStorageKey)).toBeNull();
  });

  it('sends the honeypot when something filled it', async () => {
    await renderOrderPage();
    addMenu({ soup: 'Brokkolikrémleves' });
    await toCheckout();
    fillContact();
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.autocomplete).toBe('off');
    fireEvent.change(honeypot, { target: { value: 'http://spam.example' } });
    await submit();
    expect(orderBodies[0]).toMatchObject({ website: 'http://spam.example' });
  });
});

describe('a refused submission', () => {
  async function checkoutWith(menus: Array<Parameters<typeof addMenu>[0]>) {
    await renderOrderPage();
    for (const menu of menus) addMenu(menu);
    await toCheckout();
    fillContact();
  }

  it('lists a sold-out dish, shows it marked in the cart, and goes through once it is replaced', async () => {
    await checkoutWith([{ soup: strings.composer.none, main: 'Paprikás csirke' }]);
    orderReplies = [
      async () =>
        Response.json(
          { error: 'validation', fields: { 'days.0.menus.0.mainId': 'sold_out' } },
          { status: 409 },
        ),
      async () => stored(orderBodies[1] as never),
    ];
    await submit();

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(errors.soldOutTitle)).toBeTruthy();
    expect(
      within(alert).getByText(
        errors.soldOutItem('Szerda, szept. 9.', '1. menü', 'Paprikás csirke'),
      ),
    ).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: errors.soldOutAction }));
    await settle();
    const cart = screen.getByRole('heading', { name: strings.cart.title }).closest('.card');
    const menu = (cart as HTMLElement).querySelector('.cart-menu.is-gone') as HTMLElement;
    expect(within(menu).getByText(strings.dish.soldOut)).toBeTruthy();
    expect(document.activeElement).toBe(menu);

    fireEvent.click(within(menu).getByRole('button', { name: strings.cart.remove }));
    addMenu({ soup: 'Brokkolikrémleves' });
    await toCheckout();
    expect(name().value).toBe('');
    fillContact();
    await submit();
    expect(await screen.findByRole('heading', { name: success.title })).toBeTruthy();
    expect(orderBodies).toHaveLength(2);
  });

  it('removes a day whose cutoff passed, says so, refetches the menu and keeps the rest', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }, { soup: 'Gulyásleves', day: /^Csütörtök/ }]);
    orderReplies = [
      async () =>
        Response.json(
          { error: 'validation', fields: { 'days.0.deliveryDate': 'cutoff_passed' } },
          { status: 409 },
        ),
    ];
    menuAnswer = { ...openMenu, orderableDates: ['2026-09-10', '2026-09-11', '2026-09-12'] };
    await submit();

    expect(screen.getByText(errors.cutoffTitle)).toBeTruthy();
    expect(screen.getByText(errors.cutoffSubmitBody('Szerda, szept. 9.', '9:30'))).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Szerda, szept. 9.' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Csütörtök, szept. 10.' })).toBeTruthy();
    const menuFetches = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes('/api/menu')).length;
    expect(menuFetches).toBe(2);
    // The refetch found nothing more to drop, so the menu screen has no second explanation.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(checkout.back) }));
    expect(screen.queryByText(errors.cutoffTitle)).toBeNull();
  });

  it('removes a day staff closed meanwhile with its own explanation', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }, { soup: 'Gulyásleves', day: /^Csütörtök/ }]);
    orderReplies = [
      async () =>
        Response.json(
          {
            error: 'date_closed',
            dates: ['2026-09-10'],
            fields: { 'days.1.deliveryDate': 'date_closed' },
          },
          { status: 409 },
        ),
    ];
    await submit();
    expect(screen.getByText(errors.closedTitle)).toBeTruthy();
    expect(screen.getByText(errors.closedBody('Csütörtök, szept. 10.'))).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Csütörtök, szept. 10.' })).toBeNull();
  });

  it('marks the fields the API refused', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }]);
    orderReplies = [
      async () =>
        Response.json({ error: 'validation', fields: { email: 'invalid_email' } }, { status: 400 }),
    ];
    await submit();
    expect(screen.getByText(checkout.errors.emailInvalid)).toBeTruthy();
    expect(document.activeElement).toBe(email());
  });

  it('keeps the cart after a network failure and sends it again on retry', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }]);
    orderReplies = [
      async () => {
        throw new TypeError('Failed to fetch');
      },
      async () => stored(orderBodies[1] as never),
    ];
    await submit();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(errors.submitFailedTitle)).toBeTruthy();
    expect(
      within(alert).getByText(errors.submitFailedBody(publicConfig.contact.phone)),
    ).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: errors.resubmit }));
    expect(await screen.findByRole('heading', { name: success.title })).toBeTruthy();
    expect(orderBodies).toHaveLength(2);
  });

  it('asks the guest to wait a few minutes after 429', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }]);
    orderReplies = [
      async () => Response.json({ error: 'rate_limited', message: 'x' }, { status: 429 }),
    ];
    await submit();
    expect(screen.getByText(errors.rateLimitedTitle)).toBeTruthy();
    expect(submitButton()).toHaveProperty('disabled', false);
  });

  it('says the cart cannot be accepted when nothing in the form can fix it', async () => {
    await checkoutWith([{ soup: 'Brokkolikrémleves' }]);
    orderReplies = [
      async () =>
        Response.json(
          { error: 'validation', fields: { 'days.0.menus.0.variation': 'not_allowed' } },
          { status: 400 },
        ),
    ];
    await submit();
    expect(screen.getByText(errors.rejectedTitle)).toBeTruthy();
  });
});
