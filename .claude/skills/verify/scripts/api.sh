#!/usr/bin/env bash
# Calls the run's API the way its frontend does and prints the status line, headers and body.
# /api/admin/* carries the run's staff token (Authorization: Bearer) and the admin's Origin;
# everything else is anonymous with the public site's Origin.
#
#   scripts/api.sh GET /api/menu
#   scripts/api.sh --save menu-sold-out POST /api/admin/menu/items/<id>/sold-out '{"soldOut":true}'
#   scripts/api.sh --anon GET /api/admin/ping          # no token: expect 401
#   scripts/api.sh POST /api/orders @order.json        # body from a file
#
# --save NAME also writes the request and the response to $EVIDENCE/NAME.http.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_run

anon=0 save=
while [ $# -gt 0 ]; do
  case $1 in
  --anon) anon=1 && shift ;;
  --save) save=$2 && shift 2 ;;
  *) break ;;
  esac
done
[ $# -ge 2 ] || die "usage: api.sh [--anon] [--save NAME] METHOD PATH [BODY|@FILE]"
method=$1 path=$2 body=${3-}

args=(-sS -i -X "$method")
case $path in
/api/admin/*)
  args+=(-H "Origin: $ADMIN_URL")
  [ $anon = 1 ] || args+=(-H "Authorization: Bearer $(cat "$STAFF_TOKEN_FILE")")
  ;;
*) args+=(-H "Origin: $WEB_URL") ;;
esac
[ -z "$body" ] || args+=(-H 'Content-Type: application/json' --data-binary "$body")

if [ -n "$save" ]; then
  {
    echo "> $method $API_URL$path"
    [ -z "$body" ] || echo "> $body"
    echo
    curl "${args[@]}" "$API_URL$path"
    echo
  } | tee "$EVIDENCE/$save.http"
else
  curl "${args[@]}" "$API_URL$path"
  echo
fi
