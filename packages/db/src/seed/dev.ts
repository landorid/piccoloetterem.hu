/**
 * `pnpm db:seed:dev` — fixture data for manual testing on a development branch: a few permanent
 * items and the current ISO week, published, with daily soups, daily mains and a featured item.
 *
 * Idempotent: items have fixed ids and every insert skips rows that already exist, so running it
 * again (even after editing the fixtures by hand) changes nothing. In a new ISO week it adds and
 * publishes that week too.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoWeekOf, loadConfig, type MenuDay, toZoned } from '@piccolo/core';
import { createDb, menuItems, menuSchedule, menuWeeks, sql } from '../index';

type NewMenuItem = typeof menuItems.$inferInsert;

const item = (
  fields: Pick<NewMenuItem, 'id' | 'category' | 'name' | 'priceWeekday'> & Partial<NewMenuItem>,
): NewMenuItem => ({
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

const permanentItems = [
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

const weeklyItems = {
  goulash: item({
    id: '00000000-0000-4000-8000-000000000201',
    category: 'daily_soup',
    name: 'Gulyásleves',
    priceWeekday: 650,
    allergens: ['celery'],
  }),
  tomatoSoup: item({
    id: '00000000-0000-4000-8000-000000000202',
    category: 'daily_soup',
    name: 'Paradicsomleves betűtésztával',
    priceWeekday: 650,
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
const schedule: { day: MenuDay | null; item: NewMenuItem; sortOrder: number }[] = [
  ...([1, 3, 5] as const).map((day) => ({ day, item: weeklyItems.goulash, sortOrder: 0 })),
  ...([2, 4, 6] as const).map((day) => ({ day, item: weeklyItems.tomatoSoup, sortOrder: 0 })),
  ...([1, 2, 3] as const).map((day) => ({ day, item: weeklyItems.stew, sortOrder: 0 })),
  ...([4, 5, 6] as const).map((day) => ({ day, item: weeklyItems.layeredPotatoes, sortOrder: 0 })),
  { day: null, item: weeklyItems.friedCheese, sortOrder: 0 },
];

async function main() {
  const rootEnv = resolve(process.cwd(), '../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const config = loadConfig({ RESTAURANT: process.env.RESTAURANT ?? 'piccolo' });
  const { isoYear, isoWeek } = isoWeekOf(toZoned(new Date(), config.timezone));

  const db = createDb(url);
  try {
    await db.transaction(async (tx) => {
      const items = await tx
        .insert(menuItems)
        .values([...permanentItems, ...Object.values(weeklyItems)])
        .onConflictDoNothing()
        .returning({ id: menuItems.id });

      // A week that already exists as a draft gets published; an already published one keeps
      // its original timestamp.
      await tx
        .insert(menuWeeks)
        .values({ isoYear, isoWeek, publishedAt: new Date() })
        .onConflictDoUpdate({
          target: [menuWeeks.isoYear, menuWeeks.isoWeek],
          set: { publishedAt: sql`coalesce(${menuWeeks.publishedAt}, now())` },
        });

      const entries = await tx
        .insert(menuSchedule)
        .values(
          schedule.map(({ day, item, sortOrder }) => ({
            isoYear,
            isoWeek,
            day,
            menuItemId: item.id as string,
            sortOrder,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: menuSchedule.id });

      console.log(
        `Seeded ${isoYear}/${isoWeek} (published): ${items.length} new menu items, ` +
          `${entries.length} new schedule entries.`,
      );
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
