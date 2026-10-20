/**
 * The weekly Word menu card (.docx) read into a week of the menu. Its own entry point,
 * `@piccolo/core/menu-card`, so the zip reader it needs stays out of the apps that do not import it.
 */
export {
  type CardImportResult,
  type CardPlace,
  type DateRange,
  type ImportedWeek,
  type ImportFailure,
  type ImportFinding,
  type IsoWeekRef,
  type MonthDay,
  readMenuCard,
} from './read';
