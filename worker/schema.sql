-- Users table: identity and subscription status
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  apple_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  subscription_expires_at TEXT
);

-- Device registrations for push notifications
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL,
  push_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
