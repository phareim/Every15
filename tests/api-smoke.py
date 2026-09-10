#!/usr/bin/env python3
"""Every15 web rebuild — API smoke test (stdlib only, no dependencies).

Usage:
    python3 tests/api-smoke.py http://127.0.0.1:8787
    EVERY15_TEST_SESSION=<token> python3 tests/api-smoke.py https://15.phareim.no

What it does:
  - Anonymous requests across data routes must return 401.
  - Valid-but-not-allowlisted session (EVERY15_DENIED_SESSION) must return 403.
  - Allowlisted session (EVERY15_TEST_SESSION) exercises create/read/update of
    the same quarter (idempotent upsert, no duplicates), validation errors,
    CSV escaping + formula protection, JSON export, settings read/restore,
    and delete.
  - Second allowlisted user (EVERY15_SECOND_SESSION) exercises IDOR isolation.

What it never does:
  - Never prints cookie tokens (values are redacted in all output).
  - Never touches the Reader DB; it only calls this app's HTTP API.
  - Only writes rows on the reserved test date 2001-01-02 and deletes them
    in a finally block.

Exit codes: 0 = pass (skips allowed), 1 = failure, 2 = refused/usage.
"""

import argparse
import csv
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

TEST_DATE = "2001-01-02"
# Times reserved for this smoke test on TEST_DATE. Nothing else should use them.
T_CREATE = "09:00"   # create/read/update idempotency quarter
T_CSV = "09:45"      # CSV escaping / formula-protection quarter
T_IDOR = "09:00"     # second user writes the SAME quarter in their own namespace
T_VALID = "09:30"    # validation negatives target this quarter (must fail)

SESSION_COOKIE = "session_token"
TIMEOUT = 15

RESULTS = {"pass": [], "fail": [], "skip": []}


def note_pass(name):
    RESULTS["pass"].append(name)
    print("PASS %s" % name)


def note_fail(name, detail=""):
    RESULTS["fail"].append(name)
    detail = str(detail)[:500]
    print("FAIL %s %s" % (name, detail))


def note_skip(name, reason=""):
    RESULTS["skip"].append(name)
    print("SKIP %s %s" % (name, reason))


def redact_headers(headers):
    """Redact any Cookie/Authorization values for safe output."""
    out = {}
    for k, v in headers.items():
        lk = k.lower()
        if lk in ("cookie", "authorization", "set-cookie"):
            out[k] = "<redacted>"
        else:
            out[k] = v
    return out


def http(base, method, path, body=None, session=None, raw_body=None):
    """Return (status, headers_dict, body_bytes). Never raises on HTTP error."""
    url = base + path
    data = None
    headers = {"Accept": "application/json, text/csv, */*"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
    if session is not None:
        # Cookie value comes from env; never logged.
        headers["Cookie"] = "%s=%s" % (SESSION_COOKIE, session)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, dict(resp.headers.items()), resp.read()
    except urllib.error.HTTPError as e:
        try:
            payload = e.read()
        except Exception:
            payload = b""
        return e.code, dict((e.headers.items() if e.headers else [])), payload
    except Exception as e:
        return -1, {}, ("transport error: %s" % e).encode("utf-8")


def jload(raw):
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def expect(name, actual, expected):
    """Assert a single expected status code."""
    if actual == expected:
        note_pass(name)
        return True
    note_fail(name, "expected HTTP %s, got %s" % (expected, actual))
    return False


def expect_in(name, actual, expected_set):
    """Assert status is one of an allowed set (used where 403/404 both deny)."""
    if actual in expected_set:
        note_pass("%s (got %s)" % (name, actual))
        return True
    note_fail(name, "expected HTTP %s, got %s" % (sorted(expected_set), actual))
    return False


def entries_on(base, session, date):
    q = "/api/entries?from=%s&to=%s" % (date, date)
    st, _, raw = http(base, "GET", q, session=session)
    if st != 200:
        return st, None
    doc = jload(raw)
    if not isinstance(doc, dict) or not isinstance(doc.get("entries"), list):
        return 200, None
    return 200, doc["entries"]


def delete_entry(base, session, entry_id):
    path = "/api/entries/" + urllib.parse.quote(str(entry_id), safe="")
    return http(base, "DELETE", path, session=session)


def main():
    ap = argparse.ArgumentParser(
        description="Every15 API smoke test (stdlib only). "
                    "Runs anonymous/auth checks, upsert idempotency, validation, "
                    "CSV/JSON export, IDOR, settings restore and delete cleanup "
                    "against an explicit base URL. Test date %s." % TEST_DATE)
    ap.add_argument("base_url", help="App origin, e.g. http://127.0.0.1:8787")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    primary = os.environ.get("EVERY15_TEST_SESSION") or ""
    second = os.environ.get("EVERY15_SECOND_SESSION") or ""
    denied = os.environ.get("EVERY15_DENIED_SESSION") or ""
    if primary and primary == second:
        print("EVERY15_TEST_SESSION and EVERY15_SECOND_SESSION hold the same "
              "value; treating second-user tests as unconfigured.")
        second = ""

    print("base: %s" % base)
    print("test date: %s (reserved times %s, %s, %s)" % (TEST_DATE, T_CREATE, T_VALID, T_CSV))
    print("sessions: primary=%s second=%s denied=%s"
          % ("set" if primary else "absent",
             "set" if second else "absent",
             "set" if denied else "absent"))

    created_primary = []  # entry ids to delete with primary session
    created_second = []   # entry ids to delete with second session
    saved_settings = None
    ok = True

    def mark(result):
        nonlocal ok
        if not result:
            ok = False

    # ---- 1. Anonymous: 401 across data routes ----
    anon_gets = [
        ("anon GET /api/entries", "/api/entries?from=%s&to=%s" % (TEST_DATE, TEST_DATE)),
        ("anon GET /api/settings", "/api/settings"),
        ("anon GET /api/export csv", "/api/export?from=%s&to=%s&format=csv" % (TEST_DATE, TEST_DATE)),
        ("anon GET /api/export json", "/api/export?from=%s&to=%s&format=json" % (TEST_DATE, TEST_DATE)),
    ]
    for name, path in anon_gets:
        st, _, _ = http(base, "GET", path, session=None)
        mark(expect(name, st, 401))

    st, _, _ = http(base, "PUT", "/api/entries",
                    body={"date": TEST_DATE, "time": T_VALID, "text": "anon"},
                    session=None)
    mark(expect("anon PUT /api/entries", st, 401))

    st, _, _ = http(base, "PUT", "/api/settings",
                    body={"timezone": "Europe/Oslo"}, session=None)
    mark(expect("anon PUT /api/settings", st, 401))

    st, _, _ = http(base, "DELETE", "/api/entries/00000000-0000-0000-0000-000000000000",
                    session=None)
    mark(expect("anon DELETE /api/entries/:id", st, 401))

    # Session endpoint shape (informational: do-web pattern returns 200 with
    # null user when anonymous; assert only reachability, not auth semantics).
    st, _, raw = http(base, "GET", "/api/auth/session", session=None)
    if st in (200, 401):
        note_pass("anon GET /api/auth/session reachable (got %s)" % st)
    else:
        mark(False)
        note_fail("anon GET /api/auth/session reachable",
                  "expected HTTP 200 or 401, got %s" % st)

    # ---- 2. Denied (valid non-allowlisted user): 403 if provided ----
    if denied:
        denied_gets = [
            ("denied GET /api/entries", "/api/entries?from=%s&to=%s" % (TEST_DATE, TEST_DATE)),
            ("denied GET /api/settings", "/api/settings"),
            ("denied GET /api/export csv", "/api/export?from=%s&to=%s&format=csv" % (TEST_DATE, TEST_DATE)),
            ("denied GET /api/export json", "/api/export?from=%s&to=%s&format=json" % (TEST_DATE, TEST_DATE)),
        ]
        for name, path in denied_gets:
            st, _, _ = http(base, "GET", path, session=denied)
            mark(expect(name, st, 403))
        st, _, _ = http(base, "PUT", "/api/entries",
                        body={"date": TEST_DATE, "time": T_VALID, "text": "denied"},
                        session=denied)
        mark(expect("denied PUT /api/entries", st, 403))
        st, _, _ = http(base, "PUT", "/api/settings",
                        body={"timezone": "Europe/Oslo"}, session=denied)
        mark(expect("denied PUT /api/settings", st, 403))
        st, _, _ = http(base, "DELETE", "/api/entries/00000000-0000-0000-0000-000000000000",
                        session=denied)
        mark(expect("denied DELETE /api/entries/:id", st, 403))
    else:
        for name in ("denied GET/PUT/DELETE coverage",):
            note_skip(name, "EVERY15_DENIED_SESSION absent")

    # ---- 3+. Authenticated primary flow ----
    if not primary:
        note_skip("authenticated entry/settings/export/IDOR/delete coverage",
                  "EVERY15_TEST_SESSION absent")
    else:
        try:
            # Precondition: reserved date must be empty before we start.
            st, rows = entries_on(base, primary, TEST_DATE)
            if st == 401:
                note_fail("primary session accepted", "got HTTP 401; token not allowlisted?")
                return 1
            if st != 200 or rows is None:
                note_fail("precondition read test date",
                          "expected HTTP 200 with {entries:[]}, got %s" % st)
                return 1
            if len(rows) != 0:
                print("REFUSE: %d entr(ies) already exist on %s; "
                      "test times are reserved and must start empty. Aborting "
                      "without writes." % (len(rows), TEST_DATE))
                return 2
            note_pass("precondition test date empty")

            # Save settings for later restore.
            st, _, raw = http(base, "GET", "/api/settings", session=primary)
            if st == 200 and jload(raw) is not None:
                saved_settings = jload(raw).get("settings", jload(raw))
                note_pass("settings read (saved for restore)")
            else:
                mark(False)
                note_fail("settings read", "expected HTTP 200 {settings}, got %s" % st)

            # Create quarter.
            st, _, raw = http(base, "PUT", "/api/entries",
                              body={"date": TEST_DATE, "time": T_CREATE,
                                    "text": "smoke one", "tags": ["smoke"]},
                              session=primary)
            doc = jload(raw)
            entry = (doc or {}).get("entry") if isinstance(doc, dict) else None
            if st == 200 and isinstance(entry, dict) and entry.get("id"):
                note_pass("create quarter %s" % T_CREATE)
                eid = entry["id"]
                created_primary.append(eid)
                for field in ("date", "time", "text", "createdAt", "updatedAt"):
                    if entry.get(field) is None:
                        mark(False)
                        note_fail("entry shape has %s" % field, "missing")
                    else:
                        note_pass("entry shape has %s" % field)
                if entry.get("date") == TEST_DATE and entry.get("time") == T_CREATE:
                    note_pass("entry echoes date/time")
                else:
                    mark(False)
                    note_fail("entry echoes date/time", repr({k: entry.get(k) for k in ("date", "time")})[:200])
            else:
                mark(False)
                note_fail("create quarter %s" % T_CREATE,
                          "expected HTTP 200 {entry:{id,...}}, got %s" % st)
                return 1

            # Read back.
            st, rows = entries_on(base, primary, TEST_DATE)
            if st == 200 and any(r.get("id") == eid for r in rows or []):
                note_pass("read back created entry")
            else:
                mark(False)
                note_fail("read back created entry", "got HTTP %s" % st)

            # Update same quarter: same id, no duplicate.
            st, _, raw = http(base, "PUT", "/api/entries",
                              body={"date": TEST_DATE, "time": T_CREATE,
                                    "text": "smoke one updated", "tags": ["smoke"]},
                              session=primary)
            doc2 = jload(raw)
            entry2 = (doc2 or {}).get("entry") if isinstance(doc2, dict) else None
            if st == 200 and isinstance(entry2, dict) and entry2.get("id") == eid \
                    and entry2.get("text") == "smoke one updated":
                note_pass("update same quarter keeps id")
            else:
                mark(False)
                note_fail("update same quarter keeps id", "expected HTTP 200 same id, got %s" % st)
            st, rows = entries_on(base, primary, TEST_DATE)
            dupes = [r for r in (rows or [])
                     if r.get("date") == TEST_DATE and r.get("time") == T_CREATE]
            if st == 200 and len(dupes) == 1 and dupes[0].get("id") == eid:
                note_pass("no duplicate row for quarter")
            else:
                mark(False)
                note_fail("no duplicate row for quarter",
                          "got HTTP %s with %s rows" % (st, len(dupes) if rows is not None else "?"))

            # Validation negatives (each must be rejected, none creates rows).
            bad_puts = [
                ("reject empty text", {"date": TEST_DATE, "time": T_VALID, "text": ""}),
                ("reject overlong text", {"date": TEST_DATE, "time": T_VALID, "text": "x" * 2001}),
                ("reject bad date", {"date": "2001-13-40", "time": T_VALID, "text": "x"}),
                ("reject non-quarter time", {"date": TEST_DATE, "time": "09:07", "text": "x"}),
                ("reject out-of-range time", {"date": TEST_DATE, "time": "25:00", "text": "x"}),
                ("reject too many tags",
                 {"date": TEST_DATE, "time": T_VALID, "text": "x",
                  "tags": ["t%d" % i for i in range(9)]}),
                ("reject overlong tag",
                 {"date": TEST_DATE, "time": T_VALID, "text": "x", "tags": ["y" * 41]}),
            ]
            for name, payload in bad_puts:
                st, _, _ = http(base, "PUT", "/api/entries", body=payload, session=primary)
                mark(expect(name, st, 400))
            st, _, _ = http(base, "GET",
                            "/api/entries?from=2000-01-01&to=2002-06-01",
                            session=primary)
            mark(expect("reject range over 366 days", st, 400))

            bad_settings = [
                ("reject bad timezone", {"timezone": "Mars/Olympus"}),
                ("reject start>=end", {"startTime": "17:00", "endTime": "09:00"}),
                ("reject non-quarter setting time", {"startTime": "09:07"}),
                ("reject bad workDays", {"workDays": [1, 1, 9]}),
                ("reject bad reminderMinutes", {"reminderMinutes": 7}),
            ]
            base_settings = saved_settings if isinstance(saved_settings, dict) else {"timezone": "Europe/Oslo"}
            for name, patch in bad_settings:
                payload = dict(base_settings)
                payload.update(patch)
                st, _, _ = http(base, "PUT", "/api/settings", body=payload, session=primary)
                mark(expect(name, st, 400))

            # CSV escaping + formula protection.
            tricky = '=SUM(A1:A2), "quoted"\nline2 +cmd @cmd -cmd'
            st, _, raw = http(base, "PUT", "/api/entries",
                              body={"date": TEST_DATE, "time": T_CSV,
                                    "text": "csv " + tricky, "tags": ["smoke"]},
                              session=primary)
            doc3 = jload(raw)
            entry3 = (doc3 or {}).get("entry") if isinstance(doc3, dict) else None
            if st == 200 and isinstance(entry3, dict) and entry3.get("id"):
                note_pass("create CSV probe quarter")
                created_primary.append(entry3["id"])
            else:
                mark(False)
                note_fail("create CSV probe quarter", "got HTTP %s" % st)
            st, hdrs, raw = http(base, "GET",
                                "/api/export?from=%s&to=%s&format=csv" % (TEST_DATE, TEST_DATE),
                                session=primary)
            ctype = {k.lower(): v for k, v in hdrs.items()}.get("content-type", "")
            if st == 200 and "csv" in ctype.lower():
                note_pass("CSV export content-type")
            else:
                mark(False)
                note_fail("CSV export content-type",
                          "expected HTTP 200 text/csv, got %s (%s)" % (st, ctype[:80]))
            if st == 200:
                try:
                    text = raw.decode("utf-8")
                    rows_csv = list(csv.reader(io.StringIO(text)))
                    flat = " ".join(" | ".join(r) for r in rows_csv)
                    if "SUM(A1:A2)" in flat:
                        note_pass("CSV contains probe text")
                    else:
                        mark(False)
                        note_fail("CSV contains probe text", "marker missing")
                    dangerous = False
                    for row in rows_csv[1:]:  # skip header
                        for cell in row:
                            s = cell.lstrip("' \t\"")
                            if "SUM(A1:A2)" in cell and s[:1] in ("=", "+", "-", "@"):
                                dangerous = True
                    if not dangerous:
                        note_pass("CSV formula protection")
                    else:
                        mark(False)
                        note_fail("CSV formula protection", "unescaped formula cell")
                except Exception as e:
                    mark(False)
                    note_fail("CSV parse", str(e)[:200])

            # JSON export.
            st, _, raw = http(base, "GET",
                              "/api/export?from=%s&to=%s&format=json" % (TEST_DATE, TEST_DATE),
                              session=primary)
            docj = jload(raw)
            if st == 200 and docj is not None:
                lst = docj.get("entries") if isinstance(docj, dict) else docj
                ids = {e.get("id") for e in lst} if isinstance(lst, list) else set()
                if eid in ids:
                    note_pass("JSON export contains entry")
                else:
                    mark(False)
                    note_fail("JSON export contains entry", "id missing")
            else:
                mark(False)
                note_fail("JSON export", "expected HTTP 200 JSON, got %s" % st)

            # IDOR with second user.
            if second:
                st, rows2 = entries_on(base, second, TEST_DATE)
                if st == 200 and rows2 is not None:
                    if any(r.get("id") == eid for r in rows2):
                        mark(False)
                        note_fail("IDOR second user cannot read entry", "id leaked")
                    else:
                        note_pass("IDOR second user cannot read entry")
                elif st in (401, 403):
                    mark(False)
                    note_fail("IDOR second user session", "got HTTP %s; fixture not allowlisted?" % st)
                else:
                    mark(False)
                    note_fail("IDOR second user read", "got HTTP %s" % st)
                st, _, _ = delete_entry(base, second, eid)
                mark(expect_in("IDOR second user cannot delete entry", st, (403, 404)))
                # Same quarter in second user's own namespace must get another id.
                st, _, raw = http(base, "PUT", "/api/entries",
                                  body={"date": TEST_DATE, "time": T_IDOR,
                                        "text": "second user quarter", "tags": []},
                                  session=second)
                doc4 = jload(raw)
                entry4 = (doc4 or {}).get("entry") if isinstance(doc4, dict) else None
                if st == 200 and isinstance(entry4, dict) and entry4.get("id") \
                        and entry4["id"] != eid:
                    note_pass("IDOR per-user quarter isolation")
                    created_second.append(entry4["id"])
                else:
                    mark(False)
                    note_fail("IDOR per-user quarter isolation", "got HTTP %s" % st)
                # Primary entry unchanged by second user's write.
                st, rows = entries_on(base, primary, TEST_DATE)
                mine = [r for r in (rows or []) if r.get("id") == eid]
                if st == 200 and len(mine) == 1 and mine[0].get("text") == "smoke one updated":
                    note_pass("IDOR primary entry unchanged")
                else:
                    mark(False)
                    note_fail("IDOR primary entry unchanged", "got HTTP %s" % st)
            else:
                note_skip("IDOR second-user coverage", "EVERY15_SECOND_SESSION absent")

            # Settings valid round-trip (then restore happens in finally).
            if isinstance(saved_settings, dict):
                probe = dict(saved_settings)
                probe["remindersEnabled"] = not bool(saved_settings.get("remindersEnabled", False))
                st, _, _ = http(base, "PUT", "/api/settings", body=probe, session=primary)
                if st == 200:
                    note_pass("settings valid PUT")
                    st2, _, raw2 = http(base, "GET", "/api/settings", session=primary)
                    if st2 == 200:
                        note_pass("settings re-read after PUT")
                    else:
                        mark(False)
                        note_fail("settings re-read after PUT", "got HTTP %s" % st2)
                else:
                    mark(False)
                    note_fail("settings valid PUT", "expected HTTP 200, got %s" % st)
            else:
                note_skip("settings valid PUT", "no saved settings to round-trip")
        finally:
            # Always clean up rows and restore settings, even on failure.
            for entry_id in list(created_second):
                try:
                    st, _, _ = delete_entry(base, second, entry_id)
                    if st in (200, 404):
                        note_pass("cleanup second-user row (got %s)" % st)
                    else:
                        mark(False)
                        note_fail("cleanup second-user row", "got HTTP %s" % st)
                except Exception as e:
                    mark(False)
                    note_fail("cleanup second-user row", str(e)[:200])
            for entry_id in list(created_primary):
                try:
                    st, _, raw = delete_entry(base, primary, entry_id)
                    doc = jload(raw)
                    if st == 200 and isinstance(doc, dict) and doc.get("ok") is True:
                        note_pass("delete entry cleans up")
                    elif st == 404:
                        note_pass("delete entry already gone (got 404)")
                    else:
                        mark(False)
                        note_fail("delete entry cleans up", "expected HTTP 200 {ok:true}, got %s" % st)
                except Exception as e:
                    mark(False)
                    note_fail("delete entry cleans up", str(e)[:200])
            st, rows = entries_on(base, primary, TEST_DATE)
            if st == 200 and rows == []:
                note_pass("test date empty after cleanup")
            else:
                mark(False)
                note_fail("test date empty after cleanup",
                          "got HTTP %s with %s" % (st, "unreadable" if rows is None else "%d rows" % len(rows)))
            if isinstance(saved_settings, dict):
                st, _, _ = http(base, "PUT", "/api/settings", body=saved_settings, session=primary)
                if st == 200:
                    note_pass("settings restored")
                else:
                    mark(False)
                    note_fail("settings restored", "expected HTTP 200, got %s" % st)

    print("---")
    print("summary: %d passed, %d failed, %d skipped"
          % (len(RESULTS["pass"]), len(RESULTS["fail"]), len(RESULTS["skip"])))
    if RESULTS["fail"]:
        return 1
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
