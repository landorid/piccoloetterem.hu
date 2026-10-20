// Runs one SQL statement against the run's database and prints the rows as JSON.
// The database is shared (the Neon development branch): read freely, write only rows you tag.
//
//   node .claude/skills/verify/scripts/sql.mjs "select id, total from orders where email = $1" "$ORDER_EMAIL"
//
// Connection: DATABASE_URL, else the run's state/db.url (VERIFY_RUN, else .verify/latest).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo =
  process.env.VERIFY_REPO ??
  execFileSync('git', ['-C', here, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const run = process.env.VERIFY_RUN ?? join(repo, '.verify', 'latest');
const urlFile = join(run, 'state', 'db.url');
const url =
  process.env.DATABASE_URL ?? (existsSync(urlFile) ? readFileSync(urlFile, 'utf8') : undefined);
if (!url) {
  console.error(`No DATABASE_URL and no ${urlFile}: start a run with up.sh or export it`);
  process.exit(1);
}

const [text, ...params] = process.argv.slice(2);
if (!text) {
  console.error('usage: sql.mjs "<statement>" [param ...]');
  process.exit(2);
}

const pg = createRequire(join(repo, 'packages', 'db', 'package.json'))('pg');
// pg treats `require` as `verify-full` already; spelling it out silences its SSL-mode warning.
const connectionString = url
  .trim()
  .replace(/sslmode=(prefer|require|verify-ca)\b/, 'sslmode=verify-full');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const result = await client.query(text, params);
  console.log(JSON.stringify(result.rows ?? [], null, 2));
  if (result.command !== 'SELECT') console.error(`${result.command} ${result.rowCount}`);
} finally {
  await client.end();
}
