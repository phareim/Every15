# Every15 web implementation — 2026-09-10

Replace the retired Swift client and old backend with a Nuxt 3 personal web app at https://15.phareim.no, deployed only through GitHub Actions on main. Preserve the original purpose: write what you actually spent each quarter-hour doing. No billing, Apple login, or fabricated AI insights.

## Work packages
1. Muse / foundation: root Nuxt scaffold, vendored Reader auth, own D1 schema, validated user-scoped CRUD/settings/export API, pure domain helpers and meaningful tests, CI workflow. Own package.json, nuxt.config.ts, tsconfig.json, server/, middleware/, composables/useAuth.ts, shared/, migrations/, tests/domain*, wrangler.toml, .github/.
2. Muse / interface: polished responsive Tufte tactile paper daily journal, entry composer, quarter navigation, continue previous, edit/delete with undo or confirmation, day navigation, week review, preferences and open-page reminders, CSV/JSON export UI, local draft preservation and honest save errors. Own app.vue, pages/, components/, composables/ except useAuth.ts, assets/, public/. No package/config changes. Use native Vue/Nuxt features, no extra dependency needed.
3. Coordinator: merge/review, install/build/test, browser integration and security checks, provision D1 and CI secrets, retire original client/backend, documentation, push and observe GitHub Actions, verify deployed site. Delegate fixes to Muse as appropriate.

## Shared contract (both packages must follow)
- Nuxt 3 root project; app.vue uses NuxtPage. CSS imported by app.vue (UI owns CSS); framework config does not name CSS files. API uses $fetch.
- Entry shape: { id: string, date: 'YYYY-MM-DD', time: 'HH:mm', text: string, tags: string[], createdAt: string, updatedAt: string }. Exactly one entry per user/date/quarter. Every entry accounts for 15 minutes. Dates/times are local wall-clock values, not UTC; timezone only controls current date/time/reminders. Times must be on quarter-hour. Tags optional; text max 2000 chars, tags max 8, max 40 chars each.
- GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD -> {entries: Entry[]}; inclusive max 366 days, sorted date then time.
- PUT /api/entries -> body {date,time,text,tags?:string[]} -> {entry:Entry}; idempotent upsert quarter. DELETE /api/entries/:id -> {ok:true}.
- GET /api/settings and PUT /api/settings -> {settings: Settings}; PUT accepts full Settings. Settings: { timezone: string (default Europe/Oslo), startTime:'09:00', endTime:'17:00', workDays:[1,2,3,4,5] (Mon=1 Sun=0), reminderMinutes:15|30|60, remindersEnabled:boolean (default false) }. Validate IANA timezone, start<end, HH:mm quarter times, workDays unique 0..6.
- GET /api/export?from=...&to=...&format=csv|json -> download, safe CSV escaping and spreadsheet formula injection protection.
- GET /api/auth/session -> vendored do-web pattern. Copy server/utils/readerSession.ts, cloudflare.ts, middleware/auth.global.ts, composables/useAuth.ts from /home/petter/github/do-web, change only fallback URL in useAuth to https://15.phareim.no. Every data API requires requireAllowedUser(event), owner scoped by user.id. No production auth bypass. No writes to Reader DB.
- Own data binding EVERY15_DB (database every15-web); DB binding read-only Reader session (id 2ccea3e6-cd78-45f5-9395-1094f964b273). Coordinator inserts own database id; initial placeholder REPLACE_DATABASE_ID. Worker name every15-web. Route custom_domain 15.phareim.no; allowed email phareim@gmail.com. Own migration CI before deploy.
- Pure shared helpers may live shared/time.ts; UI can implement its own helpers to avoid coordination dependency.
- UI page English, no emoji. ET Book serif, tabular times, warm tactile paper sheet on muted desk, quiet rules, one crimson primary action. Read /home/petter/.agents/skills/tufte-viz/SKILL.md and references/design-system.md. Copy needed fonts/tokens from that skill. Strong empty state, no fake saved entries. Mobile at 375px and desktop at 1440px. Accessible forms/focus/keyboard, reduced motion. Main capture prominent, journal chronological, weekly review accurate 15m accounting and direct labeled zero-based bars for tags/activity. All mutations pending/error visible; do not lose drafts on failed requests or navigation. Summaries computed from actual entries. Review explicit untagged grouping, no double counting across tags (use first tag or activity).

## Working rules
Work in assigned isolated worktree. Read CLAUDE.md for historic context but this document supersedes old architecture. Do not deploy, push, or edit the other work package's files. Commit YOUR changes on your worktree branch when complete. Run meaningful checks explicitly (foundation npm test and npm run build if UI absent add no UI placeholder; UI syntax review and report integration needs). Report commit hash, file list, checks and limitations. Coordinator will merge and push. Do not delete original Every15/ or worker/; coordinator handles retirement.

## Implementation record — 2026-09-11

Muse implemented the foundation and interface in separate worktrees, then
handled review fixes in each. A third Muse worktree delivered API and browser
verification scripts. Six Muse jobs in total produced the implementation and
verification commits. The coordinator integrated the packages, corrected
browser-observed state/layout issues, added local D1 verification to CI, and
reviewed the rendered desktop and mobile pages.

Completed locally: 33 backend unit checks, 31 UI helper checks, 58 real D1/API
checks (including concurrent upserts), and 25 browser checks. Native code and
the obsolete backend were removed from the working tree; git preserves them
at `185c512`. The historic R2 bucket was not changed.
