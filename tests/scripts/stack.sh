#!/usr/bin/env bash
# Characterisation test stack (docker-compose.test.yml, project "camap-test").
#
#   stack.sh up      start (building missing images first), wait until healthy
#   stack.sh build   (re)build the images: hx base image first, then the rest
#   stack.sh wait    wait until MySQL, Nest and hx answer
#   stack.sh down    stop and remove (MySQL is on tmpfs: data is gone)
#   stack.sh logs [service...]
#   stack.sh ps
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/docker-compose.test.yml")
SERVICES=(mysql-test nest-test neko-test mailpit-test)

HX_URL="${CAMAP_BASE_URL:-http://localhost:8180}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"

ensure_files() {
  mkdir -p "$ROOT/tests/.faketime"
  # real time unless a test moved the clock
  [ -f "$ROOT/tests/.faketime/faketime.rc" ] || echo "+0" > "$ROOT/tests/.faketime/faketime.rc"
  for f in schema.sql seed.sql; do
    [ -f "$ROOT/tests/db/$f" ] || { echo "missing tests/db/$f (run npm run schema:baseline)" >&2; exit 1; }
  done
}

wait_for() { # name, command...
  local name="$1"; shift
  local start=$SECONDS
  printf 'waiting for %s ' "$name"
  until "$@" >/dev/null 2>&1; do
    if (( SECONDS - start > WAIT_TIMEOUT )); then
      echo " timeout after ${WAIT_TIMEOUT}s" >&2
      "${COMPOSE[@]}" ps >&2 || true
      return 1
    fi
    printf '.'; sleep 2
  done
  echo " ok ($((SECONDS - start))s)"
}

mysql_ready() { "${COMPOSE[@]}" exec -T mysql-test mysql -uroot -proot -e 'SELECT 1 FROM camap_test.Variable LIMIT 1'; }
nest_ready() {
  "${COMPOSE[@]}" exec -T neko-test curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' \
    --data '{"query":"{ __typename }"}' http://nest-devcamap:3010/graphql
}
hx_ready() { curl -fsS -o /dev/null "$HX_URL/user/login"; }
proxy_ready() { curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' --data '{"query":"{ __typename }"}' "$HX_URL/graphql"; }

# `compose up --build` rebuilds neko-base through additional_contexts with a
# different cache key (and the Haxe build is flaky under amd64 emulation), so
# images are only ever built here, base first, and `up` never builds.
cmd_build() {
  "${COMPOSE[@]}" build neko-base
  "${COMPOSE[@]}" build mysql-test nest-test neko-test
}

images_present() {
  local img
  for img in camap-test-neko-base camap-test-neko-test camap-test-nest-test camap-test-mysql-test; do
    docker image inspect "$img:latest" >/dev/null 2>&1 || return 1
  done
}

cmd_wait() {
  wait_for mysql mysql_ready
  wait_for nest nest_ready
  wait_for hx hx_ready
  wait_for "hx -> nest proxy" proxy_ready
}

case "${1:-}" in
  up)
    ensure_files
    images_present || cmd_build
    "${COMPOSE[@]}" up -d --no-build "${SERVICES[@]}"
    cmd_wait
    ;;
  build)
    cmd_build
    ;;
  wait)
    cmd_wait
    ;;
  down)
    "${COMPOSE[@]}" down --remove-orphans
    ;;
  logs)
    shift
    "${COMPOSE[@]}" logs --tail=200 "$@"
    ;;
  ps)
    "${COMPOSE[@]}" ps
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 2
    ;;
esac
