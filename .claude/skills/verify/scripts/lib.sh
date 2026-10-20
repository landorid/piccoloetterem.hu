# Sourced by the other scripts. Resolves the checkout and the run directory.
#   REPO   the checkout this skill lives in (override with VERIFY_REPO)
#   RUN    the run directory: $VERIFY_RUN, else $REPO/.verify/latest
# After `load_run`, every key of $RUN/run.env is a shell variable.

SKILL_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO=$(git -C "${VERIFY_REPO:-$SKILL_DIR}" rev-parse --show-toplevel)

die() {
  echo "verify: $*" >&2
  exit 1
}

load_run() {
  RUN=${VERIFY_RUN:-$REPO/.verify/latest}
  [ -f "$RUN/run.env" ] || die "no run at $RUN (start one with scripts/up.sh, or set VERIFY_RUN)"
  RUN=$(cd "$RUN" && pwd -P)
  set -a
  # shellcheck disable=SC1091
  . "$RUN/run.env"
  set +a
}

# The first checkout of the repository (git worktree list), where .dev.vars and .env usually live.
main_checkout() {
  git -C "$REPO" worktree list --porcelain | sed -n 's/^worktree //p' | head -1
}
