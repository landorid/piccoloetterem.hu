import type { Bindings } from '../env';

/**
 * What happens after a submission is stored. `POST /api/orders` calls each method once the
 * transaction has committed, inside `executionCtx.waitUntil`: the guest's response is already on
 * its way, and a listener that fails (or rejects) never changes it. The route catches the
 * rejection and reports it to Sentry.
 *
 * A listener runs after the request's database client is released, so one that reads the orders
 * opens its own client from the same bindings (`HYPERDRIVE`, or `DATABASE_URL` locally).
 *
 * The confirmation e-mail (O4, #32) is the first listener.
 */
export interface OrderEvents {
  /**
   * A submission was stored: `orderIds` are its orders, one per delivery day, in the order of the
   * submitted days. Every order has `submission_id = submissionId` and status `received`.
   */
  orderSubmitted(submissionId: string, orderIds: readonly string[]): Promise<void>;
}

/** Listens to nothing. */
export const noopOrderEvents: OrderEvents = {
  async orderSubmitted() {},
};

/** The listeners of this deployment. None yet: O4 adds the confirmation e-mail here. */
export function orderEventsFor(_env: Bindings): OrderEvents {
  return noopOrderEvents;
}
