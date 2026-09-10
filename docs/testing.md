# Every15 API smoke test

`tests/api-smoke.py` is an executable, dependency-free (Python 3 standard
library only) integration test for the web rebuild contract in
`docs/web-rebuild.md`. The production app is not live yet (verified
2026-09-10), so the coordinator runs it against a local Worker with
local-only fixtures.

## Run

```sh
python3 tests/api-smoke.py http://127.0.0.1:8787
EVERY15_TEST_SESSION=<session_token> python3 tests/api-smoke.py http://127.0.0.1:8787
```

Static checks that work before the app exists:

```sh
python3 -m py_compile tests/api-smoke.py
python3 tests/api-smoke.py --help
```

## Sessions (env)

| Variable | Meaning |
|---|---|
| `EVERY15_TEST_SESSION` | `session_token` cookie value for an allowlisted user. Enables all authenticated checks. |
| `EVERY15_SECOND_SESSION` | Second allowlisted user (different user ID). Enables IDOR isolation checks. |
| `EVERY15_DENIED_SESSION` | Valid Reader session for a non-allowlisted email. Enables 403 checks. |

Cookie values are never printed; output records only set/absent. Missing
variables skip their tests and the summary reports skips honestly. The test
never writes to the Reader DB; it only calls this app's HTTP API.

## Reserved fixture

Test date `2001-01-02`, times `09:00`, `09:30`, `09:45`. The test refuses
(exit 2, no writes) if any entry already exists on that date, and deletes
every row it creates in a `finally` block. Settings are read before mutation
and restored afterwards.

## Coverage and expected codes

- Anonymous across data routes: `GET /api/entries`, `GET /api/settings`,
  `GET /api/export?format=csv|json`, `PUT /api/entries`, `PUT /api/settings`,
  `DELETE /api/entries/:id` -> **401**.
- Denied session (if provided): same routes -> **403**.
- Upsert: `PUT /api/entries` twice on the same quarter keeps the same id and
  leaves exactly one row.
- Validation -> **400**: empty/overlong text, bad date, non-quarter or
  out-of-range time, too many/overlong tags, range over 366 days, bad
  timezone, start>=end, non-quarter setting time, bad workDays, bad
  reminderMinutes.
- CSV export: `text/csv`, comma/quote/newline round-trip through `csv.reader`,
  and no unescaped spreadsheet-formula cell (`=`, `+`, `-`, `@`).
- JSON export: parses and contains the created entry id.
- IDOR (second user): cannot read or delete the first user's entry
  (delete accepts **403 or 404**, both deny), writes the same quarter under a
  different id, leaves the first entry unchanged.
- Delete: `DELETE /api/entries/:id` -> `{ok:true}`; date reads empty after
  cleanup; settings restored.

`GET /api/auth/session` is checked for reachability only (200 anonymous-null
per the vendored do-web pattern, or 401); it carries no auth assertion.

## Ownership

Verification work package owns only `tests/api-smoke.py` and this file.
