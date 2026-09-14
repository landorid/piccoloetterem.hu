import { loadConfig } from '@piccolo/core';
import { createDb } from '@piccolo/db';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from './env';

/** `c.get('config')`: the deployment's `RestaurantConfig`, chosen by the `RESTAURANT` var. */
export const withConfig = createMiddleware<AppEnv>(async (c, next) => {
  c.set('config', loadConfig(c.env));
  await next();
});

/**
 * `c.get('db')`: a Drizzle client created for this request only. Hyperdrive does the pooling in
 * deployed environments; locally `DATABASE_URL` from `.dev.vars` is used. The client is released
 * after the response, whether the handler succeeded or threw.
 */
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  const connectionString = c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database configured: bind HYPERDRIVE or set DATABASE_URL in .dev.vars.');
  }
  const db = createDb(connectionString);
  c.set('db', db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(db.$client.end());
  }
});
