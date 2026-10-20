import type { Bindings } from '../env';

/**
 * What happens after a submission is stored. `POST /api/orders` calls each method once the
 * transaction has committed, inside `executionCtx.waitUntil`: the guest's response is already on
 * its way, and a listener that fails (or rejects) never changes it. The route catches the
 * rejection and reports it to Sentry.
 *
 * A listener runs after the request's database client is released, so one that reads the orders
 * opens its own client from the same bindings (`HYPERDRIVE`, or `DATABASE_URL` in tests).
 *
 * The confirmation e-mail (O4, #32) is the only listener: `src/email/confirmation.ts`.
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

let listenersFor: (env: Bindings) => OrderEvents = () => noopOrderEvents;

/**
 * Installs the deployment's listeners. The Worker entry (`src/index.ts`) calls it, not `app.ts`:
 * the frontends typecheck everything `app.ts` imports (`@piccolo/api/types`), and the e-mail's
 * React template must stay out of that. Tests mount `publicOrderRoutes` with their own listeners.
 */
export function setOrderEvents(factory: (env: Bindings) => OrderEvents): void {
  listenersFor = factory;
}

/** The listeners of this deployment: the installed ones, or none (`noopOrderEvents`). */
export function orderEventsFor(env: Bindings): OrderEvents {
  return listenersFor(env);
}
