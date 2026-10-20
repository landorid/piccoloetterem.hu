#!/usr/bin/env bash
# Read-only: is this run worth driving? Checks that each server is ours and answering, that the
# checkout has not moved since launch, that staff auth works both ways, and prints the menu state.
# Exit 0 only when every check passes.
#
#   .claude/skills/verify/scripts/doctor.sh          # add --db to also wake the database
set -uo pipefail
source "$(dirname "$0")/lib.sh"
load_run

fail=0
check() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok    $label"
  else
    echo "FAIL  $label"
    fail=1
  fi
}
status_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }
port_of() { echo "${1##*:}"; }
# The listener on the port belongs to the process group we started.
owns_port() {
  local pgid=$1 port=$2
  lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    [ "$(ps -o pgid= -p "$pid" | tr -d ' ')" = "$pgid" ] && echo yes
  done | grep -q yes
}

echo "run    $RUN_ID   ($RUN_DIR)"
echo "urls   api $API_URL   web $WEB_URL   admin $ADMIN_URL"

check "api pid $API_PID owns :$(port_of "$API_URL")" owns_port "$API_PID" "$(port_of "$API_URL")"
check "web pid $WEB_PID owns :$(port_of "$WEB_URL")" owns_port "$WEB_PID" "$(port_of "$WEB_URL")"
check "admin pid $ADMIN_PID owns :$(port_of "$ADMIN_URL")" owns_port "$ADMIN_PID" "$(port_of "$ADMIN_URL")"

head=$(git -C "$REPO" rev-parse --short HEAD)
check "checkout at launch commit $GIT_HEAD (now $head; dirty files are not tracked)" test "$head" = "$GIT_HEAD"

check "GET /api/health → 200" test "$(status_of "$API_URL/api/health")" = 200
check "GET /api/admin/ping without token → 401" \
  test "$(status_of "$API_URL/api/admin/ping")" = 401
check "GET /api/admin/ping with the run's staff token → 200" \
  test "$(status_of -H "Authorization: Bearer $(cat "$STAFF_TOKEN_FILE")" "$API_URL/api/admin/ping")" = 200
check "CORS allows the web origin" sh -c \
  "curl -s -i -H 'Origin: $WEB_URL' '$API_URL/api/health' | grep -qi '^access-control-allow-origin: $WEB_URL'"
check "web GET /megrendeles → 200" test "$(status_of "$WEB_URL/megrendeles")" = 200
check "admin GET / → 200" test "$(status_of "$ADMIN_URL/")" = 200
if [ "${1-}" = --db ]; then
  check "GET /api/health/db → 200 (database reachable)" \
    test "$(status_of "$API_URL/api/health/db")" = 200
fi

echo "api    $(curl -s --max-time 10 "$API_URL/api/health")"
menu=$(curl -s --max-time 30 "$API_URL/api/menu")
echo "menu   $(node -e '
  const m = JSON.parse(process.argv[1]);
  console.log(m.state === "open"
    ? `open — ${m.menu.weekLabel}, orderable ${m.orderableDates.join(" ") || "(none)"}`
    : JSON.stringify(m));' "$menu" 2>/dev/null || echo "unreadable: $menu")"

exit $fail
