# Database backup and restore

The Neon `production` branch is dumped every night to a private R2 bucket. This page says what is
backed up, where the copies live, and how to restore one. Neon's own point-in-time restore covers
only the last 6 hours on the Free plan; these copies cover the last 30 days and survive the loss of
the Neon project.

## What, when, where

| | |
|---|---|
| What | The whole `production` database: every schema, including the `drizzle` migration journal. Custom-format `pg_dump`, compressed, no owners and no grants. |
| When | Every night at 00:30 UTC (01:30 or 02:30 in Budapest), by `.github/workflows/backup.yml`. |
| Where | R2 bucket `piccolo-db-backups-production`, key `daily/piccolo-production-<UTC timestamp>.dump`. The bucket is private: no public domain, no `r2.dev` URL. |
| How long | 30 days, by a lifecycle rule on `daily/`. A bucket lock rule keeps every object for at least 7 days, so no one can delete or overwrite a recent copy, not even with the upload token. |
| Checked | Each night the workflow restores the fresh dump into an empty Postgres 18 and fails if `orders` or `menu_items` comes back empty. Only then does it upload. |
| Failure | A red workflow run, and an e-mail to whoever last changed the `cron` line. |

The dump holds customer names, phone numbers, e-mail and delivery addresses. It is not encrypted;
the private bucket and the scoped token keep it private. Never attach a dump to an issue, a PR or
an Actions artifact (the repository is public), and delete local copies when you are done.

**Not covered:** the `development` branch (schema only) and the dish-photo bucket.

**The schedule can stop without an e-mail.** GitHub disables scheduled workflows in a public
repository after 60 days without activity, and a schedule runs only from `main`. Look at the
**Backup** workflow's runs now and then.

## Secrets and variables

On the `production` GitHub Environment (no required reviewers, or every nightly run waits for
approval):

| Name | Kind | Holds |
|---|---|---|
| `BACKUP_DATABASE_URL` | secret | The `backup_reader` role's **direct** connection string to `production` (host without `-pooler`) |
| `R2_BACKUP_ACCESS_KEY_ID` | secret | R2 API token, Object Read & Write on the backup bucket only |
| `R2_BACKUP_SECRET_ACCESS_KEY` | secret | Its secret |
| `CLOUDFLARE_ACCOUNT_ID` | secret | Already there for `ci.yml`; builds the R2 S3 endpoint |
| `BACKUP_BUCKET` | variable | `piccolo-db-backups-production` |

## Setting it up for a customer

1. Create a read-only role on the `production` branch (Neon console → Roles, or SQL as the owner):

   ```sql
   GRANT pg_read_all_data TO backup_reader;
   ```

   Copy its **direct** connection string (Connection details → turn off "Connection pooling") into
   `BACKUP_DATABASE_URL`.
2. Create the private bucket, its lifecycle rule and its lock rule:

   ```bash
   pnpm exec wrangler r2 bucket create piccolo-db-backups-production
   pnpm exec wrangler r2 bucket lifecycle add piccolo-db-backups-production --prefix daily/ --expire-days 30
   pnpm exec wrangler r2 bucket lock add piccolo-db-backups-production --name daily-7d --prefix daily/ --retention-days 7
   ```

   Leave the bucket without a custom domain and with the `r2.dev` URL off.
3. Create an R2 API token (R2 → Manage API tokens) with **Object Read & Write**, limited to that
   bucket. Its access key id and secret go into `R2_BACKUP_ACCESS_KEY_ID` and
   `R2_BACKUP_SECRET_ACCESS_KEY`.
4. Add the secrets and the variable above to the `production` GitHub Environment.
5. Run the workflow once by hand (below) and check that one object appears under `daily/`.

## Running the workflow by hand

```bash
gh workflow run backup.yml --ref main
gh run watch "$(gh run list --workflow backup.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

## Restore runbook

Pick the restore that fits:

- **To look at old data or to recover some rows**, restore into a local Postgres container.
- **To recover the whole database**, restore into a fresh Neon branch or a new Neon project and
  point the API at it.

Do not:

- **Never restore over the live `production` branch.** `restore.sh` refuses a target that contains
  the production endpoint id and any target that is not empty. Do not work around either check.
- **Never run `pnpm db:migrate` before the restore.** The dump already carries the schema and the
  `drizzle` migration journal; a migrated target is not empty and the restore would clash with it.
  After the restore, `pnpm db:migrate` applies only the migrations newer than the dump.

### 1. Set up the shell

Fill in the backup block of `.env` (see `.env.example`), then, from the repository root:

```bash
set -a; . ./.env; set +a
export AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export R2_ENDPOINT="https://<Cloudflare account id>.r2.cloudflarestorage.com"
mkdir -p ~/piccolo-restore
```

`restore.sh` reads `BACKUP_DATABASE_URL` only to recognise production, and refuses to run without
it. You need the AWS CLI v2 and a Postgres 18 client (`brew install libpq`, or the `postgres:18`
image).

### 2. Find and download the copy

```bash
aws s3 ls "s3://$BACKUP_BUCKET/daily/" --endpoint-url "$R2_ENDPOINT"
KEY=daily/piccolo-production-<UTC timestamp>.dump
aws s3 cp "s3://$BACKUP_BUCKET/$KEY" ~/piccolo-restore/ --endpoint-url "$R2_ENDPOINT"
DUMP=~/piccolo-restore/$(basename "$KEY")
pg_restore --list "$DUMP" | head
```

The timestamp in the name is when the dump was taken, in UTC. Pick the newest copy from before
the damage.

### 3a. Restore into a local Postgres

```bash
docker run -d --name piccolo-restore -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:18
until docker exec piccolo-restore pg_isready -q; do sleep 1; done
scripts/backup/restore.sh "$DUMP" postgres://postgres:postgres@localhost:55432/postgres
psql postgres://postgres:postgres@localhost:55432/postgres -c 'select id, hash, created_at from drizzle.__drizzle_migrations order by id'
```

`restore.sh` prints each `public` table with its row count. Query the data with `psql` and copy
out what you need, for example one day's orders:

```bash
psql postgres://postgres:postgres@localhost:55432/postgres -c "\copy (select * from orders where delivery_date = '2026-10-15') to '$HOME/piccolo-restore/orders.csv' csv header"
```

Clean up when you are done; the container and the dump hold personal data:

```bash
docker rm -f piccolo-restore
rm -rf ~/piccolo-restore
```

### 3b. Restore into a fresh Neon branch or project (full recovery)

1. Create an empty target database. A Neon branch made from `production` is never empty, so
   restore into a new database:
   - **Same project:** Neon console → Branches → Create branch `restored-<date>` from
     `production`, then on that branch Databases → New database `piccolo` (or
     `CREATE DATABASE piccolo;` as the owner). Do not reset or restore over `production` itself.
   - **New project** (the old one is gone): create it on the Free plan with Postgres 18, and set
     autoscaling to 0.25 CU as in docs/STACK.md §5. Its default database is empty.
2. Copy the target database's **direct** connection string (owner role) and restore:

   ```bash
   scripts/backup/restore.sh "$DUMP" "postgres://<owner>:<password>@<new endpoint host>/<db>?sslmode=require"
   ```

   Compare the counts with what you expect.
3. Point the API at the new database: update the Hyperdrive configuration that the production API
   binds to (the id under `[[env.production.hyperdrive]]` in `apps/api/wrangler.toml`), and the
   `DATABASE_URL` secret on the `production` GitHub Environment:

   ```bash
   pnpm --filter @piccolo/api exec wrangler hyperdrive update <hyperdrive id> --connection-string="<new connection string>"
   ```

   Then run `pnpm db:migrate` against the new database once, to apply any migration newer than the
   dump (it skips the ones the journal already records).
4. Check the API: `curl https://api.<domain>/api/health/db` must answer `{"ok":true}`, and the
   admin must show the restored orders.
5. Once the restored branch is the live one, create the `backup_reader` role on it again and update
   `BACKUP_DATABASE_URL`, so the nightly backup follows it.
