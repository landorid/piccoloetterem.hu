import { loadConfig } from '@piccolo/core';
import { createDb } from '@piccolo/db';
import type { Bindings } from '../env';
import { databaseUrl } from '../middleware';
import type { OrderEvents } from '../orders/events';
import { sendEmail } from './ses';
import { loadSubmissionForEmail, markConfirmationSent } from './submission';
import { renderOrderConfirmation } from './templates/OrderConfirmation';
import { confirmationEmail } from './view';

/**
 * Sends a stored submission's confirmation e-mail, once. Runs after the response (`OrderEvents`),
 * when the request's database client is already released, so it opens a client of its own.
 *
 * `confirmation_sent_at` is the idempotency guard: a submission with any order marked is skipped,
 * and the orders are marked only after SES accepted the e-mail (or dry run logged it), so a failed
 * send leaves them unmarked for a later attempt. Rejects on any failure; the caller reports it.
 */
export async function sendConfirmation(env: Bindings, submissionId: string): Promise<void> {
  const db = createDb(databaseUrl(env));
  try {
    const submission = await loadSubmissionForEmail(db, submissionId);
    if (!submission) {
      throw new Error(`No orders for submission ${submissionId}`);
    }
    if (submission.orders.some((order) => order.confirmationSentAt !== null)) {
      console.log(`Confirmation for submission ${submissionId} already sent; skipped`);
      return;
    }
    const { view, ...email } = confirmationEmail(submission, loadConfig(env));
    const { html, text } = await renderOrderConfirmation(view);
    await sendEmail(env, { ...email, html, text });
    await markConfirmationSent(db, submissionId);
  } finally {
    await db.$client.end();
  }
}

/** The deployment's `OrderEvents`: a stored submission gets its confirmation e-mail. */
export function confirmationEvents(env: Bindings): OrderEvents {
  return { orderSubmitted: (submissionId) => sendConfirmation(env, submissionId) };
}
