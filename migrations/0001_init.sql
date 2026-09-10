-- Every15 web schema: quarter-hour entries + per-user settings.
-- One row per user/date/quarter; dates and times are local wall-clock
-- strings (YYYY-MM-DD, HH:mm), never UTC timestamps.

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, date, time)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date
  ON entries (user_id, date, time);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  work_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  reminders_enabled INTEGER NOT NULL DEFAULT 0
);
