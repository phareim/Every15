# Every15

A quiet record of what you actually spend your day on. Write one short note per
quarter-hour, continue the previous activity, or fill in a missed moment.

Web app: **https://15.phareim.no**. Private, behind Reader login.

## Product

- Daily quarter-hour journal with editing and backfilling.
- Weekly review based on the minutes you recorded.
- Workday preferences and optional reminders while the page is open.
- CSV and JSON exports.
- Tufte tactile paper, ET Book typography, desktop and mobile layouts.

Every entry represents 15 minutes. Unrecorded time stays unrecorded; summaries
never infer what happened in a gap. Browser reminders require an open page and
may be delayed when the browser suspends it.

## Architecture

Nuxt 3 runs on a Cloudflare Worker (`every15-web`). Reader's shared session
cookie identifies the user; an email allowlist gates all application data.
The `DB` binding reads Reader sessions only. `EVERY15_DB` is this application's
own D1 database and stores entries and preferences, scoped by user ID.

Local dates and quarter-hour times are stored as wall-clock values. Preferences
select the timezone used for the current day and reminders.

## Development

```sh
npm ci
npm test
npm run build
bash scripts/test-worker.sh
```

See [the work packages and API contract](docs/web-rebuild.md) and
[verification instructions](docs/testing.md).

## Deployment

Push to `main` runs `.github/workflows/deploy.yml`: tests, build, local API checks, D1 migrations,
then Worker deployment. Repository secrets: `CLOUDFLARE_API_TOKEN` (Worker and D1
permissions) and `CLOUDFLARE_ACCOUNT_ID`. The custom domain is declared in
`wrangler.toml`; Cloudflare manages its route and certificate.

Schema changes belong in numbered `migrations/` files. Never mutate Reader's
schema or session rows from this app. The allowed email is configured with
`NUXT_ALLOWED_USER_EMAILS`.

## Original client

The SwiftUI iOS/macOS client and its Apple-authenticated backend were retired
for this web rebuild on 2026-09-10. Their source remains in git at `185c512`.
The old `every15-db` had already been deleted on 2026-07-23; its historical
export is on Sleeper at `~/backups/d1/2026-07-23/every15-db.sql`.
Existing R2 objects are retained; this rebuild does not delete historical data.
