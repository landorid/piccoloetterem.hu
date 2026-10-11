// @vitest-environment jsdom
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
  await screen.findByRole('region', { name: text.info.title });
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
    expect(soup.textContent).toContain(text.soupIncluded);
    expect(soup.textContent).toContain(text.soupAlone(forint(650)));
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

  it('lists the featured and permanent sections with weekday and Saturday prices', async () => {
    await renderPage();
    for (const title of Object.values(text.sections)) {
      expect(screen.getByRole('region', { name: title })).toBeTruthy();
    }
    expect(row('Cordon bleu').querySelector('.dish-price')?.textContent).toBe(
      forint(1690) + text.saturday(forint(1790)),
    );
    expect(row('Somlói galuska').querySelector('.dish-price')?.textContent).toBe(forint(690));
    // A plain side is free: no price at all.
    expect(row('Hasábburgonya').querySelector('.dish-price')).toBeNull();
  });

  it('prices the extras from the config and links every order button to /megrendeles', async () => {
    await renderPage();
    const prices = screen.getByRole('region', { name: text.prices.title });
    const amounts = [...prices.querySelectorAll('.dish')].map((li) => li.textContent);
    expect(amounts).toEqual([
      text.prices.soupAlone + forint(650),
      text.prices.noSoup + strings.common.minus(forint(100)),
      ...publicConfig.extras.map((extra) => extra.name + text.prices.perPiece(forint(extra.price))),
    ]);
    const links = screen.getAllByRole('link', { name: text.order });
    expect(links.length).toBe(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('/megrendeles');
  });

  it('shows the info card from the config', async () => {
    await renderPage();
    const info = screen.getByRole('region', { name: text.info.title });
    expect(info.textContent).toContain(text.info.deliveryFeeValue(forint(150)));
    expect(info.textContent).toContain(text.info.minimumValue(forint(2200)));
    expect(info.textContent).toContain('7:30–9:30');
    expect(within(info).getByRole('link', { name: publicConfig.contact.phone })).toBeTruthy();
    expect(info.textContent).toContain(publicConfig.contact.openingHours);
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
    // Only the info card's link: no order bar for a week that cannot be ordered.
    expect(screen.getAllByRole('link', { name: text.order }).length).toBe(1);
  });

  it('shows the current week to read when the order window is closed', async () => {
    answers = {
      '/api/menu': () => Response.json({ state: 'closed' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ ...openMenu, orderableDates: [], closedDates: [] }),
    };
    await renderPage(sunday);
    expect(screen.getByRole('status').textContent).toBe(
      text.notices.closedTitle + text.notices.closedBody,
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
