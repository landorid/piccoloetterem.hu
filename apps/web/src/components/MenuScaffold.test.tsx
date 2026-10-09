import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicMenu, PublicMenuItem } from '../lib/api';
import { strings } from '../strings';
import { MenuScaffold } from './MenuScaffold';

// ISO week 2026/41: Monday 5 to Saturday 10 October.
const item = (
  id: number,
  category: PublicMenuItem['category'],
  name: string,
  extra: Partial<PublicMenuItem> = {},
): PublicMenuItem => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  category,
  name,
  description: null,
  priceWeekday: 1890,
  priceWeekend: null,
  variations: [],
  allergens: [],
  soupIncluded: category === 'daily_main',
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
  ...extra,
});

const day = (date: string, soups: PublicMenuItem[] = [], mains: PublicMenuItem[] = []) => ({
  date,
  soups,
  mains,
});

const menu: PublicMenu = {
  isoYear: 2026,
  isoWeek: 41,
  weekLabel: '2026/41. hét (10.05 – 10.10)',
  days: {
    1: day(
      '2026-10-05',
      [item(1, 'daily_soup', 'Gulyásleves', { allergens: ['celery', 'gluten'] })],
      [item(2, 'daily_main', 'Sertéspörkölt nokedlivel', { soldOut: true })],
    ),
    2: day('2026-10-06'),
    3: day('2026-10-07'),
    4: day('2026-10-08'),
    5: day('2026-10-09'),
    6: day('2026-10-10', [], [item(3, 'daily_main', 'Rakott krumpli', { priceWeekend: 2090 })]),
  },
  featured: [],
  permanent: {
    allWeek: [
      item(4, 'all_week', 'Rántott csirkemell', {
        priceWeekday: 2290,
        priceWeekend: 2490,
        variations: ['Csirkemell', 'Csirkecomb'],
      }),
    ],
    desserts: [],
    pickles: [],
    sides: [item(5, 'side', 'Hasábburgonya', { priceWeekday: 0 })],
    sideExtras: [],
  },
};

const render = (orderableDates: string[]) =>
  renderToStaticMarkup(<MenuScaffold menu={menu} orderableDates={orderableDates} />);

describe('MenuScaffold', () => {
  it('lists every day of the week with its dishes', () => {
    const html = render(['2026-10-09', '2026-10-10']);
    expect(html).toContain('2026/41. hét (10.05 – 10.10)');
    expect(html).toContain('október 5., hétfő');
    expect(html).toContain('október 10., szombat');
    expect(html).toContain('Gulyásleves');
    expect(html).toContain('Rántott csirkemell');
    expect(html).toContain('Hasábburgonya');
  });

  it('prices a daily main by its day, and gives a soup no price of its own', () => {
    const html = render([]);
    expect(html).toContain('Rakott krumpli</span><span class="dish-price">2090\u00a0Ft');
    expect(html).toContain(strings.scaffold.soupHint);
    expect(html).not.toContain('Gulyásleves</span><span class="dish-price">');
  });

  it('shows the weekend price of a weekly item when it differs', () => {
    expect(render([])).toContain('2290\u00a0Ft · hétvégén 2490\u00a0Ft');
  });

  it('names the allergens of each dish in the EU order, with their numbers', () => {
    expect(render([])).toContain(
      strings.scaffold.allergens('1 · Glutént tartalmazó gabonák, 9 · Zeller'),
    );
  });

  it('flags a sold-out dish and a day that cannot be ordered', () => {
    const html = render(['2026-10-09', '2026-10-10']);
    expect(html).toContain(strings.dish.soldOut);
    // Monday to Thursday.
    expect(html.split(strings.scaffold.notOrderable)).toHaveLength(5);
  });

  it('leaves out an empty section', () => {
    const html = render([]);
    expect(html).not.toContain(strings.scaffold.desserts);
    expect(html).toContain(strings.scaffold.sides);
  });
});
