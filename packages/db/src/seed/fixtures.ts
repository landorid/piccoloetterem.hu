/**
 * The fixtures `pnpm db:seed:dev` (./dev.ts) inserts. Data only, with no database access, so a
 * test can check every item against `validateMenuItem` (./fixtures.test.ts).
 */
import type { MenuDay } from '@piccolo/core';
import type { menuItems } from '../schema';

/** Every column but the timestamps, so an item is also a complete `MenuItemInput`. */
export type SeedItem = Required<Omit<typeof menuItems.$inferInsert, 'createdAt' | 'updatedAt'>>;

const item = (
  fields: Pick<SeedItem, 'id' | 'category' | 'name' | 'priceWeekday'> & Partial<SeedItem>,
): SeedItem => ({
  description: null,
  priceWeekend: null,
  variations: [],
  allergens: [],
  soupIncluded: false,
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
  ...fields,
});

export const permanentItems = [
  item({
    id: '00000000-0000-4000-8000-000000000101',
    category: 'all_week',
    name: 'Rántott csirkemell',
    priceWeekday: 2350,
    priceWeekend: 2550,
    allergens: ['gluten', 'eggs'],
    requiresSide: true,
  }),
  item({
    id: '00000000-0000-4000-8000-000000000102',
    category: 'all_week',
    name: 'Cordon bleu',
    priceWeekday: 2650,
    variations: ['sertés', 'csirke'],
    allergens: ['gluten', 'eggs', 'milk'],
    requiresSide: true,
    sortOrder: 1,
  }),
  item({
    id: '00000000-0000-4000-8000-000000000103',
    category: 'side',
    name: 'Hasábburgonya',
    priceWeekday: 600,
  }),
  item({
    id: '00000000-0000-4000-8000-000000000104',
    category: 'side',
    name: 'Párolt rizs',
    priceWeekday: 500,
    sortOrder: 1,
  }),
  item({
    id: '00000000-0000-4000-8000-000000000105',
    category: 'side_extra',
    name: 'Steakburgonya',
    priceWeekday: 750,
  }),
  item({
    id: '00000000-0000-4000-8000-000000000106',
    category: 'pickle',
    name: 'Csemege uborka',
    priceWeekday: 350,
    allergens: ['sulphites'],
  }),
  item({
    id: '00000000-0000-4000-8000-000000000107',
    category: 'dessert',
    name: 'Túrós palacsinta',
    description: 'Két darab, vaníliás túrótöltelékkel.',
    priceWeekday: 790,
    allergens: ['gluten', 'eggs', 'milk'],
  }),
];

// A daily soup costs 0 on the item: its price comes from `RestaurantConfig.pricing` (included
// with a daily main, otherwise `soupPrice`).
export const weeklyItems = {
  goulash: item({
    id: '00000000-0000-4000-8000-000000000201',
    category: 'daily_soup',
    name: 'Gulyásleves',
    priceWeekday: 0,
    allergens: ['celery'],
  }),
  tomatoSoup: item({
    id: '00000000-0000-4000-8000-000000000202',
    category: 'daily_soup',
    name: 'Paradicsomleves betűtésztával',
    priceWeekday: 0,
    allergens: ['gluten', 'eggs', 'celery'],
  }),
  stew: item({
    id: '00000000-0000-4000-8000-000000000203',
    category: 'daily_main',
    name: 'Sertéspörkölt nokedlivel',
    priceWeekday: 2190,
    priceWeekend: 2390,
    allergens: ['gluten', 'eggs'],
    soupIncluded: true,
  }),
  layeredPotatoes: item({
    id: '00000000-0000-4000-8000-000000000204',
    category: 'daily_main',
    name: 'Rakott krumpli',
    priceWeekday: 2090,
    priceWeekend: 2290,
    variations: ['kolbásszal', 'kolbász nélkül'],
    allergens: ['eggs', 'milk'],
    soupIncluded: true,
  }),
  friedCheese: item({
    id: '00000000-0000-4000-8000-000000000205',
    category: 'featured',
    name: 'Rántott sajt tartármártással',
    priceWeekday: 2490,
    allergens: ['gluten', 'eggs', 'milk', 'mustard'],
    requiresSide: true,
  }),
};

/** day `null` = featured, all week. */
export const schedule: { day: MenuDay | null; item: SeedItem; sortOrder: number }[] = [
  ...([1, 3, 5] as const).map((day) => ({ day, item: weeklyItems.goulash, sortOrder: 0 })),
  ...([2, 4, 6] as const).map((day) => ({ day, item: weeklyItems.tomatoSoup, sortOrder: 0 })),
  ...([1, 2, 3] as const).map((day) => ({ day, item: weeklyItems.stew, sortOrder: 0 })),
  ...([4, 5, 6] as const).map((day) => ({ day, item: weeklyItems.layeredPotatoes, sortOrder: 0 })),
  { day: null, item: weeklyItems.friedCheese, sortOrder: 0 },
];
