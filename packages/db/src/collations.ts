/**
 * Collations created by custom migrations; Drizzle's schema has no place for them.
 *
 * `natural_sort` (`drizzle/0001_natural_sort_collation.sql`): numbers by value, case and accents
 * ignored, so `fo ter 2` sorts before `Fő tér 10`. For `ORDER BY` only.
 */
export const naturalSort = 'natural_sort';
