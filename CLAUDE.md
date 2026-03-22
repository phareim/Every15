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
