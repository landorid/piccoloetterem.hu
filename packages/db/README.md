# @piccolo/db

The Drizzle schema for the domain model, its generated migrations (`drizzle/`) and `createDb()`.
Queries belong to the API issues that need them, not here.

```ts
import { createDb, eq, orders } from '@piccolo/db';

const db = createDb(connectionString); // a pg pool of one connection
const rows = await db.select().from(orders).where(eq(orders.deliveryDate, '2026-09-14'));
await db.$client.end();
```

## Connection strings

| Variable | Value | Used by |
|---|---|---|
| `DATABASE_URL` | The Neon branch's **pooled** URL: host `ep-<name>-pooler.<region>.aws.neon.tech` | the app, `db:seed:dev`, `db:studio` |
| *(derived)* | The **direct** URL: the same string with `-pooler` removed from the host | `db:migrate` |

There is no second variable to set. `drizzle.config.ts` derives the direct URL itself, because
migrations run DDL in a session that the pooler's transaction mode does not keep. A plain local
`postgres://user:pass@localhost:5432/db` URL has no `-pooler` and is used as is. In production
the Worker gets its connection string from the Hyperdrive binding instead (#19).

Neon's console hands out URLs ending in `sslmode=require&channel_binding=require`. With them `pg`
prints a `SECURITY WARNING` about SSL modes on every connection; it is harmless (`require` is
already treated as `verify-full`), and writing `sslmode=verify-full` in the URL silences it.

Put `DATABASE_URL` in the repo-root `.env` (see `.env.example`). The `db:*` scripts load that file;
a variable already exported in your shell wins over it. Never commit the URL.

## Your development branch on Neon

Every developer works on their own Neon branch; it is also the test database.

1. Neon console → the project → **Branches** → **Create branch**. Name it e.g. `dev-<you>`, parent
   `main`. With the CLI: `neonctl branches create --name dev-<you> --project-id <project>`.
2. Open the branch → **Connect** → enable **Connection pooling** → copy the URL into `.env` as
   `DATABASE_URL`.
3. Apply the migrations and add fixtures:

   ```bash
   pnpm db:migrate
   pnpm db:seed:dev
   ```

## Commands (from the repo root)

| Command | What it does |
|---|---|
| `pnpm db:generate` | Diffs `src/schema/` against the last snapshot and writes a new SQL migration to `drizzle/`. |
| `pnpm db:migrate` | Applies pending migrations (`drizzle-kit migrate`, over the direct URL). Records them in `drizzle.__drizzle_migrations`. |
| `pnpm db:seed:dev` | Idempotent fixtures: a few permanent items and the current ISO week, published. Development branches only. |
| `pnpm db:studio` | Opens Drizzle Studio on `DATABASE_URL`. |

## Changing the schema

1. Edit the table in `src/schema/`.
2. `pnpm db:generate`, read the generated SQL, commit it together with the schema change.
3. `pnpm db:migrate` on your branch.

Never edit an applied migration and never change the schema without a migration: every later
issue imports its tables from here. Running `pnpm db:generate` on a clean tree must report no
changes.

## Resetting a branch

- **Neon console:** the branch → **Reset from parent**. Or with the CLI:
  `neonctl branches reset dev-<you> --parent --project-id <project>`. The branch then matches its
  parent. If the parent has no schema, run `pnpm db:migrate` and `pnpm db:seed:dev` again.
- **Without touching Neon** (also works on a local container): drop what the migrations created,
  then migrate again.

  ```bash
  psql "$DATABASE_URL" -c 'drop schema public cascade; create schema public; drop schema if exists drizzle cascade;'
  pnpm db:migrate
  ```

## Running the tests against a database

`pnpm test` runs the schema tests without a database. With `DATABASE_URL` exported in the shell,
it also runs a read-only query through `createDb` against that (migrated) database:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm exec vitest run --project=@piccolo/db
```
