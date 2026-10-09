#!/usr/bin/env bash
# Saves a screenshot of a page as a file in the run's evidence, with headless Chrome (a fresh
# profile, so no cookies or extensions). It loads the page and waits; it cannot click. Use it for
# states a URL reaches; drive interactions in the browser pane and save its snapshots. Headless
# Chrome will not render narrower than about 500 px: check phone layouts in the browser pane.
#
#   scripts/shot.sh "$WEB_URL/megrendeles" megrendeles-open            # 1280x1600
#   scripts/shot.sh "$ADMIN_URL/etlap" etlap 1280x1600
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_run

[ $# -ge 2 ] || die "usage: shot.sh URL NAME [WIDTHxHEIGHT]"
url=$1 name=$2 size=${3:-1280x1600}
chrome=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
[ -x "$chrome" ] || die "no Chrome at $chrome (set CHROME)"

out=$EVIDENCE/$name.png
profile=$(mktemp -d)
rm -f "$out"
# Chrome writes the file and then may linger (the dev servers' HMR sockets keep the page busy), so
# it runs in its own process group and is stopped once the file is there, or after 60 s.
set -m
"$chrome" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$profile" --window-size="${size/x/,}" \
  --virtual-time-budget=8000 --screenshot="$out" "$url" >/dev/null 2>&1 &
chrome_pid=$!
set +m
trap 'kill -TERM -- "-$chrome_pid" 2>/dev/null; wait "$chrome_pid" 2>/dev/null; rm -rf "$profile"' EXIT
for _ in $(seq 120); do
  kill -0 "$chrome_pid" 2>/dev/null || break
  [ -s "$out" ] && sleep 1 && break
  sleep 0.5
done
[ -s "$out" ] || die "no screenshot of $url within 60 s"
echo "$out"
