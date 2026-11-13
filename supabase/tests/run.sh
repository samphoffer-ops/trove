#!/usr/bin/env bash
# Applies schema.sql and every migration to a throwaway local Postgres, then
# runs the SQL tests. Needs Homebrew postgresql@17 + pgvector; no Docker.
#
#   supabase/tests/run.sh            # all tests
#   supabase/tests/run.sh dm_threads # tests matching a name
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
data="$(mktemp -d)"
port="${PGPORT_TEST:-55433}"

cleanup() { pg_ctl -D "$data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$data"; }
trap cleanup EXIT

initdb -D "$data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$data" -o "-p $port -k $data" -l "$data/log" -w start >/dev/null || { cat "$data/log" >&2; exit 1; }
psql_() { psql -h "$data" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -f "$here/supabase_stubs.sql"
psql_ -f "$root/schema.sql"
for m in "$root"/migrations/*.sql; do
  # Seed fixtures that a migration's backfill needs, right before it runs.
  seed="$here/seed_before_$(basename "$m")"
  [ -f "$seed" ] && psql_ -f "$seed"
  PGOPTIONS="-c client_min_messages=warning" psql_ -f "$m" >/dev/null
done
echo "migrations applied"

status=0
for t in "$here"/*_test.sql; do
  [[ -n "${1:-}" && "$t" != *"$1"* ]] && continue
  out="$(psql_ -f "$t" 2>&1)" || status=1
  echo "$out" | sed -n 's/^.*NOTICE:  //p'
  echo "$out" | grep -E "ERROR" && status=1
  echo "$out" | grep -q "FAIL" && status=1
done
exit $status
