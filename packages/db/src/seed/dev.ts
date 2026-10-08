/**
 * `pnpm db:seed:dev` — fixture data (./fixtures.ts) for manual testing on a development branch: a
 * few permanent items and the current ISO week, published, with daily soups, daily mains and a
 * featured item.
 *
 * Idempotent: items have fixed ids and every insert skips rows that already exist, so running it
 * again (even after editing the fixtures by hand) changes nothing. In a new ISO week it adds and
 * publishes that week too.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoWeekOf, loadConfig, toZoned } from '@piccolo/core';
import { createDb, menuItems, menuSchedule, menuWeeks, sql } from '../index';
import { permanentItems, schedule, weeklyItems } from './fixtures';

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
            menuItemId: item.id,
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
