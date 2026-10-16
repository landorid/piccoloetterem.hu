#!/usr/bin/env bash
# Dumps the database at BACKUP_DATABASE_URL into <out dir>/piccolo-production-<UTC timestamp>.dump
# (pg_dump custom format) and prints the file's path on stdout. Progress and errors go to stderr.
#
#   BACKUP_DATABASE_URL=postgres://… scripts/backup/dump.sh [out dir]
#
# The repository is public and so are the workflow logs: nothing here prints the connection
# string, its host or its credentials, or anything read from the dump. See docs/BACKUP.md.
set -euo pipefail

min_bytes=10240

out_dir=${1:-.}
url=${BACKUP_DATABASE_URL:-}
if [ -z "$url" ]; then
  echo "dump.sh: BACKUP_DATABASE_URL is not set" >&2
  exit 2
fi
if [ ! -d "$out_dir" ]; then
  echo "dump.sh: output directory does not exist: $out_dir" >&2
  exit 2
fi

file="$out_dir/piccolo-production-$(date -u +%Y%m%dT%H%M%SZ).dump"
err=$(mktemp)
trap 'rm -f "$err"' EXIT

# Replaces the credentials and the host of the connection string in pg_dump's messages, which name
# the server they failed to reach.
redact() {
  local rest userinfo host
  rest=${url#*://}
  rest=${rest%%[/?]*}
  userinfo=""
  case $rest in *@*) userinfo=${rest%@*} ;; esac
  host=${rest##*@}
  host=${host%:*}
  local out
  out=$(cat "$1")
  for secret in "$url" "$userinfo" "${userinfo#*:}" "${userinfo%%:*}" "$host"; do
    if [ -n "$secret" ]; then
      out=${out//"$secret"/***}
    fi
  done
  printf '%s\n' "$out" >&2
}

echo "dump.sh: dumping to $file" >&2
if ! pg_dump --format=custom --compress=9 --no-owner --no-acl --file="$file" --dbname="$url" 2>"$err"; then
  echo "dump.sh: pg_dump failed:" >&2
  redact "$err"
  rm -f "$file"
  exit 1
fi

size=$(wc -c <"$file" | tr -d ' ')
if [ "$size" -lt "$min_bytes" ]; then
  echo "dump.sh: dump is $size bytes, under the $min_bytes-byte minimum; refusing it" >&2
  rm -f "$file"
  exit 1
fi

if ! pg_restore --list "$file" >/dev/null 2>"$err"; then
  echo "dump.sh: pg_restore cannot read the dump:" >&2
  cat "$err" >&2
  rm -f "$file"
  exit 1
fi

echo "dump.sh: ok, $size bytes" >&2
printf '%s\n' "$file"
