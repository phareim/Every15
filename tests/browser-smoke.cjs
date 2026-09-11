#!/usr/bin/env node
'use strict';
/**
 * Every15 web rebuild — browser smoke test (Playwright, plain node).
 *
 * Run (after the UI package merges; coordinator runs this):
 *   EVERY15_TEST_SESSION=<reader session token> node tests/browser-smoke.cjs
 *   EVERY15_BASE=http://127.0.0.1:8787 EVERY15_CHROMIUM=/snap/bin/chromium \
 *     EVERY15_TEST_SESSION=<token> node tests/browser-smoke.cjs
 *
 * What it does (desktop 1440px, then mobile 390px):
 *   - Creates/reads/updates entries on the reserved date 2001-01-03 only.
 *   - Exercises the composer (IDs from source: #composer-quarter,
 *     #composer-text, #composer-tags), adjacent-quarter selection, edit,
 *     continue-previous, draft survival across navigation for both an
 *     unsaved draft and a failed-save draft (PUT intercepted once),
 *     date/quarter note isolation, delete confirm + Undo, week/history/
 *     preferences rendering, JSON+CSV downloads, and no-horizontal-overflow
 *     on a long unbroken entry at 390px. Fails on any pageerror.
 *   - Saves test-results/desktop.png and test-results/mobile.png.
 *
 * What it never does:
 *   - Refuses any EVERY15_BASE whose hostname is not local
 *     (127.0.0.1, localhost, ::1, 0.0.0.0) — no production fixture writes.
 *   - Requires the reserved date to read empty before writing; aborts (exit 2)
 *     without writes otherwise.
 *   - Deletes every entry it created via the API in a finally block and
 *     verifies the date reads empty afterwards. Never prints the session token.
 *
 * Exit codes: 0 = pass, 1 = failure, 2 = refused/usage.
 *
 * Selector policy: semantic roles and the source IDs above. The UI package
 * is adding quarter buttons, so quarter selection tolerates three shapes:
 * the #composer-quarter select, a quarter button in the composer, or an
 * unlogged-quarter chip (`Log quarter HH:mm`). Content loading goes through
 * parent-originated controls (unlogged chips for empty quarters, Edit
 * buttons for saved ones, the Pick-a-day input for dates) because those are
 * the paths that restore drafts and saved notes in the source.
 * Requires @playwright/test from the project dependencies:
 * `require('@playwright/test')`.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const BASE = process.env.EVERY15_BASE || 'http://127.0.0.1:8787';
const SESSION = process.env.EVERY15_TEST_SESSION || '';
const CHROMIUM_PATH = process.env.EVERY15_CHROMIUM || '';
const DAY = '2001-01-03';
const SPARE_DAY = '2001-01-04';
const Q1 = '09:00';
const Q2 = '09:15';
const Q3 = '09:30';
const QDRAFT = '09:45';
const QMOBILE = '10:00';
const FIRST_TEXT = 'browser smoke first line';
const FIRST_EDITED = 'browser smoke first line edited';
const SECOND_TEXT = 'browser smoke adjacent line';
const DRAFT_TEXT = 'browser smoke unsaved draft line';
const FAILED_TEXT = 'browser smoke failed draft line';
const LONG_TOKEN = `entry-${'Supercalifragilisticexpialidocious'.repeat(8)}-end`;
const RESULTS = { pass: [], fail: [], skip: [] };
const TIMEOUT = 15000;

function pass(name) {
  RESULTS.pass.push(name);
  console.log(`PASS ${name}`);
}
function fail(name, detail) {
  RESULTS.fail.push(name);
  console.log(`FAIL ${name} ${String(detail || '').slice(0, 300)}`);
}
function skip(name, reason) {
  RESULTS.skip.push(name);
  console.log(`SKIP ${name} ${reason || ''}`);
}

function baseHost() {
  try {
    return new URL(BASE).hostname;
  } catch {
    return '';
  }
}
function isLocalHost(h) {
  return ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(h);
}

async function api(method, reqPath, body) {
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Cookie: `session_token=${SESSION}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON (CSV export); callers read text */
  }
  return { status: res.status, json, text };
}
async function entriesOn(date) {
  const r = await api('GET', `/api/entries?from=${date}&to=${date}`);
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.entries)) return { status: r.status, rows: null };
  return { status: 200, rows: r.json.entries };
}
async function cleanupDate(date) {
  const { status, rows } = await entriesOn(date);
  if (status !== 200 || !rows) {
    fail(`cleanup read ${date}`, `GET /api/entries -> HTTP ${status}`);
    return false;
  }
  let ok = true;
  for (const e of rows) {
    if (!e || !e.id) continue;
    try {
      const r = await api('DELETE', `/api/entries/${encodeURIComponent(e.id)}`);
      if (r.status !== 200 && r.status !== 404) {
        fail(`cleanup delete ${date} ${e.time || '?'}`, `HTTP ${r.status}`);
        ok = false;
      }
    } catch (err) {
      fail(`cleanup delete ${date}`, String((err && err.message) || err));
      ok = false;
    }
  }
  return ok;
}

const composer = (page) => page.locator('section[aria-label="Entry composer"]');
const journal = (page) => page.locator('section[aria-label="Journal"]');

async function journalContains(page, text) {
  await page.waitForFunction(
    (t) => window.document.querySelector('section[aria-label="Journal"]')?.textContent?.includes(t),
    text,
    { timeout: TIMEOUT },
  );
}
async function journalLacks(page, text) {
  await page.waitForFunction(
    (t) => !window.document.querySelector('section[aria-label="Journal"]')?.textContent?.includes(t),
    text,
    { timeout: TIMEOUT },
  );
}
async function toastShows(page, text) {
  await page.waitForFunction(
    (t) => window.document.querySelector('div[role="status"]')?.textContent?.includes(t),
    text,
    { timeout: TIMEOUT },
  );
}
async function composerShows(page, text) {
  await page.waitForFunction(
    (t) => window.document.querySelector('#composer-text')?.value.includes(t),
    text,
    { timeout: TIMEOUT },
  );
}
async function composerEmpty(page) {
  await page.waitForFunction(
    () => window.document.querySelector('#composer-text')?.value === '',
    null,
    { timeout: TIMEOUT },
  );
}
async function composerText(page) {
  return composer(page).locator('#composer-text').inputValue();
}

/**
 * Tolerant quarter setter: #composer-quarter select when present, else a
 * quarter button in the composer, else an unlogged chip. Use for choosing a
 * fresh target before typing; content loading for saved/draft quarters goes
 * through openQuarter (chips) or the row Edit button instead.
 */
async function setQuarter(page, q) {
  const sel = page.locator('#composer-quarter');
  if ((await sel.count()) > 0 && await sel.first().isVisible()) {
    await sel.first().selectOption(q);
    return 'select';
  }
  const inComposer = composer(page).getByRole('button', { name: new RegExp(`^${q}`) });
  if ((await inComposer.count()) > 0) {
    await inComposer.first().click();
    return 'button';
  }
  await openQuarter(page, q);
  return 'chip';
}

/**
 * Open a quarter through its unlogged chip (`Log quarter HH:mm`). This is a
 * parent-originated change, so the composer restores the quarter's draft (or
 * pristine emptiness) per the source. When the select exists it must track
 * the change — the existing select/input IDs stay while buttons are added.
 */
async function openQuarter(page, q) {
  await page.getByRole('button', { name: `Log quarter ${q}` }).first().click();
  const sel = page.locator('#composer-quarter');
  if ((await sel.count()) > 0 && await sel.first().isVisible()) {
    await page.waitForFunction(
      (v) => window.document.querySelector('#composer-quarter')?.value === v,
      q,
      { timeout: TIMEOUT },
    );
  }
}

/** Click Save quarter / Overwrite and wait for the PUT response (any status). */
async function clickSave(page) {
  const btn = composer(page).getByRole('button', { name: /Save quarter|Overwrite/ });
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/entries') && r.request().method() === 'PUT',
      { timeout: TIMEOUT },
    ),
    btn.click(),
  ]);
  return resp;
}
function rowFor(page, text) {
  return journal(page).locator('li', { hasText: text });
}
/** Load a saved quarter into the composer through its row Edit button. */
async function editQuarter(page, text) {
  await rowFor(page, text).getByRole('button', { name: /^Edit$/ }).click();
  await composerShows(page, text);
}
function pageUrlHas(page, fragment) {
  try {
    return page.url().includes(fragment);
  } catch {
    return false;
  }
}
/** Change the day through the DayNavigator Pick-a-day input (source path). */
async function pickDay(page, day) {
  const input = page.locator('input[aria-label="Pick a day"]').first();
  await input.fill(day);
  await input.press('Tab').catch(() => {});
  await page
    .waitForFunction((d) => window.location.search.includes(d), day, { timeout: 5000 })
    .catch(() => {});
  if (!pageUrlHas(page, day)) {
    await page.goto(`${BASE}/?date=${day}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  }
  await page.locator('section[aria-label="Journal"]').waitFor({ timeout: TIMEOUT });
}

async function main() {
  if (!SESSION) {
    console.log('REFUSE: EVERY15_TEST_SESSION is required (Reader session cookie value).');
    return 2;
  }
  const host = baseHost();
  if (!isLocalHost(host)) {
    console.log(`REFUSE: EVERY15_BASE origin "${BASE}" is not local; fixture writes stay local.`);
    return 2;
  }

  const resultsDir = path.resolve(__dirname, '..', 'test-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const launchOpts = { headless: true };
  if (CHROMIUM_PATH) launchOpts.executablePath = CHROMIUM_PATH;
  else if (fs.existsSync('/snap/bin/chromium')) launchOpts.executablePath = '/snap/bin/chromium';

  let browser = null;
  let ok = true;
  const mark = (v) => {
    if (!v) ok = false;
  };
  try {
    // ---- Precondition: reserved date reads empty before any write ----
    let pre;
    try {
      pre = await entriesOn(DAY);
    } catch (err) {
      fail('precondition read test date', `transport: ${(err && err.message) || err}`);
      return 1;
    }
    if (pre.status === 401 || pre.status === 403) {
      fail('primary session accepted', `got HTTP ${pre.status}; token not allowlisted?`);
      return 1;
    }
    if (pre.status !== 200 || !pre.rows) {
      fail('precondition read test date', `expected HTTP 200 {entries:[]}, got ${pre.status}`);
      return 1;
    }
    if (pre.rows.length !== 0) {
      console.log(`REFUSE: ${pre.rows.length} entr(ies) already exist on ${DAY}; reserved and must start empty. No writes made.`);
      return 2;
    }
    pass('precondition test date empty');

    browser = await chromium.launch(launchOpts);

    // ================= Desktop 1440px =================
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'session_token', value: SESSION, domain: host, path: '/' }]);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String((err && err.message) || err)));

    await page.goto(`${BASE}/?date=${DAY}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    try {
      await page.locator('section[aria-label="Entry composer"]').waitFor({ timeout: TIMEOUT });
      await page.locator('#composer-quarter, #composer-text').first().waitFor({ timeout: TIMEOUT });
      pass('day renders entry composer');
    } catch (err) {
      fail('day renders entry composer', 'composer never appeared (signed out?)');
      throw err;
    }

    // ---- Capture Q1 09:00 (composer opens on the first unlogged quarter) ----
    try {
      await setQuarter(page, Q1);
      await composer(page).locator('#composer-text').fill(FIRST_TEXT);
      await composer(page).locator('#composer-tags').fill('smoke');
      const resp = await clickSave(page);
      assert.strictEqual(resp.status(), 200);
      await journalContains(page, FIRST_TEXT);
      await toastShows(page, 'Saved');
      pass('desktop capture 09:00');
    } catch (err) {
      fail('desktop capture 09:00', (err && err.message) || err);
      mark(false);
    }

    // ---- Adjacent quarter selection: no bleed, then save Q2 ----
    try {
      await openQuarter(page, Q2);
      await composerEmpty(page);
      await composer(page).locator('#composer-text').fill(SECOND_TEXT);
      await composer(page).locator('#composer-tags').fill('');
      const resp = await clickSave(page);
      assert.strictEqual(resp.status(), 200);
      await journalContains(page, SECOND_TEXT);
      await journalContains(page, FIRST_TEXT);
      pass('adjacent quarter selection and save');
    } catch (err) {
      fail('adjacent quarter selection and save', (err && err.message) || err);
      mark(false);
    }

    // ---- Edit Q1 (overwrite, same quarter, no duplicate) ----
    try {
      await editQuarter(page, FIRST_TEXT);
      await composer(page).locator('#composer-text').fill(FIRST_EDITED);
      const resp = await clickSave(page);
      assert.strictEqual(resp.status(), 200);
      await journalContains(page, FIRST_EDITED);
      const { rows } = await entriesOn(DAY);
      const dupes = (rows || []).filter((e) => e.date === DAY && e.time === Q1);
      assert.strictEqual(dupes.length, 1, 'overwrite must not duplicate the quarter');
      pass('edit overwrites same quarter');
    } catch (err) {
      fail('edit overwrites same quarter', (err && err.message) || err);
      mark(false);
    }

    // ---- Continue previous (when offered) ----
    try {
      await openQuarter(page, Q3);
      await composerEmpty(page);
      const cont = composer(page).getByRole('button', { name: /Continue previous/ });
      if ((await cont.count()) === 0) {
        skip('continue previous prefills', 'button not offered');
      } else {
        await cont.first().click();
        await composerShows(page, SECOND_TEXT);
        pass('continue previous prefills');
      }
      await composer(page).locator('#composer-text').fill('');
      await composer(page).locator('#composer-tags').fill('');
    } catch (err) {
      fail('continue previous prefills', (err && err.message) || err);
      mark(false);
    }

    // ---- Unsaved new draft survives navigation away/back ----
    try {
      await openQuarter(page, QDRAFT);
      await composerEmpty(page);
      await composer(page).locator('#composer-text').fill(DRAFT_TEXT);
      await page.getByRole('link', { name: /History/ }).first().click();
      await page.getByRole('heading', { name: /Past days/ }).waitFor({ timeout: TIMEOUT });
      await page.goBack({ timeout: TIMEOUT });
      await page.locator('section[aria-label="Entry composer"]').waitFor({ timeout: TIMEOUT });
      await openQuarter(page, QDRAFT);
      const v = await composerText(page);
      assert.ok(v.includes(DRAFT_TEXT), 'unsaved draft lost across navigation');
      pass('navigation preserves unsaved new draft');
      await composer(page).locator('#composer-text').fill('');
    } catch (err) {
      fail('navigation preserves unsaved new draft', (err && err.message) || err);
      mark(false);
    }

    // ---- Failed save keeps the draft; draft survives navigation; retry saves ----
    try {
      await openQuarter(page, Q3);
      await composer(page).locator('#composer-text').fill(FAILED_TEXT);
      await composer(page).locator('#composer-tags').fill('');
      await page.unrouteAll({ behavior: 'wait' }).catch(() => {});
      await page.route('**/api/entries', (route) => route.abort(), { times: 1 });
      await composer(page).getByRole('button', { name: /Save quarter|Overwrite/ }).click();
      await page
        .waitForFunction(
          () =>
            window.document.querySelector('#composer-error')?.textContent?.trim() ||
            window.document.querySelector('div[role="status"]')?.textContent?.includes('draft'),
          null,
          { timeout: TIMEOUT },
        )
        .catch(() => {});
      const kept = await composerText(page);
      assert.ok(kept.includes(FAILED_TEXT), 'failed save must keep the draft in the composer');
      const errLine =
        (await page.locator('#composer-error').count())
          ? (await page.locator('#composer-error').first().textContent()) || ''
          : '';
      const toastLine =
        (await page.locator('div[role="status"]').count())
          ? (await page.locator('div[role="status"]').first().textContent()) || ''
          : '';
      assert.ok(errLine.trim() || /draft/i.test(toastLine), 'failed save must surface a pending/error state');
      pass('failed save keeps draft with error state');
      // Away and back: the failed draft must still be there.
      await page.getByRole('link', { name: /Week/ }).first().click();
      await page.locator('section[aria-label="Days"]').waitFor({ timeout: TIMEOUT });
      await page.goBack({ timeout: TIMEOUT });
      await page.locator('section[aria-label="Entry composer"]').waitFor({ timeout: TIMEOUT });
      await openQuarter(page, Q3);
      const keptAfter = await composerText(page);
      assert.ok(keptAfter.includes(FAILED_TEXT), 'failed draft lost across navigation');
      pass('navigation preserves failed edit draft');
      // Retry without the abort: the same draft saves.
      await page.unrouteAll({ behavior: 'wait' }).catch(() => {});
      const resp = await clickSave(page);
      assert.strictEqual(resp.status(), 200);
      await journalContains(page, FAILED_TEXT);
      pass('failed draft retry saves');
    } catch (err) {
      fail('failed save draft handling', (err && err.message) || err);
      mark(false);
    } finally {
      await page.unrouteAll({ behavior: 'wait' }).catch(() => {});
    }

    // ---- Date/quarter changes do not bleed notes ----
    try {
      await editQuarter(page, FIRST_EDITED);
      await editQuarter(page, SECOND_TEXT);
      const atQ2 = await composerText(page);
      assert.ok(!atQ2.includes(FIRST_EDITED), 'quarter change bled the 09:00 note');
      await openQuarter(page, QDRAFT);
      await composerEmpty(page);
      await pickDay(page, SPARE_DAY);
      for (const t of [FIRST_EDITED, SECOND_TEXT, FAILED_TEXT]) {
        const body = (await journal(page).textContent()) || '';
        assert.ok(!body.includes(t), `day change bled a note (${t.slice(0, 24)}…)`);
      }
      const spareComposer = await composerText(page);
      assert.ok(
        ![FIRST_EDITED, SECOND_TEXT, FAILED_TEXT].some((t) => spareComposer.includes(t)),
        'day change bled a note into the composer',
      );
      await pickDay(page, DAY);
      await journalContains(page, FIRST_EDITED);
      pass('date and quarter changes do not bleed notes');
    } catch (err) {
      fail('date and quarter changes do not bleed notes', (err && err.message) || err);
      mark(false);
    }

    // ---- Delete confirmation, Keep, Yes, Undo ----
    try {
      const row = rowFor(page, SECOND_TEXT);
      await row.getByRole('button', { name: /^Delete$/ }).click();
      const keep = row.getByRole('button', { name: /^Keep$/ });
      await keep.waitFor({ timeout: TIMEOUT });
      await keep.click();
      await journalContains(page, SECOND_TEXT);
      pass('delete confirmation offers Keep');
      await rowFor(page, SECOND_TEXT).getByRole('button', { name: /^Delete$/ }).click();
      const yes = rowFor(page, SECOND_TEXT).getByRole('button', { name: /^Yes$/ });
      await yes.waitFor({ timeout: TIMEOUT });
      await yes.click();
      await journalLacks(page, SECOND_TEXT);
      pass('delete confirmation Yes removes entry');
      const undo = page.locator('div[role="status"]').getByRole('button', { name: /^Undo$/ });
      await undo.waitFor({ timeout: TIMEOUT });
      await undo.click();
      await journalContains(page, SECOND_TEXT);
      pass('Undo restores deleted entry');
    } catch (err) {
      fail('delete confirmation and Undo', (err && err.message) || err);
      mark(false);
    }

    // ---- Week / history / preferences routes render ----
    try {
      await page.goto(`${BASE}/week`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.locator('section[aria-label="Days"]').waitFor({ timeout: TIMEOUT });
      await page.locator('section[aria-label="Days"]').waitFor({ timeout: TIMEOUT });
      pass('week route renders');
      await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.getByRole('heading', { name: /Past days/ }).waitFor({ timeout: TIMEOUT });
      await page.locator('#history-pick').waitFor({ timeout: TIMEOUT });
      pass('history route renders');
      await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.getByRole('heading', { name: /How the journal keeps time/ }).waitFor({ timeout: TIMEOUT });
      await page.locator('form[aria-label="Preferences"]').waitFor({ timeout: TIMEOUT });
      await page.locator('section[aria-label="Export"]').waitFor({ timeout: TIMEOUT });
      pass('preferences route renders');
    } catch (err) {
      fail('week/history/preferences routes render', (err && err.message) || err);
      mark(false);
    }

    // ---- JSON + CSV downloads ----
    try {
      await page.locator('#export-from').fill(DAY);
      await page.locator('#export-to').fill(DAY);
      await page.locator('#export-format').selectOption('json');
      const dlJson = page.waitForEvent('download', { timeout: TIMEOUT });
      await page.locator('section[aria-label="Export"]').getByRole('button', { name: /Download/ }).click();
      const jsonFile = await dlJson;
      assert.ok((jsonFile.suggestedFilename() || '').includes(DAY), 'JSON filename should name the range');
      pass('JSON export downloads');
      await page.locator('#export-format').selectOption('csv');
      const dlCsv = page.waitForEvent('download', { timeout: TIMEOUT });
      await page.locator('section[aria-label="Export"]').getByRole('button', { name: /Download/ }).click();
      const csvFile = await dlCsv;
      assert.ok((csvFile.suggestedFilename() || '').includes(DAY), 'CSV filename should name the range');
      pass('CSV export downloads');
    } catch (err) {
      fail('JSON/CSV export downloads', (err && err.message) || err);
      mark(false);
    }

    // ---- Desktop screenshot on the journal ----
    try {
      await page.goto(`${BASE}/?date=${DAY}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await journalContains(page, FIRST_EDITED);
      await page.screenshot({ path: path.join(resultsDir, 'desktop.png') });
      pass('desktop screenshot saved');
    } catch (err) {
      fail('desktop screenshot saved', (err && err.message) || err);
      mark(false);
    }
    if (pageErrors.length > 0) {
      fail('desktop pageerror none', pageErrors[0]);
      mark(false);
    } else {
      pass('desktop pageerror none');
    }
    await ctx.close();

    // ================= Mobile 390px =================
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await mctx.addCookies([{ name: 'session_token', value: SESSION, domain: host, path: '/' }]);
    const mpage = await mctx.newPage();
    const mErrors = [];
    mpage.on('pageerror', (err) => mErrors.push(String((err && err.message) || err)));
    try {
      await mpage.goto(`${BASE}/?date=${DAY}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await mpage.locator('section[aria-label="Entry composer"]').waitFor({ timeout: TIMEOUT });
      await setQuarter(mpage, QMOBILE);
      await composer(mpage).locator('#composer-text').fill(LONG_TOKEN);
      await composer(mpage).locator('#composer-tags').fill('');
      const resp = await clickSave(mpage);
      assert.strictEqual(resp.status(), 200);
      await journalContains(mpage, LONG_TOKEN.slice(0, 32));
      const overflow = await mpage.evaluate(
        () => window.document.documentElement.scrollWidth - window.document.documentElement.clientWidth,
      );
      assert.ok(overflow <= 1, `horizontal overflow of ${overflow}px at 390px viewport`);
      pass('mobile 390px long entry no horizontal overflow');
      await mpage.screenshot({ path: path.join(resultsDir, 'mobile.png') });
      pass('mobile screenshot saved');
    } catch (err) {
      fail('mobile 390px long entry no horizontal overflow', (err && err.message) || err);
      mark(false);
    }
    if (mErrors.length > 0) {
      fail('mobile pageerror none', mErrors[0]);
      mark(false);
    } else {
      pass('mobile pageerror none');
    }
    await mctx.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    // ---- Always clean up fixture rows via the API ----
    try {
      const a = await cleanupDate(DAY);
      const b = await cleanupDate(SPARE_DAY);
      if (a && b) {
        const { status, rows } = await entriesOn(DAY);
        if (status === 200 && rows && rows.length === 0) pass('test date empty after cleanup');
        else {
          fail('test date empty after cleanup', `HTTP ${status} with ${(rows || []).length} rows`);
          ok = false;
        }
      } else {
        ok = false;
      }
    } catch (err) {
      fail('test date empty after cleanup', String((err && err.message) || err));
      ok = false;
    }
  }

  console.log('---');
  console.log(`summary: ${RESULTS.pass.length} passed, ${RESULTS.fail.length} failed, ${RESULTS.skip.length} skipped`);
  return ok && RESULTS.fail.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.log(`FAIL top-level ${String((err && err.message) || err).slice(0, 300)}`);
      process.exit(1);
    });
}
