#!/usr/bin/env bash
# Ends a verification run: stops the three servers it started (their process groups, never by
# name), deletes the orders it placed (e-mail verify+<RUN_ID>…@example.com) and the run's private
# state. Keeps $RUN/evidence and $RUN/logs.
#
#   .claude/skills/verify/scripts/down.sh            # the run in $VERIFY_RUN, else .verify/latest
#   VERIFY_RUN=.verify/runs/<id> .claude/skills/verify/scripts/down.sh
set -uo pipefail
source "$(dirname "$0")/lib.sh"
load_run

for name in API WEB ADMIN; do
  pid_var=${name}_PID
  pid=${!pid_var}
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid"
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    kill -0 "$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
    echo "stopped $name (pgid $pid)"
  fi
done

if [ -f "$RUN/state/db.url" ]; then
  pattern="verify+$RUN_ID%@example.com"
  {
    echo "-- orders and customers of $pattern, deleted by down.sh"
    node "$SKILL_DIR/scripts/sql.mjs" \
      "delete from orders where lower(email) like \$1 returning id, delivery_date, total" "$pattern"
    node "$SKILL_DIR/scripts/sql.mjs" \
      "delete from customers where email_key like \$1 returning id, email_key" "$pattern"
  } >"$RUN/evidence/cleanup.txt" 2>&1 || echo "verify: order cleanup failed, see $RUN/evidence/cleanup.txt" >&2
fi

rm -rf "$RUN/state"
echo "evidence kept: $RUN/evidence"
ls -1 "$RUN/evidence"
