import { captureException } from '@sentry/cloudflare';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../env';
import { withConfig, withDb } from '../middleware';
import { validate, validationFailed } from '../validation';
import { type OrderEvents, orderEventsFor } from './events';
import { clientKey, type RateLimiter, submissionLimiterFor } from './rateLimit';
import { submissionBody, submissionCaps } from './schemas';
import { submissionWeek } from './submission';
import { submitOrder } from './submit';

export interface OrderRouteDeps {
  /** The listeners told about a stored submission, after the commit. */
  eventsFor: (env: Bindings) => OrderEvents;
  /** The per-IP submission limit. */
  limiterFor: (env: Bindings) => RateLimiter;
  /** The request time; tests pass a fixed clock. */
  now: () => Date;
}

/**
 * Bots fill every field, people never see `website`: a filled honeypot gets a 200 that looks like
 * an accepted submission, and nothing is checked, counted or stored. Runs before validation, so a
 * bot's malformed body is not answered with a 400 either.
 */
const honeypot = createMiddleware<AppEnv>(async (c, next) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    // Not JSON: the validator answers it.
    return next();
  }
  const website = (body as { website?: unknown } | null)?.website;
  if (typeof website === 'string' && website !== '') {
    return c.json({ submissionId: crypto.randomUUID(), orders: [], grandTotal: 0 }, 200);
  }
  await next();
});

/**
 * `POST /api/orders`, mounted at `/api/orders`. Anonymous. Validates and prices a submission with
 * `packages/core` against the menu as the database holds it now (`submitOrder`), upserts the
 * customer and writes one order per delivery day, then tells `OrderEvents` after the commit.
 *
 * | Status | Body | When |
 * |---|---|---|
 * | 201 | `{ submissionId, orders: [{ id, deliveryDate, total }], grandTotal }` | Stored |
 * | 400 | `{ error: 'validation', fields }` | Malformed, over a size cap, days in different weeks, or a rule core rejects |
 * | 409 | `{ error: 'validation', fields }` | Every failure is `cutoff_passed` or `sold_out` |
 * | 409 | `{ error: 'date_closed', dates, fields }` | Staff closed one of the dates (#60) |
 * | 413 | `{ error: 'payload_too_large', message }` | Body over 64 KB |
 * | 429 | `{ error: 'rate_limited', message }` + `Retry-After` | Over 10 submissions in 10 minutes from one IP |
 *
 * A day under the minimum order is accepted (#57). Outside production `X-Db-Queries` counts the
 * database queries.
 */
export function publicOrderRoutes(deps: Partial<OrderRouteDeps> = {}) {
  const {
    eventsFor = orderEventsFor,
    limiterFor = submissionLimiterFor,
    now = () => new Date(),
  } = deps;

  return new Hono<AppEnv>().post(
    '/',
    bodyLimit({
      maxSize: submissionCaps.maxBodyBytes,
      onError: (c) =>
        c.json(
          {
            error: 'payload_too_large' as const,
            message: `The body is over ${submissionCaps.maxBodyBytes} bytes`,
          },
          413,
        ),
    }),
    honeypot,
    validate('json', submissionBody),
    withConfig,
    withDb,
    async (c) => {
      const at = now();
      const { website: _honeypot, ...draft } = c.req.valid('json');

      // Counted after validation: a malformed request costs neither a KV write nor a query.
      const client = clientKey(c.req.header('cf-connecting-ip'));
      if (client !== null) {
        const decision = await limiterFor(c.env).hit(client, at);
        if (!decision.allowed) {
          c.header('Retry-After', String(decision.retryAfterSeconds));
          return c.json(
            { error: 'rate_limited' as const, message: 'Too many submissions from this address' },
            429,
          );
        }
        c.executionCtx.waitUntil(decision.recorded);
      }

      const config = c.get('config');
      const week = submissionWeek(draft, config.timezone);
      if (!week.ok) {
        return validationFailed(c, week.fields);
      }

      const result = await submitOrder(c.get('db'), config, draft, week, at);
      if (c.env.ENVIRONMENT !== 'production') {
        c.header('X-Db-Queries', String(c.get('dbQueries')()));
      }

      if (!result.ok) {
        const { rejection } = result;
        if (rejection.error === 'date_closed') {
          return c.json(
            { error: 'date_closed' as const, dates: rejection.dates, fields: rejection.fields },
            409,
          );
        }
        return c.json({ error: 'validation' as const, fields: rejection.fields }, rejection.status);
      }

      const { snapshot } = result;
      c.executionCtx.waitUntil(
        Promise.resolve()
          .then(() => eventsFor(c.env).orderSubmitted(snapshot.submissionId, snapshot.orderIds))
          .catch((err) => {
            captureException(err, { extra: { submissionId: snapshot.submissionId } });
            console.error(`OrderEvents failed for submission ${snapshot.submissionId}`, err);
          }),
      );
      return c.json(snapshot.response, 201);
    },
  );
}
