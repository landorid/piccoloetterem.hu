import { canChangeStatus, type OrderStatus, type StatusChange } from '@piccolo/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { OrdersPage } from '@/pages/OrdersPage';
import type { OrderDetail, OrderRow } from '@/pages/orders/queries';
import { paths } from '@/paths';
import { strings } from '@/strings';

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: async () => {} }),
  getToken: async () => 'session-token',
}));

const t = strings.orders;

const ids = {
  anna: '00000000-0000-4000-8000-000000000001',
  annaTuesday: '00000000-0000-4000-8000-000000000002',
  peter: '00000000-0000-4000-8000-000000000003',
  eva: '00000000-0000-4000-8000-000000000004',
  newcomer: '00000000-0000-4000-8000-000000000005',
};

function order(fields: Partial<OrderDetail> & Pick<OrderDetail, 'id' | 'name'>): OrderDetail {
  return {
    submissionId: `sub-${fields.id}`,
    customerId: `cust-${fields.id}`,
    deliveryDate: '2026-10-12',
    fulfilment: 'delivery',
    status: 'received',
    phone: '+36301234567',
    email: 'guest@example.test',
    address: 'Fő tér 2.',
    note: null,
    foodSubtotal: 2190,
    deliveryFee: 150,
    total: 2340,
    createdAt: '2026-10-09T05:00:00.000Z',
    processedAt: null,
    cancelledAt: null,
    menus: [
      {
        position: 1,
        price: 2190,
        items: [
          { slot: 'main', name: 'Rántott csirkemell', variation: null, unitPrice: 1890 },
          { slot: 'side', name: 'Hasábburgonya', variation: null, unitPrice: 300 },
        ],
        adjustments: [],
      },
    ],
    extras: [],
    siblings: [],
    ...fields,
  };
}

function initialOrders(): OrderDetail[] {
  return [
    order({
      id: ids.anna,
      name: 'Kiss Anna',
      phone: '+36301234567',
      createdAt: '2026-10-09T05:07:00.000Z',
      note: 'Kérem a kapucsengőt kétszer nyomni.',
      foodSubtotal: 4380,
      total: 4630,
      menus: [
        {
          position: 1,
          price: 2190,
          items: [
            { slot: 'soup', name: 'Gulyásleves', variation: null, unitPrice: 0 },
            { slot: 'main', name: 'Rántott csirkemell', variation: null, unitPrice: 1890 },
            { slot: 'side', name: 'Hasábburgonya', variation: null, unitPrice: 300 },
          ],
          adjustments: [],
        },
        {
          position: 2,
          price: 2090,
          items: [
            { slot: 'main', name: 'Cordon bleu', variation: 'csirke', unitPrice: 1890 },
            { slot: 'side', name: 'Párolt rizs', variation: null, unitPrice: 300 },
          ],
          adjustments: [{ code: 'no_soup_discount', amount: -100 }],
        },
      ],
      extras: [{ key: 'kenyer', name: 'Kenyér', quantity: 2, unitPrice: 50 }],
      siblings: [{ id: ids.annaTuesday, deliveryDate: '2026-10-13', status: 'received' }],
    }),
    order({
      id: ids.annaTuesday,
      name: 'Kiss Anna',
      deliveryDate: '2026-10-13',
      siblings: [{ id: ids.anna, deliveryDate: '2026-10-12', status: 'received' }],
    }),
    order({
      id: ids.peter,
      name: 'Nagy Péter',
      phone: '+36209876543',
      fulfilment: 'pickup',
      address: '',
      deliveryFee: 0,
      total: 2190,
      createdAt: '2026-10-09T05:14:00.000Z',
    }),
    order({
      id: ids.eva,
      name: 'Tóth Éva',
      phone: '+36701112233',
      createdAt: '2026-10-09T05:21:00.000Z',
    }),
  ];
}

function toRow(detail: OrderDetail): OrderRow {
  return {
    id: detail.id,
    name: detail.name,
    phone: detail.phone,
    address: detail.address,
    fulfilment: detail.fulfilment,
    status: detail.status,
    total: detail.total,
    menuCount: detail.menus.length,
    notePreview: detail.note,
    createdAt: detail.createdAt,
    processedAt: detail.processedAt,
    cancelledAt: detail.cancelledAt,
  };
}

type Reply = { status: number; body: unknown };
type ApiRequest = { method: string; path: string; query: URLSearchParams; body: unknown };

let server: Map<string, OrderDetail>;
const requests: ApiRequest[] = [];
/** Overrides the fake API for one request, e.g. to fail or to hold a response. */
let override: ((request: ApiRequest) => Promise<Reply | undefined> | Reply | undefined) | undefined;

/** Sets a status on the fake server, as another staff member would. */
function setOnServer(id: string, status: OrderStatus) {
  const found = server.get(id);
  if (!found) {
    throw new Error(`no order ${id}`);
  }
  const at = '2026-10-10T08:00:00.000Z';
  server.set(id, {
    ...found,
    status,
    processedAt: status === 'processed' ? at : found.processedAt,
    cancelledAt: status === 'cancelled' ? at : found.cancelledAt,
  });
}

function respond({ method, path, query, body }: ApiRequest): Reply {
  if (method === 'GET' && path === '/api/admin/orders/default-date') {
    return { status: 200, body: { date: '2026-10-12' } };
  }
  if (method === 'GET' && path === '/api/admin/orders') {
    const status = query.get('status') ?? 'all';
    const q = query.get('q')?.toLowerCase();
    const digits = q?.replace(/\D/g, '').replace(/^06/, '');
    const rows = [...server.values()]
      .filter((entry) => entry.deliveryDate === query.get('date'))
      .filter((entry) => status === 'all' || entry.status === status)
      .filter(
        (entry) =>
          !q ||
          entry.name.toLowerCase().includes(q) ||
          (digits !== undefined && digits !== '' && entry.phone.includes(digits)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toRow);
    return { status: 200, body: { orders: rows, nextCursor: null } };
  }
  const detail = /^\/api\/admin\/orders\/([^/]+)$/.exec(path);
  if (method === 'GET' && detail?.[1]) {
    const found = server.get(detail[1]);
    return found
      ? { status: 200, body: found }
      : { status: 404, body: { error: 'order_not_found' } };
  }
  const change = /^\/api\/admin\/orders\/([^/]+)\/status$/.exec(path);
  if (method === 'POST' && change?.[1]) {
    const id = change[1];
    const to = (body as { status: StatusChange }).status;
    const found = server.get(id);
    if (!found) {
      return { status: 404, body: { error: 'order_not_found' } };
    }
    if (!canChangeStatus(found.status, to)) {
      return {
        status: 409,
        body: { error: 'invalid_transition', status: found.status, message: 'refused' },
      };
    }
    setOnServer(id, to);
    return { status: 200, body: { order: toRow(server.get(id) as OrderDetail) } };
  }
  return { status: 404, body: { error: 'not_found' } };
}

beforeEach(() => {
  server = new Map(initialOrders().map((entry) => [entry.id, entry]));
  override = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const request: ApiRequest = {
        method: init?.method ?? 'GET',
        path: url.pathname,
        query: url.searchParams,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      requests.push(request);
      const reply = (await override?.(request)) ?? respond(request);
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
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

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const search = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');

/** The page at `/rendelesek` once the list has loaded. */
async function renderPage(query = '') {
  render(
    <MemoryRouter initialEntries={[`${paths.orders}${query}`]}>
      <QueryProvider>
        <Routes>
          <Route path={paths.orders} element={<OrdersPage />} />
        </Routes>
        <Search />
        <Toaster />
      </QueryProvider>
    </MemoryRouter>,
  );
  await screen.findByText(t.count(3));
  // The list mounts after a fetch; let React subscribe before the first interaction.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The table row of the order named `name`. */
function row(name: string): HTMLElement {
  const tr = screen.getByText(name, { selector: 'tbody button' }).closest('tr');
  if (!tr) {
    throw new Error(`no row for ${name}`);
  }
  return tr;
}

const rowNames = () =>
  [...document.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('button')?.textContent);

const sheet = () => screen.getByRole('dialog');
const listRequests = () =>
  requests.filter((request) => request.method === 'GET' && request.path === '/api/admin/orders');
const statusPosts = () => requests.filter((request) => request.method === 'POST');

function key(name: string, target: Element = document.activeElement ?? document.body) {
  fireEvent.keyDown(target, { key: name });
}

describe('/rendelesek', () => {
  it("opens on the API's default day, newest first, with pickup shown as such", async () => {
    await renderPage();

    expect(search().get('date')).toBe('2026-10-12');
    expect(rowNames()).toEqual(['Tóth Éva', 'Nagy Péter', 'Kiss Anna']);
    expect(row('Nagy Péter').textContent).toContain(t.pickup);
    expect(row('Kiss Anna').textContent).toContain('Fő tér 2.');
    expect(within(row('Kiss Anna')).getByText(t.status.received)).toBeTruthy();
  });

  it('shows an order in full, without a minimum-order difference, and links its other days', async () => {
    await renderPage();
    fireEvent.click(within(row('Kiss Anna')).getByRole('button', { name: 'Kiss Anna' }));

    const detail = await screen.findByRole('dialog', { name: /Kiss Anna/ });
    await within(detail).findByText(t.detail.menu(2), { selector: 'h3' });
    expect(search().get('order')).toBe(ids.anna);
    expect(within(detail).getByRole('link', { name: '+36301234567' }).getAttribute('href')).toBe(
      'tel:+36301234567',
    );
    expect(within(detail).getByText(t.detail.menu(1), { selector: 'h3' })).toBeTruthy();
    expect(within(detail).getByText(t.detail.adjustments.no_soup_discount)).toBeTruthy();
    expect(within(detail).getByText('Kenyér × 2')).toBeTruthy();
    expect(within(detail).getByText('Kérem a kapucsengőt kétszer nyomni.')).toBeTruthy();
    expect(detail.textContent).not.toMatch(/minimum/i);

    const tuesday = within(detail).getByRole('link', { name: /október 13/ });
    expect(tuesday.getAttribute('href')).toBe(
      `${paths.orders}?date=2026-10-13&order=${ids.annaTuesday}`,
    );
    fireEvent.click(tuesday);
    await waitFor(() => expect(search().get('date')).toBe('2026-10-13'));
    expect(search().get('order')).toBe(ids.annaTuesday);
  });

  it('marks an order processed at once, then keeps what the API returns', async () => {
    let release: () => void = () => {};
    override = (request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
          })
        : undefined;
    await renderPage(`?order=${ids.anna}`);
    fireEvent.click(await within(sheet()).findByRole('button', { name: t.detail.process }));

    // Before the API answers.
    await waitFor(() =>
      expect(within(row('Kiss Anna')).getByText(t.status.processed)).toBeTruthy(),
    );
    expect(statusPosts().map((request) => request.body)).toEqual([{ status: 'processed' }]);
    release();

    await screen.findByText(t.toasts.processed);
    expect(server.get(ids.anna)?.processedAt).not.toBeNull();
    expect(within(sheet()).queryByRole('button', { name: t.detail.process })).toBeNull();
    expect(within(sheet()).getByText(t.detail.processedAt, { selector: 'dt' })).toBeTruthy();
    // The page's own change does not light up as a change from elsewhere.
    expect(row('Kiss Anna').hasAttribute('data-fresh')).toBe(false);
  });

  it('puts the status back and says why when the API refuses', async () => {
    override = (request) =>
      request.method === 'POST' ? { status: 500, body: { error: 'internal' } } : undefined;
    await renderPage(`?order=${ids.anna}`);
    fireEvent.click(await within(sheet()).findByRole('button', { name: t.detail.process }));

    await screen.findByText(strings.errors.byCode.internal);
    await waitFor(() => expect(within(row('Kiss Anna')).getByText(t.status.received)).toBeTruthy());
    expect(within(sheet()).getByRole('button', { name: t.detail.process })).toBeTruthy();
  });

  it('cancels after a confirm; a change another session already made counts as done', async () => {
    await renderPage(`?order=${ids.eva}`);
    fireEvent.click(await within(sheet()).findByRole('button', { name: t.detail.cancel }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toContain('Tóth Éva');
    fireEvent.click(within(confirm).getByRole('button', { name: t.cancelDialog.confirm }));

    await screen.findByText(t.toasts.cancelled);
    expect(server.get(ids.eva)?.status).toBe('cancelled');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    // Someone else processed Anna's order after this page loaded it.
    fireEvent.click(within(row('Kiss Anna')).getByRole('button', { name: 'Kiss Anna' }));
    const process = await within(sheet()).findByRole('button', { name: t.detail.process });
    setOnServer(ids.anna, 'processed');
    fireEvent.click(process);

    await screen.findByText(t.toasts.alreadyDone);
    expect(statusPosts().at(-1)?.body).toEqual({ status: 'processed' });
    expect(within(row('Kiss Anna')).getByText(t.status.processed)).toBeTruthy();
  });

  it('filters by search after a pause, by status, and by day', async () => {
    await renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: t.search.label }), {
      target: { value: '06 30/123' },
    });
    expect(search().get('q')).toBeNull();
    await waitFor(() => expect(rowNames()).toEqual(['Kiss Anna']));
    expect(search().get('q')).toBe('06 30/123');
    expect(listRequests().at(-1)?.query.get('q')).toBe('06 30/123');

    fireEvent.change(screen.getByRole('searchbox', { name: t.search.label }), {
      target: { value: '' },
    });
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: t.status.processed }));
    await screen.findByText(t.noMatch.title);
    expect(search().get('status')).toBe('processed');

    fireEvent.click(screen.getByRole('button', { name: t.statusFilter.all }));
    fireEvent.click(screen.getByRole('button', { name: strings.dayNavigator.next }));
    await waitFor(() => expect(search().get('date')).toBe('2026-10-13'));
    await screen.findByText(t.count(1));
    expect(listRequests().at(-1)?.query.get('date')).toBe('2026-10-13');
  });

  it('moves the selection with j/k and the arrows, and p marks the open order processed', async () => {
    await renderPage();

    key('j', document.body);
    expect(row('Tóth Éva').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Tóth Éva');
    key('ArrowDown');
    key('j');
    key('j');
    expect(row('Kiss Anna').getAttribute('aria-selected')).toBe('true');
    key('k');
    expect(row('Nagy Péter').getAttribute('aria-selected')).toBe('true');

    // Typing in the search box is not a shortcut.
    key('j', screen.getByRole('searchbox', { name: t.search.label }));
    expect(row('Nagy Péter').getAttribute('aria-selected')).toBe('true');

    fireEvent.click(within(row('Kiss Anna')).getByRole('button', { name: 'Kiss Anna' }));
    await within(sheet()).findByRole('button', { name: t.detail.process });
    // In the open order, j and k move to the next one; the arrows are left to scroll.
    key('k');
    await waitFor(() => expect(search().get('order')).toBe(ids.peter));
    key('ArrowDown');
    expect(search().get('order')).toBe(ids.peter);

    key('p');
    await screen.findByText(t.toasts.processed);
    expect(statusPosts()).toHaveLength(1);
    expect(server.get(ids.peter)?.status).toBe('processed');
    // p again on a processed order does nothing.
    key('p');
    expect(statusPosts()).toHaveLength(1);
  });

  it('polls every 30 s and lights up what changed elsewhere for 10 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    const before = listRequests().length;

    setOnServer(ids.eva, 'cancelled');
    server.set(ids.newcomer, order({ id: ids.newcomer, name: 'Új Vendég' }));
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(listRequests()).toHaveLength(before);

    await act(() => vi.advanceTimersByTimeAsync(1_500));
    await screen.findByText(t.count(4));
    expect(row('Új Vendég').hasAttribute('data-fresh')).toBe(true);
    expect(row('Tóth Éva').hasAttribute('data-fresh')).toBe(true);
    expect(within(row('Tóth Éva')).getByText(t.status.cancelled)).toBeTruthy();
    expect(row('Kiss Anna').hasAttribute('data-fresh')).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(document.querySelectorAll('tbody tr[data-fresh]')).toHaveLength(0);
  });
});
