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
  isIsoWeek,
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
export {
  groupPermanentItems,
  type MenuItemContent,
  type PermanentItemDraft,
  type PermanentItemsDraft,
  type PermanentItemsErrorCode,
  type PermanentItemsErrors,
  type PermanentItemsPlan,
  type PermanentItemsResult,
  type PermanentMenu,
  type PermanentSection,
  type PlannedItem,
  type PlannedPermanentItem,
  type PlannedScheduleEntry,
  permanentDraftIds,
  permanentSections,
  planPermanentItems,
  planWeek,
  type WeekDayDraft,
  type WeekDraft,
  type WeekDraftErrorCode,
  type WeekDraftErrors,
  type WeekItemDraft,
  type WeekPlan,
  type WeekPlanResult,
  weekDraftIds,
} from './menu/edit';
export { priceFor } from './menu/price';
export { buildPublicMenu } from './menu/public';
export {
  categoriesForSlot,
  type FieldErrors as MenuItemFieldErrors,
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

export { isEmail, normaliseEmailKey, normalisePhone } from './order/normalise';
export { orderMessagesHu } from './order/orderMessages.hu';
export { priceDay, priceMenu, priceSubmission } from './order/price';
export {
  type ComposedMenuDraft,
  type DayDraft,
  type ExtraDraft,
  type FieldErrors,
  type Fulfilment,
  type OrderErrorCode,
  orderErrorCodes,
  type PriceAdjustment,
  type PricedDay,
  type PricedExtra,
  type PricedMenu,
  type PricedMenuItem,
  type PricedSubmission,
  type SubmissionDraft,
} from './order/types';
export { validateDay, validateMenu, validateSubmission } from './order/validate';
