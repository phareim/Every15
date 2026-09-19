# Every15

Personal quarter-hour journal at https://15.phareim.no.
Web rebuild: 2026-09-10. The original native client is preserved in git at
`185c512`; do not use its Apple auth or old Worker deployment workflow.

## Stack and commands

- Nuxt 3 / Vue / TypeScript on Cloudflare Workers.
- `npm ci`, `npm test`, `npm run build`.
- GitHub Actions deploys main after tests/build and D1 migrations.
- Tufte Viz tactile paper and bundled ET Book; use the tufte-viz skill.

## Guardrails

- Reader SSO vendor files follow do-web. `DB` is read-only Reader sessions.
- Every data API calls `requireAllowedUser`; every query scopes by user ID.
- `EVERY15_DB` is the app's own database; numbered SQL migrations run in CI.
- One entry per user/date/quarter. Each means 15 minutes; don't infer gaps.
- Preserve local date/time semantics; use settings timezone for the clock.
- Never lose a draft on a failed save; show pending/error states honestly.
- Browser reminders work only while the page is open, subject to suspension.
- Do not overwrite unrelated changes. Commit and push completed work on main.
- Update README for API/configuration/operational changes; date live claims.

Work packages and API: docs/web-rebuild.md. Product/operations: README.md.
