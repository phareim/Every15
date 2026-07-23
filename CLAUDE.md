# Every15

Time-tracking app that prompts users every 15 minutes to log work activities.

## Tech Stack

- **Native apps:** SwiftUI (iOS + macOS), Xcode 16+
- **Backend:** Cloudflare Workers, Hono, D1 (SQLite), R2 (object storage)
- Workers AI for generating summaries
- TypeScript

## Commands

- `npm install && npx wrangler dev` — start backend locally
- `xcodegen generate && open Every15.xcodeproj` — open native app
- `npx wrangler deploy` — deploy backend to production

## Status note (2026-07-23)

The `every15-db` D1 database was deleted from the Cloudflare account (slot
cleanup; it held only one trial user row — export at
`~/backups/d1/2026-07-23/every15-db.sql` on Sleeper). The deployed worker is
therefore non-functional. To revive: `npx wrangler d1 create every15-db`,
restore the `d1_databases` block in `worker/wrangler.jsonc` with the new id,
apply the schema, and redeploy.
