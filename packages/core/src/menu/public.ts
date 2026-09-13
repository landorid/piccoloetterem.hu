import type { TZDate } from '@date-fns/tz';
import { datesOfIsoWeek, isoDate, weekLabel } from '../calendar';
import type { Category, PermanentCategory, RestaurantConfig } from '../config/types';
import type {
  MenuDay,
  MenuItem,
  MenuWeek,
  PublicMenu,
  PublicMenuDay,
  ScheduleEntry,
} from './types';

/**
 * Assembles the guest-facing menu of `week` from its schedule and the item catalogue. Schedule
 * entries of other weeks, entries pointing at unknown or inactive items, and entries whose item
 * does not belong where it is scheduled are ignored. Sold-out items stay, with `soldOut` set.
 * Scheduled items keep the schedule's order; permanent items are ordered by `sortOrder`.
 * Publication is not checked here.
 */
export function buildPublicMenu(
  week: MenuWeek,
  schedule: readonly ScheduleEntry[],
  items: readonly MenuItem[],
  config: Pick<RestaurantConfig, 'timezone' | 'operatingDays'>,
): PublicMenu {
  const { isoYear, isoWeek } = week;
  const activeItems = items.filter((item) => item.active);
  const byId = new Map(activeItems.map((item) => [item.id, item]));
  const entries = schedule
    .filter((entry) => entry.isoYear === isoYear && entry.isoWeek === isoWeek)
    .toSorted((a, b) => a.sortOrder - b.sortOrder);

  const scheduled = (day: MenuDay | null, category: Category): MenuItem[] =>
    entries
      .filter((entry) => entry.day === day)
      .map((entry) => byId.get(entry.menuItemId))
      .filter((item): item is MenuItem => item?.category === category);

  const permanent = (category: PermanentCategory): MenuItem[] =>
    activeItems
      .filter((item) => item.category === category)
      .toSorted((a, b) => a.sortOrder - b.sortOrder);

  const [mon, tue, wed, thu, fri, sat] = datesOfIsoWeek(isoYear, isoWeek, config.timezone);
  const day = (menuDay: MenuDay, date: TZDate): PublicMenuDay => ({
    date: isoDate(date),
    soups: scheduled(menuDay, 'daily_soup'),
    mains: scheduled(menuDay, 'daily_main'),
  });

  return {
    isoYear,
    isoWeek,
    weekLabel: weekLabel(isoYear, isoWeek, config),
    days: {
      1: day(1, mon),
      2: day(2, tue),
      3: day(3, wed),
      4: day(4, thu),
      5: day(5, fri),
      6: day(6, sat),
    },
    featured: scheduled(null, 'featured'),
    permanent: {
      allWeek: permanent('all_week'),
      desserts: permanent('dessert'),
      pickles: permanent('pickle'),
      sides: permanent('side'),
      sideExtras: permanent('side_extra'),
    },
  };
}
