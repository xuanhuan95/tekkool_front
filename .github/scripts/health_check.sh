#!/usr/bin/env bash
# Kiem tra site sau deploy — cung tieu chi deploy.sh: / = 200, /api/session/init = 200,
# /admin = 404. Thu lai vi container vua Started chua chac phuc vu ngay. [SPT-67]
#   bash .github/scripts/health_check.sh https://viettestpro.vn
# CHECK_API=0: bo kiem /api (deploy frontend chi doi / va /admin).
# File giong het o tekkool_back va tekkool_front.
set -u
CHECK_API="${CHECK_API:-1}"
URL="${1%/}"

code() {
  # curl tu in 000 khi khong ket noi duoc; `|| true` de khong in them lan nua.
  local c
  c=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$1") || true
  echo "${c:-000}"
}

for _ in $(seq 10); do
  ROOT=$(code "$URL/"); [ "$ROOT" = 200 ] && break; sleep 3
done
# Back len cham hon nginx (gunicorn bind cong muon vai giay).
API=skip
if [ "$CHECK_API" = 1 ]; then
  for _ in $(seq 20); do
    API=$(code "$URL/api/session/init?token="); [ "$API" = 200 ] && break; sleep 3
  done
fi
ADMIN=$(code "$URL/admin")

echo "GET /                  -> $ROOT (mong doi 200)"
echo "GET /api/session/init  -> $API (mong doi 200)"
echo "GET /admin             -> $ADMIN (mong doi 404)"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Kiem tra $URL"
    echo "| Duong dan | Ma | Mong doi |"
    echo "|---|---|---|"
    echo "| / | $ROOT | 200 |"
    echo "| /api/session/init | $API | 200 |"
    echo "| /admin | $ADMIN | 404 |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$ROOT" = 200 ] && { [ "$API" = 200 ] || [ "$API" = skip ]; } && [ "$ADMIN" = 404 ]; then
  echo "OK: $URL"
  exit 0
fi
echo "::error::Kiem tra sau deploy THAT BAI. Xem log: docker compose --env-file <file> logs --tail 100 back front"
exit 1
