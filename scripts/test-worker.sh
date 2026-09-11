#!/usr/bin/env bash
# Local D1 fixtures only. Never run these SQL fixtures with --remote.
set -euo pipefail
cd "$(dirname "$0")/.."
EVERY15_TEST_PORT="${EVERY15_TEST_PORT:-8789}"
npx wrangler d1 migrations apply every15-web --local
npx wrangler d1 execute reader-service --local --file tests/fixtures/reader.sql
./node_modules/.bin/wrangler dev --port "$EVERY15_TEST_PORT" --ip 127.0.0.1 > /tmp/every15-test-worker.log 2>&1 &
EVERY15_WORKER_PID=$!
trap 'kill "$EVERY15_WORKER_PID" 2>/dev/null || true' EXIT
for attempt in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:$EVERY15_TEST_PORT/api/auth/session" > /dev/null; then break; fi
  if ! kill -0 "$EVERY15_WORKER_PID" 2>/dev/null; then cat /tmp/every15-test-worker.log; exit 1; fi
  sleep 1
done
EVERY15_TEST_SESSION=every15-local-smoke \
EVERY15_SECOND_SESSION=every15-local-second \
EVERY15_DENIED_SESSION=every15-local-denied \
python3 tests/api-smoke.py "http://127.0.0.1:$EVERY15_TEST_PORT"
