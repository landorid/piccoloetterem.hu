import {
  type MenuItem,
  type PermanentItemDraft,
  type PermanentItemsDraft,
  type PermanentMenu,
  type PermanentSection,
  permanentSections,
} from '@piccolo/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { ItemsPage } from '@/pages/ItemsPage';
import { strings } from '@/strings';

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: async () => {} }),
  getToken: async () => 'session-token',
}));

const ids = {
  rantott: '00000000-0000-4000-8000-0000000000a1',
  cordon: '00000000-0000-4000-8000-0000000000a2',
  porkolt: '00000000-0000-4000-8000-0000000000a3',
  palacsinta: '00000000-0000-4000-8000-0000000000d1',
  somloi: '00000000-0000-4000-8000-0000000000d2',
  uborka: '00000000-0000-4000-8000-0000000000b1',
  hasab: '00000000-0000-4000-8000-0000000000c1',
  rizs: '00000000-0000-4000-8000-0000000000c2',
  steak: '00000000-0000-4000-8000-0000000000e1',
};

const item = (
  fields: Pick<MenuItem, 'id' | 'category' | 'name'> & Partial<MenuItem>,
): MenuItem => ({
  description: null,
  priceWeekday: 1000,
  priceWeekend: null,
  variations: [],
  allergens: [],
  soupIncluded: false,
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
  ...fields,
});

function storedMenu(): PermanentMenu {
  return {
    allWeek: [
      item({
        id: ids.rantott,
        category: 'all_week',
        name: 'Rántott csirkemell',
        priceWeekday: 2350,
        priceWeekend: 2550,
        allergens: ['gluten', 'eggs'],
        requiresSide: true,
      }),
      item({
        id: ids.cordon,
        category: 'all_week',
        name: 'Cordon bleu',
        priceWeekday: 2650,
        variations: ['sertés', 'csirke'],
        requiresSide: true,
        sortOrder: 1,
      }),
      item({
        id: ids.porkolt,
        category: 'all_week',
        name: 'Régi pörkölt',
        active: false,
        sortOrder: 2,
      }),
    ],
    desserts: [
      item({
        id: ids.palacsinta,
        category: 'dessert',
        name: 'Túrós palacsinta',
        description: 'Két darab.',
        priceWeekday: 790,
      }),
      item({ id: ids.somloi, category: 'dessert', name: 'Somlói galuska', sortOrder: 1 }),
    ],
    pickles: [
      item({ id: ids.uborka, category: 'pickle', name: 'Csemege uborka', priceWeekday: 350 }),
    ],
    sides: [
      item({ id: ids.hasab, category: 'side', name: 'Hasábburgonya', priceWeekday: 0 }),
      item({ id: ids.rizs, category: 'side', name: 'Párolt rizs', priceWeekday: 0, sortOrder: 1 }),
    ],
    sideExtras: [
      item({
        id: ids.steak,
        category: 'side_extra',
        name: 'Steakburgonya',
        priceWeekday: 750,
        priceWeekend: 850,
      }),
    ],
  };
}

/**
 * What `PUT /items` does to the stored menu, enough for these tests: a section fixes the category,
 * the position is the sortOrder, an item without id is inserted, an item left out is set inactive.
 */
function applySave(stored: PermanentMenu, draft: PermanentItemsDraft): PermanentMenu {
  const byId = new Map(
    Object.values(stored)
      .flat()
      .map((entry) => [entry.id, entry]),
  );
  const listed = new Set<string>();
  let inserted = 0;
  const section = (name: PermanentSection) => {
    const saved = draft[name].map((entry: PermanentItemDraft, sortOrder): MenuItem => {
      const { id, active = true, ...content } = entry;
      const current = id === undefined ? undefined : byId.get(id);
      inserted += id === undefined ? 1 : 0;
      const savedId = id ?? `00000000-0000-4000-8000-${String(inserted).padStart(12, '0')}`;
      listed.add(savedId);
      return {
        ...content,
        allergens: content.allergens as MenuItem['allergens'],
        id: savedId,
        category: permanentSections[name],
        soldOut: current?.soldOut ?? false,
        active,
        sortOrder,
      };
    });
    const dropped = stored[name]
      .filter((entry) => !listed.has(entry.id))
      .map((entry) => ({ ...entry, active: false }));
    return [...saved, ...dropped];
  };
  return {
    allWeek: section('allWeek'),
    desserts: section('desserts'),
    pickles: section('pickles'),
    sides: section('sides'),
    sideExtras: section('sideExtras'),
  };
}

type Reply = { status: number; body: unknown };
type ApiRequest = { method: string; path: string; body: unknown };

let server: PermanentMenu;
const requests: ApiRequest[] = [];
/** Overrides the fake API for one route, e.g. to fail or to hold a response. */
let override: ((request: ApiRequest) => Promise<Reply> | Reply | undefined) | undefined;

function respond(request: ApiRequest): Reply {
  if (request.path === '/api/admin/menu/items' && request.method === 'GET') {
    return { status: 200, body: server };
  }
  if (request.path === '/api/admin/menu/items' && request.method === 'PUT') {
    server = applySave(server, request.body as PermanentItemsDraft);
    return { status: 200, body: server };
  }
  const soldOut = /^\/api\/admin\/menu\/items\/([^/]+)\/sold-out$/.exec(request.path);
  if (soldOut && request.method === 'POST') {
    const id = soldOut[1];
    const value = (request.body as { soldOut: boolean }).soldOut;
    const found = Object.values(server)
      .flat()
      .find((entry) => entry.id === id);
    if (!found) {
      return { status: 404, body: { error: 'item_not_found' } };
    }
    server = Object.fromEntries(
      Object.entries(server).map(([name, list]) => [
        name,
        list.map((entry) => (entry.id === id ? { ...entry, soldOut: value } : entry)),
      ]),
    ) as PermanentMenu;
    return { status: 200, body: { item: { ...found, soldOut: value } } };
  }
  return { status: 404, body: { error: 'not_found' } };
}

beforeEach(() => {
  server = storedMenu();
  override = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const request: ApiRequest = {
        method: init?.method ?? 'GET',
        path: url.pathname,
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
  vi.unstubAllGlobals();
  requests.length = 0;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <QueryProvider>
        <ItemsPage />
        <Toaster />
      </QueryProvider>
    </MemoryRouter>,
  );
}

async function renderLoaded() {
  const view = renderPage();
  await screen.findByDisplayValue('Rántott csirkemell');
  return view;
}

function section(name: PermanentSection) {
  return screen.getByRole('region', { name: strings.items.sections[name] });
}

/** The table row whose name input holds `name`. */
function row(name: string): HTMLElement {
  const input = screen.getByDisplayValue(name);
  const tr = input.closest('tr');
  if (!tr) {
    throw new Error(`no row for ${name}`);
  }
  return tr;
}

function namesIn(name: PermanentSection): string[] {
  return within(section(name))
    .getAllByRole('textbox', { name: strings.items.columns.name })
    .map((input) => (input as HTMLInputElement).value);
}

function type(container: HTMLElement, label: string, value: string) {
  fireEvent.change(within(container).getByRole('textbox', { name: label }), {
    target: { value },
  });
}

const saveButton = () => screen.getByRole('button', { name: strings.items.save });
const puts = () => requests.filter((request) => request.method === 'PUT');

describe('/etlap', () => {
  it('shows the five sections, inactive items last, prices hidden for sides', async () => {
    await renderLoaded();

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      strings.items.sections.allWeek,
      strings.items.sections.desserts,
      strings.items.sections.pickles,
      strings.items.sections.sides,
      strings.items.sections.sideExtras,
    ]);
    expect(namesIn('allWeek')).toEqual(['Rántott csirkemell', 'Cordon bleu', 'Régi pörkölt']);
    expect(row('Régi pörkölt').hasAttribute('data-inactive')).toBe(true);
    expect(
      within(row('Régi pörkölt')).getByRole('button', { name: strings.items.reactivate }),
    ).toBeTruthy();

    const header = (name: PermanentSection) =>
      within(section(name))
        .getAllByRole('columnheader')
        .map((th) => th.textContent);
    expect(header('sides')).not.toContain(strings.items.columns.priceWeekday);
    expect(header('sides')).not.toContain(strings.items.columns.priceWeekend);
    expect(header('sideExtras')).toContain(strings.items.columns.priceWeekend);
    expect(header('allWeek')).toContain(strings.items.columns.requiresSide);
    expect(header('desserts')).not.toContain(strings.items.columns.requiresSide);

    // An empty weekend price shows the weekday price as its placeholder.
    const weekend = within(row('Cordon bleu')).getByRole('textbox', {
      name: strings.items.columns.priceWeekend,
    }) as HTMLInputElement;
    expect([weekend.value, weekend.placeholder]).toEqual(['', '2650']);
    expect(screen.getByText(strings.items.upToDate)).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('saves edits, a new item, the order and (de)activation in one PUT; a reload shows them', async () => {
    const view = await renderLoaded();

    // Edit
    type(row('Túrós palacsinta'), strings.items.columns.priceWeekday, '860');
    type(row('Cordon bleu'), strings.items.columns.priceWeekend, '2 850');
    fireEvent.click(
      within(row('Cordon bleu')).getByRole('checkbox', {
        name: strings.items.columns.requiresSide,
      }),
    );
    // Create
    fireEvent.click(
      within(section('pickles')).getByRole('button', { name: strings.items.addItem }),
    );
    const newPickle = within(section('pickles')).getAllByRole('row').at(-2) as HTMLElement;
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(newPickle).getByRole('textbox', { name: strings.items.columns.name }),
      ),
    );
    type(newPickle, strings.items.columns.name, 'Vegyes savanyúság');
    type(newPickle, strings.items.columns.priceWeekday, '400');
    const variations = within(newPickle).getByRole('textbox', {
      name: strings.items.columns.variations,
    });
    fireEvent.change(variations, { target: { value: 'kicsi' } });
    fireEvent.keyDown(variations, { key: 'Enter' });
    // Reorder
    fireEvent.click(within(row('Párolt rizs')).getByRole('button', { name: strings.items.moveUp }));
    expect(namesIn('sides')).toEqual(['Párolt rizs', 'Hasábburgonya']);
    // Deactivate
    fireEvent.click(
      within(row('Somlói galuska')).getByRole('switch', { name: strings.items.columns.active }),
    );
    // Reactivate
    fireEvent.click(
      within(row('Régi pörkölt')).getByRole('button', { name: strings.items.reactivate }),
    );
    expect(namesIn('allWeek')).toEqual(['Rántott csirkemell', 'Cordon bleu', 'Régi pörkölt']);

    expect(screen.getByText(strings.items.unsaved)).toBeTruthy();
    fireEvent.click(saveButton());

    expect(await screen.findByText(strings.items.saved)).toBeTruthy();
    expect(puts()).toHaveLength(1);
    const body = puts()[0]?.body as PermanentItemsDraft;
    const summary = (name: PermanentSection) =>
      body[name].map(({ id, name: itemName, active }) => ({ id, name: itemName, active }));
    expect(summary('allWeek')).toEqual([
      { id: ids.rantott, name: 'Rántott csirkemell', active: true },
      { id: ids.cordon, name: 'Cordon bleu', active: true },
      { id: ids.porkolt, name: 'Régi pörkölt', active: true },
    ]);
    expect(body.allWeek[1]).toMatchObject({ priceWeekend: 2850, requiresSide: false });
    expect(summary('desserts')).toEqual([
      { id: ids.palacsinta, name: 'Túrós palacsinta', active: true },
      { id: ids.somloi, name: 'Somlói galuska', active: false },
    ]);
    expect(body.desserts[0]).toMatchObject({ priceWeekday: 860 });
    expect(body.pickles[1]).toEqual({
      name: 'Vegyes savanyúság',
      description: null,
      priceWeekday: 400,
      priceWeekend: null,
      variations: ['kicsi'],
      allergens: [],
      soupIncluded: false,
      requiresSide: false,
      active: true,
    });
    expect(summary('sides').map((entry) => entry.id)).toEqual([ids.rizs, ids.hasab]);
    // Sold-out is not part of the save.
    expect(
      Object.values(body)
        .flat()
        .some((entry) => 'soldOut' in entry),
    ).toBe(false);
    expect(screen.getByText(strings.items.upToDate)).toBeTruthy();

    // A fresh page load reads what was stored.
    view.unmount();
    await renderLoaded();
    expect(namesIn('pickles')).toEqual(['Csemege uborka', 'Vegyes savanyúság']);
    expect(namesIn('sides')).toEqual(['Párolt rizs', 'Hasábburgonya']);
    expect(namesIn('desserts')).toEqual(['Túrós palacsinta', 'Somlói galuska']);
    expect(row('Somlói galuska').hasAttribute('data-inactive')).toBe(true);
    expect(row('Régi pörkölt').hasAttribute('data-inactive')).toBe(false);
    expect(screen.getByDisplayValue('860')).toBeTruthy();
    expect(within(row('Vegyes savanyúság')).getByText('kicsi')).toBeTruthy();
  });

  it('shows an empty name inline and sends nothing', async () => {
    await renderLoaded();

    type(row('Csemege uborka'), strings.items.columns.name, '  ');
    fireEvent.click(saveButton());

    const name = within(section('pickles')).getByRole('textbox', {
      name: strings.items.columns.name,
    });
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(strings.items.fieldErrors.required)).toBeTruthy();
    expect(screen.getByText(strings.items.invalidFields(1))).toBeTruthy();
    expect(document.activeElement).toBe(name);
    expect(puts()).toEqual([]);

    // Typing clears the field's error.
    fireEvent.change(name, { target: { value: 'Csemege uborka' } });
    expect(name.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(strings.items.fieldErrors.required)).toBeNull();
  });

  it("puts the API's validation fields on the row they name, keeping the edits", async () => {
    override = (request) =>
      request.method === 'PUT'
        ? {
            status: 400,
            body: { error: 'validation', fields: { 'sides.0.name': 'duplicate' } },
          }
        : undefined;
    await renderLoaded();

    // sides.0 in the payload is Párolt rizs once it is moved up.
    fireEvent.click(within(row('Párolt rizs')).getByRole('button', { name: strings.items.moveUp }));
    fireEvent.click(saveButton());

    expect(await screen.findByText(strings.items.fieldErrors.duplicate)).toBeTruthy();
    expect(
      within(row('Párolt rizs'))
        .getByRole('textbox', { name: strings.items.columns.name })
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      within(row('Hasábburgonya')).queryByText(strings.items.fieldErrors.duplicate),
    ).toBeNull();
    // The global toast reports the failure; the edits stay.
    expect(await screen.findByText(strings.errors.byCode.validation)).toBeTruthy();
    expect(namesIn('sides')).toEqual(['Párolt rizs', 'Hasábburgonya']);
    expect(screen.getByText(strings.items.invalidFields(1))).toBeTruthy();
  });

  it('marks an item sold out at once, before the API answers', async () => {
    let release: (reply: Reply) => void = () => {};
    override = (request) =>
      request.path.endsWith('/sold-out')
        ? new Promise<Reply>((resolve) => {
            release = resolve;
          })
        : undefined;
    await renderLoaded();

    const toggle = within(row('Túrós palacsinta')).getByRole('switch', {
      name: strings.items.columns.soldOut,
    });
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(toggle.hasAttribute('disabled')).toBe(true);
    await waitFor(() =>
      expect(requests.at(-1)).toEqual({
        method: 'POST',
        path: `/api/admin/menu/items/${ids.palacsinta}/sold-out`,
        body: { soldOut: true },
      }),
    );
    // Not an edit: nothing to save.
    expect(saveButton().hasAttribute('disabled')).toBe(true);

    await act(async () =>
      release({
        status: 200,
        body: { item: { ...storedMenu().desserts[0], soldOut: true } },
      }),
    );
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('turns the sold-out switch back when the API refuses', async () => {
    override = (request) =>
      request.path.endsWith('/sold-out') ? { status: 500, body: { error: 'internal' } } : undefined;
    await renderLoaded();

    // With unsaved edits on the page too.
    type(row('Csemege uborka'), strings.items.columns.priceWeekday, '390');
    const toggle = within(row('Csemege uborka')).getByRole('switch', {
      name: strings.items.columns.soldOut,
    });
    fireEvent.click(toggle);

    expect(await screen.findByText(strings.errors.byCode.internal)).toBeTruthy();
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(screen.getByDisplayValue('390')).toBeTruthy();
  });

  it('cannot mark a new item sold out, and drops it with its own button', async () => {
    await renderLoaded();

    fireEvent.click(within(section('sides')).getByRole('button', { name: strings.items.addItem }));
    const newSide = within(section('sides')).getAllByRole('row').at(-2) as HTMLElement;
    expect(
      within(newSide)
        .getByRole('switch', { name: strings.items.columns.soldOut })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      within(newSide).queryByRole('textbox', { name: strings.items.columns.priceWeekday }),
    ).toBeNull();

    fireEvent.click(within(newSide).getByRole('button', { name: strings.items.removeNewItem }));
    expect(namesIn('sides')).toEqual(['Hasábburgonya', 'Párolt rizs']);
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('discards the edits after a confirmation', async () => {
    await renderLoaded();

    type(row('Steakburgonya'), strings.items.columns.name, 'Steak krumpli');
    fireEvent.click(screen.getByRole('button', { name: strings.items.discard }));
    fireEvent.click(
      await screen.findByRole('button', { name: strings.items.discardConfirm.confirm }),
    );

    expect(await screen.findByDisplayValue('Steakburgonya')).toBeTruthy();
    expect(screen.getByText(strings.items.upToDate)).toBeTruthy();
    expect(puts()).toEqual([]);
  });
});
