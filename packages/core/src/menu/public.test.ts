import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load';
import { buildPublicMenu } from './public';
import type { MenuItem, MenuWeek, ScheduleEntry } from './types';

const config = loadConfig({ RESTAURANT: 'piccolo' });

function item(id: string, category: MenuItem['category'], extra: Partial<MenuItem> = {}): MenuItem {
  return {
    id,
    category,
    name: id,
    description: null,
    priceWeekday: category === 'daily_soup' ? 0 : 1000,
    priceWeekend: null,
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
    soldOut: false,
    active: true,
    sortOrder: 0,
    ...extra,
  };
}

function entry(menuItemId: string, day: ScheduleEntry['day'], extra: Partial<ScheduleEntry> = {}) {
  return { isoYear: 2026, isoWeek: 37, day, menuItemId, sortOrder: 0, ...extra };
}

const week: MenuWeek = { isoYear: 2026, isoWeek: 37, publishedAt: new Date('2026-09-06T18:00Z') };
const ids = (items: MenuItem[]) => items.map((i) => i.id);

describe('buildPublicMenu', () => {
  const items = [
    item('soup-mon', 'daily_soup'),
    item('main-mon-b', 'daily_main'),
    item('main-mon-a', 'daily_main'),
    item('main-sat', 'daily_main', { soldOut: true }),
    item('main-inactive', 'daily_main', { active: false }),
    item('featured', 'featured'),
    item('all-week', 'all_week'),
    item('dessert-2', 'dessert', { sortOrder: 2 }),
    item('dessert-1', 'dessert', { sortOrder: 1 }),
    item('dessert-inactive', 'dessert', { active: false }),
    item('pickle', 'pickle'),
    item('side', 'side'),
    item('side-extra', 'side_extra'),
  ];
  const schedule = [
    entry('soup-mon', 1),
    entry('main-mon-b', 1, { sortOrder: 2 }),
    entry('main-mon-a', 1, { sortOrder: 1 }),
    entry('main-sat', 6),
    entry('main-inactive', 2),
    entry('featured', null),
    entry('main-mon-a', 3, { isoWeek: 38 }),
    entry('unknown-item', 4),
    entry('soup-mon', null),
    entry('featured', 5),
  ];
  const menu = buildPublicMenu(week, schedule, items, config);

  it('labels the week and dates every day from Monday to Saturday', () => {
    expect(menu.isoYear).toBe(2026);
    expect(menu.isoWeek).toBe(37);
    expect(menu.weekLabel).toBe('2026/37. hét (09.07 – 09.12)');
    expect(Object.values(menu.days).map((day) => day.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
  });

  it('puts scheduled soups and mains on their day, in schedule order', () => {
    expect(ids(menu.days[1].soups)).toEqual(['soup-mon']);
    expect(ids(menu.days[1].mains)).toEqual(['main-mon-a', 'main-mon-b']);
  });

  it('keeps sold-out items, flagged (rule: sold out is a manual per-item flag)', () => {
    expect(menu.days[6].mains).toEqual([
      expect.objectContaining({ id: 'main-sat', soldOut: true }),
    ]);
  });

  it('excludes inactive items', () => {
    expect(menu.days[2].mains).toEqual([]);
    expect(ids(menu.permanent.desserts)).not.toContain('dessert-inactive');
  });

  it('ignores other weeks, unknown items and items scheduled where their category does not go', () => {
    expect(menu.days[3].mains).toEqual([]);
    expect(menu.days[4].mains).toEqual([]);
    expect(menu.days[5].mains).toEqual([]);
    expect(ids(menu.featured)).toEqual(['featured']);
  });

  it('groups permanent items by category, ordered by sortOrder', () => {
    expect({
      allWeek: ids(menu.permanent.allWeek),
      desserts: ids(menu.permanent.desserts),
      pickles: ids(menu.permanent.pickles),
      sides: ids(menu.permanent.sides),
      sideExtras: ids(menu.permanent.sideExtras),
    }).toEqual({
      allWeek: ['all-week'],
      desserts: ['dessert-1', 'dessert-2'],
      pickles: ['pickle'],
      sides: ['side'],
      sideExtras: ['side-extra'],
    });
  });

  it('builds an empty week without failing', () => {
    const empty = buildPublicMenu({ ...week, publishedAt: null }, [], [], config);
    expect(empty.days[1]).toEqual({ date: '2026-09-07', soups: [], mains: [] });
    expect(empty.featured).toEqual([]);
  });
});
