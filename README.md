# Every15

Time-tracking app that prompts you every 15 minutes to log what you're doing. Native macOS + iOS app with a Cloudflare backend. AI-powered work summaries.

## Structure

- `Every15/` — SwiftUI app (iOS + macOS targets, shared codebase)
- `worker/` — Cloudflare Worker backend (D1, R2, Workers AI)

## Development

### Backend

```bash
cd worker
npm install
npx wrangler dev
```

### App

Requires Xcode 16+ and [xcodegen](https://github.com/yonaskolb/XcodeGen).

```bash
cd Every15
xcodegen generate
open Every15.xcodeproj
```

Build and run the `Every15_macOS` or `Every15_iOS` scheme.

### D1 Migrations

```bash
cd worker
npx wrangler d1 execute every15-db --remote --file=schema.sql
```

## Deploy

```bash
cd worker
npx wrangler deploy
```

The worker is deployed at `https://every15-worker.aiwdm.workers.dev`.
