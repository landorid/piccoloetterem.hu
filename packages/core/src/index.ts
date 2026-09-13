/**
 * Domain logic for the ordering platform. Pure TypeScript, no HTTP, no database:
 * everything here must be unit-testable in isolation (see docs/STACK.md rule 6).
 */
export const version = '0.0.0';

export { TZDate } from '@date-fns/tz';
export {
  datesOfIsoWeek,
  formatDateHu,
  isHoliday,
  isOperatingDay,
  isoDate,
  isoWeekOf,
  isWeekendPrice,
  parseIsoDate,
  toZoned,
  type WeekDates,
  weekday,
  weekLabel,
} from './calendar';
export { allergenLabelsHu, categoryLabelsHu } from './config/labels.hu';
export { loadConfig } from './config/load';
export {
  type AllergenCode,
  allergenCodes,
  type Category,
  type ExtraDef,
  type PermanentCategory,
  permanentCategories,
  type RestaurantConfig,
  type Weekday,
  type WeeklyCategory,
  weeklyCategories,
} from './config/types';
