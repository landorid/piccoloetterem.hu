import { sql } from '@piccolo/db';
import { captureException } from '@sentry/cloudflare';
import { type ErrorHandler, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import pkg from '../package.json';
import type { AppEnv } from './env';
import { HttpError } from './errors';
import { withDb } from './middleware';

/**
 * Every `/api/*` route. Chained, so `AppType` carries the full route schema for the RPC client.
 * `withConfig` and `withDb` are attached per route or per router, never globally, so a route
 * that needs neither (and an unknown path) touches no binding.
 *
 * Every response is structured JSON. Error bodies carry a machine-readable `error` code; the
 * frontends map it to a Hungarian message in their own strings.ts, so no user-facing text
 * originates here.
 */
export const app = new Hono<AppEnv>()
  .basePath('/api')
  // Uses no binding at all: a frequent ping must not open a database connection and keep the
  // Neon compute awake (docs/STACK.md rule 3).
  .get('/health', (c) => c.json({ ok: true as const, version: pkg.version }))
  // Rarely called: wakes the database.
  .get('/health/db', withDb, async (c) => {
    await c.get('db').execute(sql`select 1`);
    return c.json({ ok: true as const });
  });

app.notFound((c) => c.json({ error: 'not_found', message: `No route for ${c.req.path}` }, 404));

/** Renders `HttpError` and Hono's 4xx as JSON; reports anything else to Sentry as a 500. */
export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.code, message: err.message }, err.status);
  }
  // Raised by Hono itself, e.g. a request body that is not valid JSON.
  if (err instanceof HTTPException && err.status < 500) {
    return c.json({ error: 'bad_request', message: err.message }, err.status);
  }
  const eventId = captureException(err);
  console.error(err);
  return c.json({ error: 'internal', eventId }, 500);
};

app.onError(handleError);

export type AppType = typeof app;
