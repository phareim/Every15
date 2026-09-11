# Verification

Run from the repository root (Node 22, Python 3):

```sh
npm ci
npm test -- --runInBand
npm run build
bash scripts/test-worker.sh
```

The Worker script applies migrations and Reader session fixtures **locally**,
starts Wrangler on port 8789, runs the API tests, and stops that test server.
It never applies fixture SQL remotely. GitHub Actions runs this sequence
before production migrations and deployment.

The API suite checks anonymous 401s, denied-user 403s, owner isolation,
idempotent updates, eight concurrent writes to one quarter, input validation,
CSV/JSON export, settings persistence, and cleanup. It uses the reserved date
2001-01-02 and refuses to overwrite existing entries there. The verified local
run on 2026-09-11 passed all 58 checks with no skips.

For browser verification, leave a local Worker running after seeding fixtures:

```sh
npx wrangler dev --port 8787 --ip 127.0.0.1
# In another terminal:
EVERY15_TEST_SESSION=every15-local-smoke \
EVERY15_CHROMIUM=/snap/bin/chromium node tests/browser-smoke.cjs
```

`EVERY15_CHROMIUM` may be omitted when Playwright's Chromium is installed
(`npx playwright install chromium`). Browser tests refuse non-local origins.
They use 2001-01-03/04, check capture, editing, continuation, failed-save drafts,
quarter/day isolation, deletion/undo, navigation, exports, and mobile overflow.
Screenshots go to the ignored `test-results/` directory.

The API test also accepts explicit session values in `EVERY15_TEST_SESSION`,
`EVERY15_SECOND_SESSION` (different allowed user ID), and
`EVERY15_DENIED_SESSION` (non-allowlisted email). Values are never printed.
Omitted sessions are reported as skipped coverage. No test modifies Reader's
production users or sessions.

On 2026-09-11 the browser suite passed all 27 checks without skips or page
errors. The unit suite passed 33 validation/time/CSV tests; the separate UI
helper suite passed 31 checks covering timezone labels, quarter boundaries,
backfill windows, reminder cadence, and aggregation. Browser screenshots were
reviewed at desktop and phone widths.
