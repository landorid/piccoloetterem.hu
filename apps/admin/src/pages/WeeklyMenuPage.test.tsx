import type { AllergenCode, MenuDay, MenuItem, WeekDraft } from '@piccolo/core';
import { planWeek } from '@piccolo/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { QueryProvider } from '@/components/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { paths } from '@/paths';
import { strings } from '@/strings';

/*
 * The weekly menu page against an in-memory fake of the admin menu API (apps/api README, "Admin
 * menu"), at the fetch level. The fake saves a week with core's `planWeek`, as the API does, so a
 * rejected save carries the API's codes and paths.
 *
 * ISO week 2026/42 runs from Monday 12 to Saturday 17 October.
 */

const t = strings.weeklyMenu;

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, orgId: 'org_piccolo' }),
  useClerk: () => ({ signOut: async () => {} }),
  useOrganizationList: () => ({
    isLoaded: true,
    setActive: async () => {},
    userMemberships: { isLoading: false, data: [{ organization: { id: 'org_piccolo' } }] },
  }),
  getToken: async () => 'session-token',
  SignIn: () => null,
  UserButton: () => null,
}));

type Reply = { status: number; body: unknown };
type Request = { method: string; path: string; body: unknown };
type ListPath = `days.${MenuDay}.${'soups' | 'mains'}` | 'featured';
type StoredWeek = { publishedAt: string | null; lists: Partial<Record<ListPath, string[]>> };

const days = [1, 2, 3, 4, 5, 6] as const;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The admin menu API, in memory. */
function fakeApi() {
  const items = new Map<string, MenuItem>();
  const weeks = new Map<string, StoredWeek>();
  const closed = new Set<string>();
  const requests: Request[] = [];
  const held = new Map<string, Promise<void>>();
  const failing = new Map<string, Reply>();
  let lastId = 0;

  const readWeek = (isoYear: number, isoWeek: number) => {
    const stored = weeks.get(`${isoYear}-${isoWeek}`);
    const list = (path: ListPath) =>
      (stored?.lists[path] ?? []).map((id) => items.get(id) as MenuItem);
    const day = (d: MenuDay) => ({
      soups: list(`days.${d}.soups`),
      mains: list(`days.${d}.mains`),
    });
    return {
      week: { isoYear, isoWeek, publishedAt: stored?.publishedAt ?? null },
      days: { 1: day(1), 2: day(2), 3: day(3), 4: day(4), 5: day(5), 6: day(6) },
      featured: list('featured'),
    };
  };

  const putWeek = (isoYear: number, isoWeek: number, draft: WeekDraft): Reply => {
    const result = planWeek(draft, items);
    if (!result.ok) {
      return { status: 400, body: { error: 'validation', fields: result.fields } };
    }
    const ids = result.plan.items.map((planned) => {
      lastId += 1;
      const id = planned.id ?? uuid(lastId);
      items.set(id, {
        id,
        category: planned.category,
        ...planned.content,
        allergens: planned.content.allergens as AllergenCode[],
        soldOut: items.get(id)?.soldOut ?? false,
        active: true,
        sortOrder: 0,
      });
      return id;
    });
    const lists: StoredWeek['lists'] = {};
    for (const entry of result.plan.schedule) {
      const category = result.plan.items[entry.item]?.category;
      const path: ListPath =
        entry.day === null
          ? 'featured'
          : `days.${entry.day}.${category === 'daily_soup' ? 'soups' : 'mains'}`;
      lists[path] = [...(lists[path] ?? []), ids[entry.item] ?? ''];
    }
    const key = `${isoYear}-${isoWeek}`;
    weeks.set(key, { publishedAt: weeks.get(key)?.publishedAt ?? null, lists });
    return { status: 200, body: readWeek(isoYear, isoWeek) };
  };

  const route = (method: string, path: string, query: URLSearchParams, body: unknown): Reply => {
    const ok = (reply: unknown) => ({ status: 200, body: reply });
    if (path === '/api/admin/config') {
      return ok({ name: 'Test Restaurant' });
    }
    if (path === '/api/health') {
      return ok({ ok: true, version: '1.2.3' });
    }
    if (path === '/api/admin/menu/default-week') {
      return ok({ isoYear: 2026, isoWeek: 42 });
    }
    const weekMatch = /^\/api\/admin\/menu\/weeks\/(\d+)\/(\d+)(\/publish)?$/.exec(path);
    const soldOutMatch = /^\/api\/admin\/menu\/items\/([\w-]+)\/sold-out$/.exec(path);
    const closedMatch = /^\/api\/admin\/menu\/closed-dates\/([\d-]+)$/.exec(path);
    if (weekMatch) {
      const [isoYear, isoWeek] = [Number(weekMatch[1]), Number(weekMatch[2])];
      if (weekMatch[3] && method === 'POST') {
        const stored = weeks.get(`${isoYear}-${isoWeek}`);
        if (!stored) {
          return { status: 404, body: { error: 'week_not_found' } };
        }
        stored.publishedAt ??= '2026-10-09T14:05:00.000Z';
        return ok({ week: { isoYear, isoWeek, publishedAt: stored.publishedAt } });
      }
      return method === 'PUT'
        ? putWeek(isoYear, isoWeek, body as WeekDraft)
        : ok(readWeek(isoYear, isoWeek));
    }
    if (soldOutMatch) {
      const item = items.get(soldOutMatch[1] ?? '');
      if (!item) {
        return { status: 404, body: { error: 'item_not_found' } };
      }
      item.soldOut = (body as { soldOut: boolean }).soldOut;
      return ok({ item });
    }
    if (path === '/api/admin/menu/closed-dates') {
      if (method === 'POST') {
        const { date } = body as { date: string };
        const created = !closed.has(date);
        closed.add(date);
        return ok({ date, created });
      }
      const [from, to] = [query.get('from') ?? '', query.get('to') ?? ''];
      return ok({ dates: [...closed].filter((date) => from <= date && date <= to).sort() });
    }
    if (closedMatch) {
      const date = closedMatch[1] ?? '';
      return ok({ date, deleted: closed.delete(date) });
    }
    return { status: 404, body: { error: 'not_found' } };
  };

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname, body });
    const key = `${method} ${url.pathname}`;
    await held.get(key);
    const reply = failing.get(key) ?? route(method, url.pathname, url.searchParams, body);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return {
    fetch,
    requests,
    items,
    closed,
    seedWeek: (isoYear: number, isoWeek: number, draft: WeekDraft, publishedAt?: string) => {
      const reply = putWeek(isoYear, isoWeek, draft);
      if (reply.status !== 200) {
        throw new Error(JSON.stringify(reply.body));
      }
      if (publishedAt) {
        (weeks.get(`${isoYear}-${isoWeek}`) as StoredWeek).publishedAt = publishedAt;
      }
      return reply.body as ReturnType<typeof readWeek>;
    },
    /** Holds `METHOD /path` until the returned function is called. */
    hold: (key: string) => {
      let release = () => {};
      held.set(
        key,
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      return () => {
        held.delete(key);
        release();
      };
    },
    fail: (key: string, reply: Reply) => failing.set(key, reply),
  };
}

let api: ReturnType<typeof fakeApi>;
let location: ReturnType<typeof useLocation> | undefined;

function LocationProbe() {
  location = useLocation();
  return null;
}

/** Opens `path` as a fresh page load: a new router and a new query cache. */
function open(path: string) {
  window.history.replaceState(null, '', path);
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <QueryProvider>
            <App />
            <LocationProbe />
            <Toaster />
          </QueryProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

const card = (name: string) => screen.getByRole('group', { name });
const field = (cardName: string, label: string | RegExp) =>
  within(card(cardName)).getByRole('textbox', { name: label }) as HTMLInputElement;
const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const saveButton = () => screen.getByRole('button', { name: t.actions.save });

async function openWeek(week = '2026-W42') {
  const view = open(`${paths.weeklyMenu}?week=${week}`);
  await screen.findByRole('group', { name: `${t.days[1]}, 1. ${t.rowNames.soups}` });
  return view;
}

function addVariation(cardName: string, variation: string) {
  const input = field(cardName, strings.variationsInput.label);
  type(input, variation);
  fireEvent.keyDown(input, { key: 'Enter' });
}

async function pickAllergens(cardName: string, names: RegExp[]) {
  fireEvent.click(within(card(cardName)).getByRole('button', { name: /Allergének/ }));
  const list = await screen.findByRole('group', { name: strings.allergenSelect.label });
  for (const name of names) {
    fireEvent.click(within(list).getByRole('checkbox', { name }));
  }
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('group', { name: strings.allergenSelect.label })).toBeNull(),
  );
}

/** Everything the grid shows, card by card, to compare two loads of a week. */
function gridContents() {
  return screen
    .getAllByRole('group')
    .filter((group) => group.getAttribute('aria-label')?.includes(','))
    .map((group) => ({
      card: group.getAttribute('aria-label'),
      fields: within(group)
        .getAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value),
      // Variation chips; the allergen chips sit inside the allergen button.
      variations: [...group.querySelectorAll('[data-slot="badge"]')]
        .filter((chip) => !chip.closest('button'))
        .map((chip) => chip.textContent),
      allergens: within(group).getByRole('button', { name: /Allergének/ }).textContent,
      soupIncluded: within(group).queryByRole('checkbox')?.getAttribute('aria-checked') ?? null,
    }));
}

const soupName = (day: MenuDay, n: number) => `${t.days[day]}, ${n}. ${t.rowNames.soups}`;
const mainName = (day: MenuDay, n: number) => `${t.days[day]}, ${n}. ${t.rowNames.mains}`;
const featuredName = (n: number) => `${t.groups.featured}, ${n}. ${t.rowNames.featured}`;

const item = (name: string, overrides: Partial<MenuItem> = {}) => ({
  name,
  description: null,
  priceWeekday: 1020,
  priceWeekend: null,
  variations: [],
  allergens: [],
  soupIncluded: true,
  requiresSide: false,
  ...overrides,
});
const emptyDay = { soups: [], mains: [] };
const oneDayWeek: WeekDraft = {
  days: {
    1: {
      soups: [item('Gulyásleves', { priceWeekday: 0, soupIncluded: false })],
      mains: [item('Rántott csirkemell')],
    },
    2: { soups: [], mains: [item('Lecsó')] },
    3: emptyDay,
    4: emptyDay,
    5: emptyDay,
    6: emptyDay,
  },
  featured: [],
};

beforeEach(() => {
  vi.stubEnv('VITE_CLERK_ORG_ID', 'org_piccolo');
  window.innerWidth = 1280;
  api = fakeApi();
  vi.stubGlobal('fetch', api.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  location = undefined;
});

describe('opening the page', () => {
  it('opens on the default week, puts it in the URL, and lays out the template', async () => {
    open(paths.weeklyMenu);

    expect(await screen.findByRole('group', { name: soupName(1, 1) })).toBeTruthy();
    await waitFor(() => expect(location?.search).toBe('?week=2026-W42'));
    expect(
      screen.getByRole('heading', { name: /2026\/42\. hét \(10\.12 – 10\.17\)/ }),
    ).toBeTruthy();
    expect(screen.getByText(t.week.draft)).toBeTruthy();
    for (const day of days) {
      expect(screen.getByRole('columnheader', { name: new RegExp(t.days[day]) })).toBeTruthy();
      expect(screen.queryByRole('group', { name: soupName(day, 2) })).toBeTruthy();
      expect(screen.queryByRole('group', { name: soupName(day, 3) })).toBeNull();
      expect(screen.queryByRole('group', { name: mainName(day, 5) })).toBeTruthy();
      expect(screen.queryByRole('group', { name: mainName(day, 6) })).toBeNull();
    }
    // Weekdays have one price, Saturday two; daily soups none.
    expect(field(mainName(1, 3), t.fields.price).value).toBe('1120');
    expect(field(mainName(6, 5), t.fields.priceWeekday).value).toBe('1170');
    expect(field(mainName(6, 5), t.fields.priceWeekend).value).toBe('1270');
    expect(within(card(soupName(1, 1))).getByText(t.fields.soupPrice)).toBeTruthy();
    expect(
      within(card(mainName(1, 1)))
        .getByRole('checkbox', { name: t.fields.soupIncluded })
        .getAttribute('aria-checked'),
    ).toBe('true');
    // Nothing typed yet: nothing to save, nothing to publish.
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: t.actions.publish }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('steps to the next and previous week', async () => {
    await openWeek('2026-W53');

    fireEvent.click(screen.getByRole('button', { name: t.week.next }));
    await waitFor(() => expect(location?.search).toBe('?week=2027-W01'));
    fireEvent.click(screen.getByRole('button', { name: t.week.previous }));
    fireEvent.click(await screen.findByRole('button', { name: t.week.previous }));
    await waitFor(() => expect(location?.search).toBe('?week=2026-W52'));
    expect(await screen.findByRole('heading', { name: /2026\/52\. hét/ })).toBeTruthy();
  });
});

describe('acceptance 1: a full week survives save and reload', () => {
  it('saves six days of two soups and five mains plus three featured items, and reloads them identical', async () => {
    const view = await openWeek();

    for (const day of days) {
      for (const n of [1, 2]) {
        type(field(soupName(day, n), t.fields.name), `Leves ${day}/${n}`);
      }
      for (const n of [1, 2, 3, 4, 5]) {
        type(field(mainName(day, n), t.fields.name), `Főétel ${day}/${n}`);
      }
      type(field(mainName(day, 1), t.fields.description), 'rizzsel, salátával');
      addVariation(mainName(day, 2), 'Kicsi');
      addVariation(mainName(day, 2), 'Nagy');
      fireEvent.click(
        within(card(mainName(day, 4))).getByRole('checkbox', { name: t.fields.soupIncluded }),
      );
    }
    type(field(mainName(3, 5), t.fields.price), '1290');
    await pickAllergens(soupName(1, 1), [/Zeller/]);
    await pickAllergens(mainName(2, 3), [/Tej/, /Glutén/]);
    await pickAllergens(mainName(6, 1), [/Tojás/]);

    for (const n of [1, 2, 3]) {
      fireEvent.click(screen.getByRole('button', { name: t.add.featured }));
      type(field(featuredName(n), t.fields.name), `Ajánlat ${n}`);
      type(field(featuredName(n), t.fields.priceWeekday), String(2190 + n * 100));
    }
    type(field(featuredName(2), t.fields.priceWeekend), '2590');
    await pickAllergens(featuredName(3), [/Halak/, /Mustár/]);
    addVariation(featuredName(1), 'Közepes');

    const entered = gridContents();
    expect(entered).toHaveLength(6 * 7 + 3);
    // The comparison below sees the chips, not only the text fields.
    const entry = (name: string) => entered.find((contents) => contents.card === name);
    expect(entry(mainName(2, 2))?.variations).toEqual(['Kicsi', 'Nagy']);
    expect(entry(mainName(2, 3))?.allergens).toContain('Tej');
    expect(screen.getByText(t.actions.unsaved)).toBeTruthy();

    fireEvent.click(saveButton());
    expect(await screen.findByText(t.toasts.saved)).toBeTruthy();

    // One PUT carrying the whole week, in grid order.
    const puts = api.requests.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(1);
    const sent = puts[0]?.body as WeekDraft;
    expect(sent.days[2].mains.map((main) => main.name)).toEqual([
      'Főétel 2/1',
      'Főétel 2/2',
      'Főétel 2/3',
      'Főétel 2/4',
      'Főétel 2/5',
    ]);
    expect(sent.days[2].mains[1]?.variations).toEqual(['Kicsi', 'Nagy']);
    expect(sent.days[2].mains[2]?.allergens).toEqual(['gluten', 'milk']);
    expect(sent.days[2].mains[3]?.soupIncluded).toBe(false);
    expect(sent.days[6].mains[0]).toMatchObject({ priceWeekday: 1020, priceWeekend: 1120 });
    expect(sent.featured.map((f) => [f.name, f.priceWeekday, f.priceWeekend])).toEqual([
      ['Ajánlat 1', 2290, null],
      ['Ajánlat 2', 2390, 2590],
      ['Ajánlat 3', 2490, null],
    ]);
    expect(sent.days[1].soups[0]).toMatchObject({ priceWeekday: 0, allergens: ['celery'] });
    await waitFor(() => expect(saveButton().hasAttribute('disabled')).toBe(true));
    expect(gridContents()).toEqual(entered);

    view.unmount();
    await openWeek();
    expect(gridContents()).toEqual(entered);
  }, 30_000);
});

describe('acceptance 3: validation errors at their field', () => {
  it('shows the API rejecting a negative price in the cell it belongs to', async () => {
    await openWeek();

    // The first two mains of Wednesday stay blank, so the item is the first one sent.
    type(field(mainName(3, 3), t.fields.name), 'Pörkölt');
    type(field(mainName(3, 3), t.fields.price), '-50');
    fireEvent.click(saveButton());

    const price = field(mainName(3, 3), t.fields.price);
    await waitFor(() => expect(price.getAttribute('aria-invalid')).toBe('true'));
    expect(api.requests.find((r) => r.method === 'PUT')?.body).toMatchObject({
      days: { 3: { mains: [{ name: 'Pörkölt', priceWeekday: -50 }] } },
    });
    expect(within(card(mainName(3, 3))).getByText(t.fieldErrors.negative)).toBeTruthy();
    expect(screen.getAllByText(t.fieldErrors.negative)).toHaveLength(1);
    expect(await screen.findByText(strings.errors.byCode.validation)).toBeTruthy();

    // Editing the field clears its error.
    type(price, '1100');
    expect(price.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(t.fieldErrors.negative)).toBeNull();
  });

  it('does not send a price that is not a number, and says so at the field', async () => {
    await openWeek();

    fireEvent.click(screen.getByRole('button', { name: t.add.featured }));
    type(field(featuredName(1), t.fields.name), 'Steak');
    type(field(featuredName(1), t.fields.priceWeekend), 'sok');
    fireEvent.click(saveButton());

    expect(within(card(featuredName(1))).getByText(t.fieldErrors.required)).toBeTruthy();
    expect(within(card(featuredName(1))).getByText(t.fieldErrors.not_integer)).toBeTruthy();
    expect(api.requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('shows a missing name where the name goes', async () => {
    await openWeek();

    type(field(soupName(5, 2), t.fields.description), 'csípős');
    fireEvent.click(saveButton());

    expect(await within(card(soupName(5, 2))).findByText(t.fieldErrors.required)).toBeTruthy();
    expect(field(soupName(5, 2), t.fields.name).getAttribute('aria-invalid')).toBe('true');
  });
});

describe('a stored week', () => {
  it('opens with its items only, and adds and removes rows', async () => {
    api.seedWeek(2026, 42, oneDayWeek);
    await openWeek();

    expect(field(soupName(1, 1), t.fields.name).value).toBe('Gulyásleves');
    expect(screen.queryByRole('group', { name: soupName(1, 2) })).toBeNull();
    expect(screen.queryByRole('group', { name: mainName(3, 1) })).toBeNull();

    const addMain = screen.getAllByRole('button', { name: t.add.mains });
    fireEvent.click(addMain[2] as HTMLElement);
    expect(field(mainName(3, 1), t.fields.price).value).toBe('1020');
    fireEvent.click(within(card(mainName(2, 1))).getByRole('button', { name: t.removeRow }));
    expect(screen.queryByRole('group', { name: mainName(2, 1) })).toBeNull();
    expect(saveButton().hasAttribute('disabled')).toBe(false);

    fireEvent.click(saveButton());
    await screen.findByText(t.toasts.saved);
    const sent = api.requests.find((r) => r.method === 'PUT')?.body as WeekDraft;
    // The blank new row is left out; the removed one is missing from the payload.
    expect(sent.days[2].mains).toEqual([]);
    expect(sent.days[3].mains).toEqual([]);
  });

  it('marks an item sold out at once and keeps it when the API agrees', async () => {
    const stored = api.seedWeek(2026, 42, oneDayWeek, '2026-10-09T10:00:00.000Z');
    const id = stored.days[1].mains[0]?.id;
    await openWeek();
    expect(screen.getByText(/Publikálva:/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.actions.publish })).toBeNull();

    const release = api.hold(`POST /api/admin/menu/items/${id}/sold-out`);
    const toggle = within(card(mainName(1, 1))).getByRole('switch', { name: t.fields.soldOut });
    fireEvent.click(toggle);

    // Before the API answers.
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(api.requests.at(-1)).toEqual({
      method: 'POST',
      path: `/api/admin/menu/items/${id}/sold-out`,
      body: { soldOut: true },
    });
    await act(async () => release());
    expect(await screen.findByText(t.toasts.soldOut)).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(api.items.get(id ?? '')?.soldOut).toBe(true);
    // Not part of the save.
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('turns the sold-out switch back when the API fails', async () => {
    const stored = api.seedWeek(2026, 42, oneDayWeek);
    const id = stored.days[1].soups[0]?.id;
    api.fail(`POST /api/admin/menu/items/${id}/sold-out`, {
      status: 500,
      body: { error: 'internal' },
    });
    const release = api.hold(`POST /api/admin/menu/items/${id}/sold-out`);
    await openWeek();

    const toggle = within(card(soupName(1, 1))).getByRole('switch', { name: t.fields.soldOut });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    await act(async () => release());

    expect(await screen.findByText(strings.errors.byCode.internal)).toBeTruthy();
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  });

  it('cannot mark a row sold out before it is saved', async () => {
    await openWeek();

    const toggle = within(card(mainName(1, 1))).getByRole('switch', { name: t.fields.soldOut });
    expect(toggle.hasAttribute('disabled')).toBe(true);
  });
});

describe('closed dates', () => {
  it("closes Wednesday at once and opens it again, without touching the week's draft", async () => {
    await openWeek();
    type(field(mainName(1, 1), t.fields.name), 'Pörkölt');

    const release = api.hold('POST /api/admin/menu/closed-dates');
    const wednesday = screen.getByRole('switch', { name: `${t.days[3]}: ${t.closed}` });
    fireEvent.click(wednesday);
    // Before the API answers.
    await waitFor(() => expect(wednesday.getAttribute('aria-checked')).toBe('true'));
    expect(card(mainName(3, 1)).closest('td')?.hasAttribute('data-closed')).toBe(true);
    expect(card(mainName(2, 1)).closest('td')?.hasAttribute('data-closed')).toBe(false);
    await act(async () => release());
    expect(await screen.findByText(t.toasts.closed)).toBeTruthy();
    expect(api.closed.has('2026-10-14')).toBe(true);

    fireEvent.click(wednesday);
    await waitFor(() => expect(api.closed.has('2026-10-14')).toBe(false));
    expect(api.requests.at(-2)).toMatchObject({
      method: 'DELETE',
      path: '/api/admin/menu/closed-dates/2026-10-14',
    });
    expect(wednesday.getAttribute('aria-checked')).toBe('false');
    // Still editable, still unsaved.
    expect(field(mainName(1, 1), t.fields.name).value).toBe('Pörkölt');
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('reads the closed dates of the week shown', async () => {
    api.closed.add('2026-10-17');
    api.closed.add('2026-10-19');
    await openWeek();

    await waitFor(() =>
      expect(
        screen
          .getByRole('switch', { name: `${t.days[6]}: ${t.closed}` })
          .getAttribute('aria-checked'),
      ).toBe('true'),
    );
    expect(
      screen
        .getByRole('switch', { name: `${t.days[1]}: ${t.closed}` })
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(api.requests).toContainEqual({
      method: 'GET',
      path: '/api/admin/menu/closed-dates',
      body: undefined,
    });
  });
});

describe('publishing', () => {
  it('asks first, names the days without mains, and shows the week as published', async () => {
    api.seedWeek(2026, 42, oneDayWeek);
    await openWeek();
    expect(screen.getByText(t.week.draft)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t.actions.publish }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain(
      `${t.publishDialog.noMains} szerda, csütörtök, péntek, szombat.`,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: t.actions.publish }));
    expect(await screen.findByText(t.toasts.published)).toBeTruthy();
    expect(screen.getByText(/Publikálva: 2026\. október 9\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.actions.publish })).toBeNull();
    expect(api.requests).toContainEqual({
      method: 'POST',
      path: '/api/admin/menu/weeks/2026/42/publish',
      body: undefined,
    });
  });

  it('cannot publish unsaved changes', async () => {
    api.seedWeek(2026, 42, oneDayWeek);
    await openWeek();

    type(field(mainName(1, 1), t.fields.name), 'Rántott sertésszelet');
    const publish = screen.getByRole('button', { name: t.actions.publish });
    expect(publish.hasAttribute('disabled')).toBe(true);
    expect(publish.getAttribute('title')).toBe(t.actions.saveFirst);
  });
});

describe('unsaved changes', () => {
  it('asks before leaving the page, and stays on Maradok', async () => {
    await openWeek();
    type(field(mainName(1, 1), t.fields.name), 'Pörkölt');

    fireEvent.click(screen.getByRole('link', { name: strings.nav.orders }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(t.leaveDialog.title)).toBeTruthy();
    expect(location?.pathname).toBe(paths.weeklyMenu);

    fireEvent.click(within(dialog).getByRole('button', { name: t.leaveDialog.cancel }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(location?.pathname).toBe(paths.weeklyMenu);
    expect(field(mainName(1, 1), t.fields.name).value).toBe('Pörkölt');

    fireEvent.click(screen.getByRole('link', { name: strings.nav.orders }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.leaveDialog.confirm,
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: strings.pages.orders.title }),
    ).toBeTruthy();
  });

  it('asks before switching weeks', async () => {
    await openWeek();
    type(field(soupName(2, 1), t.fields.name), 'Húsleves');

    fireEvent.click(screen.getByRole('button', { name: t.week.next }));
    const dialog = await screen.findByRole('alertdialog');
    expect(location?.search).toBe('?week=2026-W42');
    fireEvent.click(within(dialog).getByRole('button', { name: t.leaveDialog.confirm }));
    await waitFor(() => expect(location?.search).toBe('?week=2026-W43'));
    expect(await screen.findByRole('heading', { name: /2026\/43\. hét/ })).toBeTruthy();
    expect(field(soupName(2, 1), t.fields.name).value).toBe('');
  });

  it('holds the tab open only while something is unsaved, and leaves freely after saving', async () => {
    await openWeek();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);

    type(field(mainName(4, 2), t.fields.name), 'Bableves');
    expect(unload()).toBe(true);

    fireEvent.click(saveButton());
    await screen.findByText(t.toasts.saved);
    expect(unload()).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: strings.nav.orders }));
    expect(
      await screen.findByRole('heading', { level: 1, name: strings.pages.orders.title }),
    ).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
