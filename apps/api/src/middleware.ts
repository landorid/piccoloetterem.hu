import { loadConfig } from '@piccolo/core';
import { createDb } from '@piccolo/db';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from './env';

/** `c.get('config')`: the deployment's `RestaurantConfig`, chosen by the `RESTAURANT` var. */
export const withConfig = createMiddleware<AppEnv>(async (c, next) => {
  c.set('config', loadConfig(c.env));
  await next();
});

/**
 * The connection string every database client of this Worker uses: `HYPERDRIVE`'s when bound,
 * else `DATABASE_URL`. Shared by `withDb` and the clients opened outside a request, such as the
 * confirmation e-mail's after the response.
 */
export function databaseUrl(env: Pick<Bindings, 'HYPERDRIVE' | 'DATABASE_URL'>): string {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database configured: bind HYPERDRIVE or set DATABASE_URL in .dev.vars.');
  }
  return connectionString;
}

/**
 * `c.get('db')`: a Drizzle client created for this request only, through `HYPERDRIVE`: Hyperdrive
 * pools when deployed, and under `wrangler dev` the binding connects straight to `DATABASE_URL`
 * (scripts/dev.mjs). Without the binding, as in the tests, `DATABASE_URL`. The client connects on
 * its first query, so a request that sends none never opens a connection, and it is released
 * after the response, whether the handler succeeded or threw. `c.get('dbQueries')()` counts the
 * queries sent so far.
 */
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  let queries = 0;
  const db = createDb(databaseUrl(c.env), {
    logger: {
      logQuery() {
        queries += 1;
      },
    },
  });
  c.set('db', db);
  c.set('dbQueries', () => queries);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(db.$client.end());
  }
});
