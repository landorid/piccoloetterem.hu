import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// pnpm runs the db:* scripts from packages/db; DATABASE_URL lives in the repo-root .env.
// Variables already set in the environment take precedence over the file.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const databaseUrl = process.env.DATABASE_URL;

/**
 * drizzle-kit needs a direct connection: migrations run DDL in a session that PgBouncer's
 * transaction mode does not preserve. A Neon pooled host differs from the direct one only by
 * `-pooler`; any other URL (e.g. a local `postgres://`) is used as is.
 */
function directUrl(url: string): string {
  return url.replace('-pooler.', '.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  ...(databaseUrl ? { dbCredentials: { url: directUrl(databaseUrl) } } : {}),
});
