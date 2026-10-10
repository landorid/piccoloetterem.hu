import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/QueryProvider';
import { SummaryPage } from '@/pages/SummaryPage';
import type { DaySummary, DeliveryList } from '@/pages/summary/queries';
import { strings } from '@/strings';

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: async () => {} }),
  getToken: async () => 'session-token',
}));

const date = '2026-10-14';

function summaryOf(day: string): DaySummary {
  return {
    date: day,
    orderCount: 3,
    menuCount: 5,
    revenue: 12_345,
    deliveryCount: 2,
    pickupCount: 1,
    dishes: {
      soup: [{ name: 'Gulyásleves', variation: null, count: 4 }],
      main: [
        { name: 'Cordon bleu', variation: 'csirke', count: 3 },
        { name: 'Rántott sajt', variation: null, count: 2 },
      ],
      side: [{ name: 'Hasábburgonya', variation: null, count: 2 }],
      pickle: [],
      dessert: [{ name: 'Somlói galuska', variation: null, count: 1 }],
    },
    extras: [{ key: 'box', name: 'Doboz', quantity: 6 }],
  };
}

function listOf(day: string): DeliveryList {
  return {
    date: day,
    orders: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Kiss Anna',
        phone: '+36301234567',
        address: 'Ady Endre utca 2.',
        menuCount: 2,
        total: 4_550,
        note: 'Kapucsengő: 12',
        status: 'received',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Nagy Béla',
        phone: '+36209876543',
        address: '',
        menuCount: 1,
        total: 2_350,
        note: null,
        status: 'processed',
      },
    ],
  };
}

let summary: (day: string) => DaySummary;
let list: (day: string) => DeliveryList;
const requests: string[] = [];

beforeEach(() => {
  summary = summaryOf;
  list = listOf;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push(`${url.pathname}${url.search}`);
      const day = url.searchParams.get('date') ?? '';
      const body = url.pathname.endsWith('/summary')
        ? summary(day)
        : url.pathname.endsWith('/delivery-list')
          ? list(day)
          : { name: 'Piccolo Club Étterem' };
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  requests.length = 0;
});

function renderPage(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/osszesito${search}`]}>
      <QueryProvider>
        <SummaryPage />
      </QueryProvider>
    </MemoryRouter>,
  );
}

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .map((row) => row.textContent);

describe('SummaryPage', () => {
  it("shows the day's counts and each slot's dishes, mains first, in the API's order", async () => {
    renderPage(`?date=${date}`);

    const mains = await screen.findByRole('region', { name: strings.summary.slots.main });
    expect(rowsOf(mains)).toEqual(['NévVariációDarab', 'Cordon bleucsirke3', 'Rántott sajt2']);
    expect(rowsOf(screen.getByRole('region', { name: strings.summary.slots.soup }))).toEqual([
      'NévDarab',
      'Gulyásleves4',
    ]);
    expect(
      screen.getByRole('region', { name: strings.summary.slots.pickle }).textContent,
    ).toContain(strings.summary.noneInSlot);
    expect(rowsOf(screen.getByRole('region', { name: strings.summary.extras }))).toEqual([
      'NévDarab',
      'Doboz6',
    ]);
    expect(
      screen.getAllByRole('region').map((region) => region.querySelector('h2')?.textContent),
    ).toEqual([
      strings.summary.slots.main,
      strings.summary.slots.soup,
      strings.summary.slots.side,
      strings.summary.slots.pickle,
      strings.summary.slots.dessert,
      strings.summary.extras,
    ]);

    const cards = document.body.textContent ?? '';
    expect(cards).toContain(`${strings.summary.cards.orders}3`);
    expect(cards).toContain(`${strings.summary.cards.menus}5`);
    expect(cards).toContain(`${strings.summary.cards.fulfilment}2 / 1`);
    expect(cards).toContain(`${strings.summary.cards.revenue}${strings.summary.money(12_345)}`);
    expect(requests).toContain(`/api/admin/orders/summary?date=${date}`);
  });

  it('lists deliveries by the API order, with a paper-only tick column and no minimum', async () => {
    renderPage(`?date=${date}&tab=delivery`);

    const table = await screen.findByRole('table');
    expect(rowsOf(table).slice(1)).toEqual([
      `Kiss Anna+36301234567Ady Endre utca 2.2${strings.summary.money(4_550)}Kapucsengő: 12${strings.summary.statuses.received}`,
      `Nagy Béla+36209876543${strings.summary.pickup}1${strings.summary.money(2_350)}${strings.summary.statuses.processed}`,
      `${strings.summary.deliveryTotal(2)}3${strings.summary.money(6_900)}`,
    ]);
    const tick = within(table).getByRole('columnheader', {
      name: strings.summary.columns.handedOver,
    });
    expect(tick.className).toMatch(/(^| )hidden( |$)/);
    expect(tick.className).toContain('print:table-cell');
    expect(table.textContent).not.toMatch(/minimum/i);
  });

  it('shows a status change made elsewhere after one 60 s refresh, on both tabs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage(`?date=${date}&tab=delivery`);
    const table = await screen.findByRole('table');
    expect(table.textContent).toContain(strings.summary.statuses.received);

    list = (day) => {
      const { orders } = listOf(day);
      return { date: day, orders: orders.map((order) => ({ ...order, status: 'processed' })) };
    };
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(table.textContent).not.toContain(strings.summary.statuses.received);

    fireEvent.mouseDown(screen.getByRole('tab', { name: strings.summary.tabs.kitchen }));
    await screen.findByRole('region', { name: strings.summary.slots.main });
    summary = (day) => ({ ...summaryOf(day), orderCount: 2, menuCount: 3 });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(document.body.textContent).toContain(`${strings.summary.cards.menus}3`);
  });

  it('steps to the next day, prints, and says when a day has no orders', async () => {
    summary = (day) => ({
      ...summaryOf(day),
      orderCount: 0,
      menuCount: 0,
      revenue: 0,
      deliveryCount: 0,
      pickupCount: 0,
    });
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderPage(`?date=${date}`);
    await screen.findByText(strings.summary.noOrders.title);

    fireEvent.click(screen.getByRole('button', { name: strings.dayNavigator.next }));
    await vi.waitFor(() => expect(requests).toContain('/api/admin/orders/summary?date=2026-10-15'));
    await screen.findByText(strings.summary.noOrders.title);

    fireEvent.click(screen.getByRole('button', { name: strings.summary.print }));
    expect(print).toHaveBeenCalledOnce();
  });
});
