import {
  buildPublicMenu,
  type IsPublished,
  priceSubmission,
  type RestaurantConfig,
  type SubmissionDraft,
  validateSubmission,
} from '@piccolo/core';
import type { Db } from '@piccolo/db';
import { readSubmissionSource, writeSubmission } from './repo';
import { itemIdsOf, type Rejection, rejectionOf, type Snapshot, snapshotOf } from './submission';

export type SubmitResult = { ok: true; snapshot: Snapshot } | { ok: false; rejection: Rejection };

/**
 * Decides and stores a submission in one transaction.
 *
 * Everything that decides the outcome is read from the database inside the transaction, never
 * from the public menu cache (KV lags up to about a minute across locations): whether the week is
 * published, its closed dates, and each item's schedule, `active`, `sold_out`, name and prices.
 * The items stay locked until the commit (`readSubmissionSource`). Core validates and prices
 * against that menu, the response is decided by `rejectionOf`, and an accepted submission is
 * written in one statement. A rejected one writes nothing.
 *
 * `week` is the one ISO week of every delivery date (`submissionWeek`); `now` is the request time.
 */
export async function submitOrder(
  db: Db,
  config: RestaurantConfig,
  draft: SubmissionDraft,
  week: { isoYear: number; isoWeek: number },
  now: Date,
): Promise<SubmitResult> {
  return db.transaction(async (tx) => {
    const source = await readSubmissionSource(
      tx,
      week.isoYear,
      week.isoWeek,
      itemIdsOf(draft),
      config.timezone,
    );
    // Only the submission's items: enough for core to find, check and price each of them.
    const menu = buildPublicMenu(
      { ...week, publishedAt: source.publishedAt },
      source.schedule,
      source.items,
      config,
    );
    // Core asks about the week of the first orderable day. When that is another week, none of the
    // submitted dates can be in the order window, and `false` gives that same answer.
    const isPublished: IsPublished = (isoYear, isoWeek) =>
      isoYear === week.isoYear && isoWeek === week.isoWeek && source.publishedAt !== null;

    const errors = validateSubmission(draft, menu, config, now, isPublished, source.closedDates);
    const rejection = rejectionOf(draft, errors, source.closedDates, config.timezone);
    if (rejection) {
      return { ok: false, rejection };
    }

    const snapshot = snapshotOf(draft, priceSubmission(draft, menu, config));
    await writeSubmission(tx, snapshot.rows);
    return { ok: true, snapshot };
  });
}
