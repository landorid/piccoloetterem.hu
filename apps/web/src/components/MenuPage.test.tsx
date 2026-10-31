// @vitest-environment jsdom
import type { MenuItem } from '@piccolo/core';
import { allergenLabelsHu } from '@piccolo/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forint } from '../format';
import { strings } from '../strings';
import { openMenu, publicConfig } from '../test/fixtures';
import { MenuPage } from './MenuPage';

const text = strings.menuPage;
let answers: Record<string, () => Response>;

beforeEach(() => {
  answers = { '/api/menu': () => Response.json(openMenu) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const answer = answers[`${url.pathname}${url.search}`];
      return answer ? answer() : Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Wednesday 9 September 2026, 14:00: past the cutoff, Monday and Tuesday already gone. */
const wednesdayAfternoon = () => new Date(2026, 8, 9, 14, 0);
/** Sunday 13 September 2026: still week 37 for the guest. */
const sunday = () => new Date(2026, 8, 13, 20, 0);

/** Renders the page and waits until the menu, or what replaces it, has loaded. */
async function renderPage(now = wednesdayAfternoon) {
  render(<MenuPage initial={{ config: publicConfig }} now={now} />);
  await waitFor(() => expect(screen.queryByText(strings.week.loading)).toBeNull());
}

const panel = () => screen.getByRole('tabpanel');
/** The list row of a dish; prices are read from its text, which keeps `forint`'s no-break space. */
const row = (name: string) => {
  const li = screen.getAllByText(name)[0]?.closest('li');
  if (!li) throw new Error(`no row ${name}`);
  return li;
};

describe('MenuPage', () => {
  it('opens today’s tab and lists its soups as part of the menu price', async () => {
    await renderPage();
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toMatch(
      /^Szerda/,
    );
    const soup = row('Húsleves cérnametélttel');
    expect(panel().contains(soup)).toBe(true);
    // As on the old site: the menu's price covers the soup, so the soup names no price of its own.
    expect(soup.querySelector('.dish-price')?.textContent).toBe(text.soupIncluded);
    expect(soup.querySelector('.dish-amt')).toBeNull();
  });

  it('lets the guest read a past day and Saturday, at Saturday’s own price', async () => {
    await renderPage();
    const monday = screen.getByRole('tab', { name: /^Hétfő/ });
    expect(monday.hasAttribute('disabled')).toBe(false);
    fireEvent.click(monday);
    expect(within(panel()).getByText('Sertéspörkölt')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /^Szombat/ }));
    expect(row('Marhapörkölt').querySelector('.dish-amt')?.textContent).toBe(forint(1320));
  });

  it('shows allergens per dish and marks sold-out dishes', async () => {
    await renderPage();
    expect(
      within(row('Húsleves cérnametélttel')).getByRole('button', {
        name: `1 · ${allergenLabelsHu.gluten}`,
      }),
    ).toBeTruthy();
    const soldOut = within(panel()).getByText('Gombás csirkemell').closest('li');
    expect(soldOut?.className).toContain('is-soldout');
    expect(soldOut?.textContent).toContain(strings.dish.soldOut);
  });

  it('says so on a daily main whose price leaves the soup out, and only there', async () => {
    const menu = structuredClone(openMenu);
    const lasagne = menu.menu.days[3].mains.find((main) => main.name === 'Lasagne');
    if (!lasagne) throw new Error('no Lasagne');
    lasagne.soupIncluded = false;
    answers['/api/menu'] = () => Response.json(menu);
    await renderPage();
    expect(within(row('Lasagne')).getByText(text.withoutSoup)).toBeTruthy();
    expect(within(panel()).getAllByText(text.withoutSoup)).toHaveLength(1);
  });

  it('lists the featured and permanent sections with their weekday price', async () => {
    await renderPage();
    for (const title of Object.values(text.sections)) {
      expect(screen.getByRole('region', { name: title })).toBeTruthy();
    }
    expect(row('Cordon bleu').querySelector('.dish-price')?.textContent).toBe(forint(1690));
    expect(row('Somlói galuska').querySelector('.dish-price')?.textContent).toBe(forint(690));
    // A plain side is free: no price at all.
    expect(row('Hasábburgonya').querySelector('.dish-price')).toBeNull();
  });

  it('lists the featured and permanent sections at their weekend price on Saturday', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /^Szombat/ }));
    expect(row('Cordon bleu').querySelector('.dish-price')?.textContent).toBe(forint(1790));
    expect(row('Rántott trapista sajt').querySelector('.dish-price')?.textContent).toBe(
      forint(1390),
    );
    // No weekend price of its own: the weekday one applies.
    expect(row('Somlói galuska').querySelector('.dish-price')?.textContent).toBe(forint(690));
  });

  it('lists the paid sides with their price in the sides card, after the free ones', async () => {
    await renderPage();
    const sides = screen.getByRole('region', { name: text.sections.sides });
    const names = [...sides.querySelectorAll('.dish-title')].map((title) => title.textContent);
    expect(names.slice(-3)).toEqual(['Steak burgonya', 'Édesburgonya-hasáb', 'Rizi-bizi']);
    expect(within(sides).getByText('Rizi-bizi').closest('li')?.textContent).toContain(forint(250));
    expect(
      within(sides).getByText('Párolt rizs').closest('li')?.querySelector('.dish-price'),
    ).toBeNull();
  });

  it('renders the day and each section as sibling blocks the page grid can place', async () => {
    const { container } = render(
      <MenuPage initial={{ config: publicConfig }} now={wednesdayAfternoon} />,
    );
    await waitFor(() => expect(screen.queryByText(strings.week.loading)).toBeNull());
    const areas = [...container.querySelectorAll(':scope > [data-area]')].map(
      (block) => (block as HTMLElement).dataset.area,
    );
    expect(areas).toEqual([
      'day',
      'featured',
      'all-week',
      'desserts',
      'pickles',
      'sides',
      'prices',
    ]);
    expect(container.querySelector('[data-area="day"]')?.id).toBe('heti-menu');
  });

  it('leads an étlap list with tiles once one of its dishes has a photo, never a weekly list', async () => {
    const withPhoto = (item: MenuItem) =>
      item.id === 'somloi' || item.id === 'sze-husleves' ? { ...item, imageVersion: 'v1' } : item;
    const { menu } = openMenu;
    answers['/api/menu'] = () =>
      Response.json({
        ...openMenu,
        menu: {
          ...menu,
          days: Object.fromEntries(
            Object.entries(menu.days).map(([n, d]) => [n, { ...d, soups: d.soups.map(withPhoto) }]),
          ),
          permanent: { ...menu.permanent, desserts: menu.permanent.desserts.map(withPhoto) },
        },
      });
    await renderPage();
    const desserts = screen.getByRole('region', { name: text.sections.desserts });
    const tiles = [...desserts.querySelectorAll('.dish')].map((dish) =>
      dish.querySelector('.tile'),
    );
    expect(tiles.every((tile) => tile !== null)).toBe(true);
    expect(row('Somlói galuska').querySelector('.tile img')?.getAttribute('src')).toBe(
      'https://img-dev.piccoloetterem.hu/somloi/v1/thumb',
    );
    expect(row('Túrógombóc').querySelector('.tile img')).toBeNull();
    expect(panel().querySelector('.tile')).toBeNull();
    expect(
      screen.getByRole('region', { name: text.sections.pickles }).querySelector('.tile'),
    ).toBeNull();
  });

  it('prices the extras from the config', async () => {
    await renderPage();
    const prices = screen.getByRole('region', { name: text.prices.title });
    const amounts = [...prices.querySelectorAll('.dish')].map((li) => li.textContent);
    expect(amounts).toEqual([
      text.prices.soupAlone + forint(650),
      text.prices.noSoup + strings.common.minus(forint(100)),
      ...publicConfig.extras.map((extra) => extra.name + text.prices.perPiece(forint(extra.price))),
    ]);
  });

  it('shows the current week to read when next week is not published', async () => {
    answers = {
      '/api/menu': () => Response.json({ state: 'next_week_not_published' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ ...openMenu, orderableDates: [], closedDates: [] }),
    };
    await renderPage(sunday);
    expect(screen.getByRole('status').textContent).toContain(text.notices.nextWeekTitle);
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toMatch(
      /^Hétfő/,
    );
  });

  it('shows the current week to read when the order window is closed', async () => {
    answers = {
      '/api/menu': () => Response.json({ state: 'closed' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ ...openMenu, orderableDates: [], closedDates: [] }),
    };
    await renderPage(sunday);
    expect(screen.getByRole('status').textContent).toBe(
      `${text.notices.closedTitle + text.notices.closedBody} ${publicConfig.contact.phone}`,
    );
  });

  it('marks a day staff closed, and still lists its dishes', async () => {
    answers = {
      '/api/menu': () =>
        Response.json({
          ...openMenu,
          orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'],
          closedDates: ['2026-09-10'],
        }),
    };
    await renderPage();
    const thursday = screen.getByRole('tab', { name: /^Csütörtök/ });
    expect(thursday.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(thursday);
    expect(panel().textContent).toContain(strings.errors.closedDay);
    expect(within(panel()).getByText('Milánói makaróni')).toBeTruthy();
  });

  it('says only that a closed day without dishes cannot be ordered', async () => {
    answers = {
      '/api/menu': () =>
        Response.json({
          ...openMenu,
          menu: {
            ...openMenu.menu,
            days: {
              ...openMenu.menu.days,
              4: { ...openMenu.menu.days[4], soups: [], mains: [] },
            },
          },
          orderableDates: ['2026-09-09', '2026-09-11', '2026-09-12'],
          closedDates: ['2026-09-10'],
        }),
    };
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /^Csütörtök/ }));
    expect(panel().textContent).toContain(strings.errors.closedDay);
    expect(panel().textContent).not.toContain(strings.menuPage.emptyDay);
  });

  it('says so when no week is published', async () => {
    answers = {
      '/api/menu': () => Response.json({ state: 'closed' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ error: 'week_not_published', message: 'No menu' }, { status: 404 }),
    };
    await renderPage(sunday);
    expect(screen.getByRole('heading', { name: strings.errors.emptyWeekTitle })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('offers a retry when the menu cannot be loaded', async () => {
    answers = { '/api/menu': () => Response.json({ error: 'internal' }, { status: 500 }) };
    await renderPage();
    expect(screen.getByRole('heading', { name: strings.errors.loadFailedTitle })).toBeTruthy();
    answers = { '/api/menu': () => Response.json(openMenu) };
    fireEvent.click(screen.getByRole('button', { name: strings.errors.retry }));
    expect(await screen.findByRole('tabpanel')).toBeTruthy();
  });
});
