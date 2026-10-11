import { describe, expect, it, vi } from 'vitest';
import { ApiError, createWebApi } from '../lib/api';
import { dish, openMenu } from '../test/fixtures';
import { dayPrice, initialDate, isoWeekParam, loadMenuPage, weekPrice } from './week';

const { menu, orderableDates } = openMenu;

describe('isoWeekParam', () => {
  it('names the ISO week of the guest’s date', () => {
    expect(isoWeekParam(new Date(2026, 9, 11, 23, 30))).toBe('2026-W41');
    expect(isoWeekParam(new Date(2026, 9, 12, 0, 5))).toBe('2026-W42');
  });

  it('puts the first days of January in the last week of the year before', () => {
    expect(isoWeekParam(new Date(2027, 0, 1, 12))).toBe('2026-W53');
  });
});

describe('initialDate', () => {
  it('opens today when today is in the week, even past its cutoff', () => {
    expect(initialDate(menu, orderableDates, new Date(2026, 8, 8, 14))).toBe('2026-09-08');
  });

  it('opens the first orderable day when today is not in the week', () => {
    expect(initialDate(menu, ['2026-09-08', '2026-09-09'], new Date(2026, 8, 6, 20))).toBe(
      '2026-09-08',
    );
  });

  it('opens Monday when nothing can be ordered and today is not in the week', () => {
    expect(initialDate(menu, [], new Date(2026, 8, 13, 20))).toBe('2026-09-07');
  });
});

describe('dayPrice', () => {
  it('lists a daily soup as part of the menu, with the price it costs alone', () => {
    expect(dayPrice(dish('h-husleves'), '2026-09-07', 650)).toEqual({ kind: 'soup', alone: 650 });
  });

  it('lists a daily main at the price core charges on its day', () => {
    expect(dayPrice(dish('h-sertesporkolt'), '2026-09-07', 650)).toEqual({
      kind: 'price',
      amount: 1020,
      saturday: null,
    });
    expect(dayPrice(dish('szo-marhaporkolt'), '2026-09-12', 650)).toEqual({
      kind: 'price',
      amount: 1320,
      saturday: null,
    });
  });
});

describe('weekPrice', () => {
  it('adds the Saturday price when it differs', () => {
    expect(weekPrice(dish('cordon-bleu'), menu)).toEqual({
      kind: 'price',
      amount: 1690,
      saturday: 1790,
    });
  });

  it('leaves the Saturday price out when it is the same', () => {
    expect(weekPrice(dish('somloi'), menu)).toEqual({ kind: 'price', amount: 690, saturday: null });
  });

  it('lists a plain side as free', () => {
    expect(weekPrice(dish('hasabburgonya'), menu)).toEqual({ kind: 'free' });
  });
});

describe('loadMenuPage', () => {
  const sunday = new Date(2026, 8, 13, 20);

  function apiAnswering(answers: Record<string, () => Response>) {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const key = `${url.pathname}${url.search}`;
      const answer = answers[key];
      if (!answer) throw new Error(`unexpected request ${key}`);
      return answer();
    });
    return { api: createWebApi('https://api.example', fetchImpl), fetchImpl };
  }

  it('shows the order window’s week when it is open', async () => {
    const { api, fetchImpl } = apiAnswering({ '/api/menu': () => Response.json(openMenu) });
    await expect(loadMenuPage(api, sunday)).resolves.toEqual({
      kind: 'week',
      menu,
      orderableDates,
      closedDates: [],
      notice: null,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('falls back to the guest’s current week, to read, when next week is not published', async () => {
    const { api } = apiAnswering({
      '/api/menu': () => Response.json({ state: 'next_week_not_published' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ ...openMenu, orderableDates: [], closedDates: [] }),
    });
    await expect(loadMenuPage(api, sunday)).resolves.toEqual({
      kind: 'week',
      menu,
      orderableDates: [],
      closedDates: [],
      notice: 'next_week_not_published',
    });
  });

  it('shows nothing when the current week is not published either', async () => {
    const { api } = apiAnswering({
      '/api/menu': () => Response.json({ state: 'closed' }),
      '/api/menu?week=2026-W37': () =>
        Response.json({ error: 'week_not_published', message: 'No menu' }, { status: 404 }),
    });
    await expect(loadMenuPage(api, sunday)).resolves.toEqual({ kind: 'none', state: 'closed' });
  });

  it('keeps the API’s answer when the fallback fails for any other reason', async () => {
    const { api } = apiAnswering({
      '/api/menu': () => Response.json({ state: 'next_week_not_published' }),
      '/api/menu?week=2026-W37': () => Response.json({ error: 'internal' }, { status: 500 }),
    });
    await expect(loadMenuPage(api, sunday)).resolves.toEqual({
      kind: 'none',
      state: 'next_week_not_published',
    });
  });

  it('fails when the order window cannot be loaded', async () => {
    const { api } = apiAnswering({
      '/api/menu': () => Response.json({ error: 'internal' }, { status: 500 }),
    });
    await expect(loadMenuPage(api, sunday)).rejects.toBeInstanceOf(ApiError);
  });
});
