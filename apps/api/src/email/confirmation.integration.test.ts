/*
 * The confirmation e-mail against a real database: `sendConfirmation` reads a stored submission,
 * logs it in dry run, and marks its orders. Runs only when DATABASE_URL is set in the shell (a
 * database `pnpm db:migrate` has migrated).
 *
 * That database may also serve a deployed development environment, so the test never truncates:
 * it stores its submissions on dates of a random week in the 2090s, under e-mail addresses of its
 * own, and deletes every row it created afterwards.
 */
import { datesOfIsoWeek, isoDate } from '@piccolo/core';
import { asc, createDb, customers, eq, inArray, like, orders } from '@piccolo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../env';
import { memoryKv } from '../menu/memoryKv';
import { writeSubmission } from '../orders/repo';
import { snapshotOf } from '../orders/submission';
import { sendConfirmation } from './confirmation';
import { fixtureDraft, fixturePriced } from './fixture';
import { forint } from './format';

const url = process.env.DATABASE_URL;
const tz = 'Europe/Budapest';

describe.skipIf(!url)('sendConfirmation against DATABASE_URL', () => {
  const db = createDb(url ?? '');
  const run = crypto.randomUUID().slice(0, 8);
  const emailPrefix = `o4-test-${run}`;
  const week = datesOfIsoWeek(
    2090 + Math.floor(Math.random() * 10),
    1 + Math.floor(Math.random() * 50),
    tz,
  );
  const env: Bindings = {
    DATABASE_URL: url,
    RESTAURANT: 'piccolo',
    ENVIRONMENT: 'development',
    MENU_CACHE: memoryKv(),
    EMAIL_DRY_RUN: '1',
  };

  /** Stores the fixture submission (Tuesday and Thursday of the test's week) for `who`. */
  async function store(who: string): Promise<{ submissionId: string; email: string }> {
    const email = `${emailPrefix}-${who}@example.com`;
    const [tuesday, thursday] = fixtureDraft.days;
    if (!tuesday || !thursday) {
      throw new Error('The fixture has two days');
    }
    const { submissionId, rows } = snapshotOf(
      {
        ...fixtureDraft,
        email,
        days: [
          { ...tuesday, deliveryDate: isoDate(week[1]) },
          { ...thursday, deliveryDate: isoDate(week[3]) },
        ],
      },
      fixturePriced,
    );
    // The fixture's items are not in `menu_items`; the reference is nullable, the snapshot is not.
    const items = rows.items.map((item) => ({ ...item, menuItemId: null }));
    await db.transaction((tx) => writeSubmission(tx, { ...rows, items }));
    return { submissionId, email };
  }

  const sentAt = async (submissionId: string) =>
    (
      await db
        .select({ at: orders.confirmationSentAt })
        .from(orders)
        .where(eq(orders.submissionId, submissionId))
        .orderBy(asc(orders.deliveryDate))
    ).map((row) => row.at);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const pattern = `${emailPrefix}-%`;
    await db.delete(orders).where(like(orders.email, pattern));
    await db.delete(customers).where(like(customers.email, pattern));
    const left = await db.select().from(orders).where(like(orders.email, pattern));
    await db.$client.end();
    expect(left).toEqual([]);
  });

  it('logs the e-mail in dry run once, marks every order, and skips the second time', async () => {
    const { submissionId, email } = await store('once');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendConfirmation(env, submissionId);

    expect(log).toHaveBeenCalledTimes(1);
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).toContain('[email dry run]');
    expect(logged).toContain(`To: ${email}`);
    expect(logged).toContain('Reply-To: info@piccoloetterem.hu');
    expect(logged).toContain('Subject: Rendelését rögzítettük – ');
    expect(logged).toContain(`Leves felár  ${forint(650)}`);
    expect(logged).toContain(`Leves nélkül  ${forint(-100)}`);
    expect(logged).toContain(`Fizetendő összesen  ${forint(fixturePriced.total)}`);
    const marked = await sentAt(submissionId);
    expect(marked).toHaveLength(2);
    expect(marked.every((at) => at instanceof Date)).toBe(true);

    log.mockClear();
    await sendConfirmation(env, submissionId);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toBe(
      `Confirmation for submission ${submissionId} already sent; skipped`,
    );
    expect(await sentAt(submissionId)).toEqual(marked);
  });

  it('rejects when SES is not configured and leaves the orders unmarked for a retry', async () => {
    const { submissionId } = await store('unsent');

    await expect(
      sendConfirmation({ ...env, EMAIL_DRY_RUN: undefined }, submissionId),
    ).rejects.toThrow(
      'SES is not configured: set SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY.',
    );
    expect(await sentAt(submissionId)).toEqual([null, null]);
  });

  it('rejects a submission id with no orders', async () => {
    const missing = crypto.randomUUID();
    await expect(sendConfirmation(env, missing)).rejects.toThrow(
      `No orders for submission ${missing}`,
    );
    expect(
      await db
        .select()
        .from(orders)
        .where(inArray(orders.submissionId, [missing])),
    ).toEqual([]);
  });
});
