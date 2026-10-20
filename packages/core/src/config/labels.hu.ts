import type { AllergenCode, Category, Weekday } from './types';

export const allergenLabelsHu: Readonly<Record<AllergenCode, string>> = {
  gluten: 'Glutént tartalmazó gabonák',
  crustaceans: 'Rákfélék',
  eggs: 'Tojás',
  fish: 'Halak',
  peanuts: 'Földimogyoró',
  soybeans: 'Szójabab',
  milk: 'Tej és tejtermék (laktóz)',
  nuts: 'Diófélék',
  celery: 'Zeller',
  mustard: 'Mustár',
  sesame: 'Szezámmag',
  sulphites: 'Kén-dioxid és szulfitok',
  lupin: 'Csillagfürt',
  molluscs: 'Puhatestűek',
};

export const categoryLabelsHu: Readonly<Record<Category, string>> = {
  daily_soup: 'Napi leves',
  daily_main: 'Napi főétel',
  featured: 'Kiemelt ajánlat',
  all_week: 'Egész héten rendelhető',
  dessert: 'Desszert',
  pickle: 'Savanyúság',
  side: 'Köret',
  side_extra: 'Feláras köret',
};

export const weekdayNamesHu: Readonly<Record<Weekday, string>> = {
  1: 'hétfő',
  2: 'kedd',
  3: 'szerda',
  4: 'csütörtök',
  5: 'péntek',
  6: 'szombat',
  7: 'vasárnap',
};

/** Indexed by `Date#getMonth()`. */
export const monthNamesHu = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
] as const;

export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
