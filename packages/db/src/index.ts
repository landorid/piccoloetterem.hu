/**
 * The Drizzle schema and `createDb()`. Queries live with the API handlers that need them; the
 * schema changes only together with a generated migration under `drizzle/`.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * A Drizzle instance over a `pg` pool of one connection. Works with a Hyperdrive connection
 * string, a Neon pooled URL and a plain local `postgres://` URL alike.
 *
 * On Workers, create one per request (Hyperdrive does the real pooling) and release it with
 * `db.$client.end()` once the response is sent.
 */
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;

export * from 'drizzle-orm';
export * from './schema';
