#!/usr/bin/env bash
# Starts one verification run: the API (wrangler dev), the public site (astro dev) and the admin
# (vite, Clerk stubbed), each on a free port, with a private Miniflare KV and a per-run staff key.
# Prints the run's env and points $REPO/.verify/latest at it.
#
#   .claude/skills/verify/scripts/up.sh
#
# Env: DATABASE_URL (else apps/api/.dev.vars, else .env, of this or the main checkout),
#      VERIFY_TIMEOUT seconds to wait for each server (default 120).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

secrets_file() {
  local name=$1
  for root in "$REPO" "$(main_checkout)"; do
    if [ -f "$root/$name" ]; then
      echo "$root/$name"
      return
    fi
  done
  echo -
}

free_port() {
  node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"
}

wait_for() {
  local name=$1 url=$2 pid=$3 deadline=$((SECONDS + ${VERIFY_TIMEOUT:-120}))
  until curl -fs -o /dev/null --max-time 5 "$url"; do
    kill -0 "$pid" 2>/dev/null || die "$name exited before $url answered; see $RUN/logs/$name.log, then run down.sh"
    [ $SECONDS -lt $deadline ] || die "$name did not answer $url in time; see $RUN/logs/$name.log, then run down.sh"
    sleep 1
  done
}

for app in api web admin; do
  [ -d "$REPO/apps/$app/node_modules" ] || die "apps/$app has no node_modules: run 'pnpm i' in $REPO"
done

RUN_ID=$(date +%Y%m%d-%H%M%S)-$$
RUN=$REPO/.verify/runs/$RUN_ID
mkdir -p "$RUN/state" "$RUN/evidence" "$RUN/logs"

API_PORT=$(free_port)
INSPECTOR_PORT=$(free_port)
WEB_PORT=$(free_port)
ADMIN_PORT=$(free_port)
API_URL=http://localhost:$API_PORT
WEB_URL=http://localhost:$WEB_PORT
ADMIN_URL=http://localhost:$ADMIN_PORT

node "$SKILL_DIR/scripts/prepare.mjs" "$RUN" "$API_URL" "$WEB_URL" "$ADMIN_URL" \
  "$(secrets_file apps/api/.dev.vars)" "$(secrets_file .env)"

# Job control: each server leads its own process group, so down.sh can stop it with its children
# (workerd, esbuild) and nothing else.
set -m

(
  cd "$REPO/apps/api"
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=$(cat "$RUN/state/db.url") \
    exec node node_modules/wrangler/bin/wrangler.js dev \
    --port "$API_PORT" --inspector-port "$INSPECTOR_PORT" \
    --env-file "$RUN/state/api.dev.vars" --persist-to "$RUN/state/wrangler" \
    --show-interactive-dev-session=false
) >"$RUN/logs/api.log" 2>&1 </dev/null &
API_PID=$!

(
  cd "$REPO/apps/web"
  # Astro 7 detaches into a daemon when it detects an agent; ASTRO_DEV_BACKGROUND (the variable
  # its own daemon runs under) turns the detection off, so the server stays in this process group.
  # --ignore-lock: no lock file, so another run in this checkout can start its own.
  PUBLIC_API_URL=$API_URL ASTRO_DEV_BACKGROUND=1 \
    exec node_modules/.bin/astro dev --port "$WEB_PORT" --host localhost --ignore-lock
) >"$RUN/logs/web.log" 2>&1 </dev/null &
WEB_PID=$!

(
  cd "$REPO/apps/admin"
  VERIFY_ADMIN_ROOT=$REPO/apps/admin VERIFY_ADMIN_ENV_DIR=$RUN/state/admin \
    exec node_modules/.bin/vite --config "$SKILL_DIR/scripts/admin-vite.config.mjs" \
    --port "$ADMIN_PORT" --host localhost
) >"$RUN/logs/admin.log" 2>&1 </dev/null &
ADMIN_PID=$!

set +m

cat >"$RUN/run.env" <<EOF
RUN_ID=$RUN_ID
RUN_DIR=$RUN
EVIDENCE=$RUN/evidence
REPO=$REPO
GIT_HEAD=$(git -C "$REPO" rev-parse --short HEAD)
API_URL=$API_URL
WEB_URL=$WEB_URL
ADMIN_URL=$ADMIN_URL
API_PID=$API_PID
WEB_PID=$WEB_PID
ADMIN_PID=$ADMIN_PID
STAFF_TOKEN_FILE=$RUN/state/staff.jwt
ORDER_EMAIL=verify+$RUN_ID@example.com
EOF
ln -sfn "runs/$RUN_ID" "$REPO/.verify/latest"

wait_for api "$API_URL/api/health" "$API_PID"
wait_for web "$WEB_URL/megrendeles" "$WEB_PID"
wait_for admin "$ADMIN_URL/" "$ADMIN_PID"

cat "$RUN/run.env"
echo "ready — export VERIFY_RUN=$RUN"
