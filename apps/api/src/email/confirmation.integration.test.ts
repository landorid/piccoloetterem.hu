/*
 * The confirmation e-mail against a real database: `sendConfirmation` reads a stored submission,
 * sends it through a stubbed SES, and marks its orders. Runs only when DATABASE_URL is set in the shell (a
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
import { memoryR2 } from '../images/memoryR2';
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
    ITEM_IMAGES: memoryR2(),
    SES_REGION: 'eu-west-1',
    SES_ACCESS_KEY_ID: 'AKIDEXAMPLE',
    SES_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  };

  /**
   * Stubs SES and records every SendEmail body. Any other request goes to the real `fetch`, which
   * the database driver uses.
   */
  function stubSes(): Record<string, unknown>[] {
    const realFetch = globalThis.fetch;
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (!request.url.startsWith('https://email.eu-west-1.amazonaws.com/')) {
        return realFetch(input, init);
      }
      sent.push(await request.json());
      return Response.json({ MessageId: `ses-message-${sent.length}` });
    });
    return sent;
  }

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
    vi.unstubAllGlobals();
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

  it('sends the e-mail once, logs it, marks every order, and skips the second time', async () => {
    const { submissionId, email } = await store('once');
    const sent = stubSes();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendConfirmation(env, submissionId);

    expect(sent).toHaveLength(1);
    const body = JSON.stringify(sent[0]);
    expect(sent[0]).toMatchObject({
      Destination: { ToAddresses: [email] },
      ReplyToAddresses: ['info@piccoloetterem.hu'],
    });
    expect(body).toContain('Rendelését rögzítettük – ');
    expect(body).toContain(`Leves felár  ${forint(650)}`);
    expect(body).toContain(`Leves nélkül  ${forint(-100)}`);
    expect(body).toContain(`Fizetendő összesen  ${forint(fixturePriced.total)}`);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toBe(
      `Confirmation for submission ${submissionId} sent through SES, message ses-message-1`,
    );
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
    expect(sent).toHaveLength(1);
  });

  it('rejects when SES is not configured and leaves the orders unmarked for a retry', async () => {
    const { submissionId } = await store('unsent');

    await expect(
      sendConfirmation({ ...env, SES_ACCESS_KEY_ID: undefined }, submissionId),
    ).rejects.toThrow('SES is not configured: set SES_ACCESS_KEY_ID.');
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
