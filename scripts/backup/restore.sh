#!/usr/bin/env bash
# Restores a dump made by dump.sh into an empty database, then prints "<table> <row count>" for
# every table in `public` (counts only, never rows).
#
#   BACKUP_DATABASE_URL=postgres://… scripts/backup/restore.sh <dump file> <target url>
#
# BACKUP_DATABASE_URL is read only to recognise production: when its host is a Neon endpoint
# (ep-…), a target that contains the same endpoint id is refused, pooled or direct. It must be set,
# so that the guard cannot be skipped by forgetting it. See docs/BACKUP.md.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: restore.sh <dump file> <target url>" >&2
  exit 2
fi
file=$1
target=$2

if [ ! -r "$file" ]; then
  echo "restore.sh: cannot read $file" >&2
  exit 2
fi

source_url=${BACKUP_DATABASE_URL:-}
if [ -z "$source_url" ]; then
  echo "restore.sh: BACKUP_DATABASE_URL is not set; it is needed to recognise production" >&2
  exit 2
fi
source_host=${source_url#*://}
source_host=${source_host%%[/?]*}
source_host=${source_host##*@}
endpoint_id=${source_host%%.*}
endpoint_id=${endpoint_id%-pooler}
case $endpoint_id in
  ep-*)
    case $target in
      *"$endpoint_id"*)
        echo "restore.sh: refusing: the target is the production endpoint" >&2
        exit 3
        ;;
    esac
    ;;
  *) echo "restore.sh: BACKUP_DATABASE_URL is not a Neon endpoint; no production guard" >&2 ;;
esac

# Every relation outside the system schemas, and every schema besides `public`, counts as content.
existing=$(psql "$target" --no-psqlrc --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="
  select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%')
       + (select count(*) from pg_namespace
           where nspname not in ('public', 'pg_catalog', 'information_schema')
             and nspname not like 'pg_toast%' and nspname not like 'pg_temp%')")
if [ "$existing" != "0" ]; then
  echo "restore.sh: refusing: the target database is not empty ($existing schemas or relations)" >&2
  exit 3
fi

echo "restore.sh: restoring" >&2
pg_restore --no-owner --no-acl --exit-on-error --single-transaction --dbname="$target" "$file"

psql "$target" --no-psqlrc --quiet --tuples-only --no-align --field-separator=' ' --set=ON_ERROR_STOP=1 <<'SQL'
select format('select %L, count(*) from public.%I', tablename, tablename)
from pg_tables where schemaname = 'public' order by tablename
\gexec
SQL
echo "restore.sh: ok" >&2
