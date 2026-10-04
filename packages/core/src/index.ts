/**
 * Domain logic for the ordering platform. Pure TypeScript, no HTTP, no database:
 * everything here must be unit-testable in isolation (see docs/STACK.md rule 6).
 */
export const version = '0.0.0';

export { TZDate } from '@date-fns/tz';
export {
  datesOfIsoWeek,
  formatDateHu,
  isClosedDate,
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
export { priceFor } from './menu/price';
export { buildPublicMenu } from './menu/public';
export {
  categoriesForSlot,
  type FieldErrors,
  isAllergenCode,
  isCategory,
  isWeeklyCategory,
  type MenuItemErrorCode,
  slotsForCategory,
  validateMenuItem,
} from './menu/rules';
export {
  type MenuDay,
  type MenuItem,
  type MenuItemInput,
  type MenuWeek,
  type PublicMenu,
  type PublicMenuDay,
  type ScheduleEntry,
  type Slot,
  slots,
} from './menu/types';
export {
  firstOrderableDay,
  type IsPublished,
  isOrderable,
  type OrderWindow,
  orderWindow,
  type WindowConfig,
} from './menu/window';
