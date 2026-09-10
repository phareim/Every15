/**
 * D1 access for entries and settings. Every query is scoped by the Reader
 * user id — rows are never shared between users. Pure mapping helpers are
 * exported for tests; the db functions need a D1 binding.
 */
import { DEFAULT_SETTINGS, type Entry, type Settings } from '~/shared/types'

interface EntryRow {
  id: string
  user_id: string
  date: string
  time: string
  text: string
  tags: string
  created_at: string
  updated_at: string
}

interface SettingsRow {
  user_id: string
  timezone: string
  start_time: string
  end_time: string
  work_days: string
  reminder_minutes: number
  reminders_enabled: number
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

export function mapEntryRow(row: EntryRow): Entry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    text: row.text,
    tags: parseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSettingsRow(row: SettingsRow): Settings {
  let workDays = DEFAULT_SETTINGS.workDays
  try {
    const parsed: unknown = JSON.parse(row.work_days)
    if (Array.isArray(parsed)) {
      workDays = parsed.filter((d): d is number => Number.isInteger(d))
    }
  } catch {
    // fall through to default
  }
  return {
    timezone: row.timezone,
    startTime: row.start_time,
    endTime: row.end_time,
    workDays,
    reminderMinutes: (row.reminder_minutes === 30 || row.reminder_minutes === 60
      ? row.reminder_minutes
      : 15) as Settings['reminderMinutes'],
    remindersEnabled: row.reminders_enabled === 1,
  }
}

const ENTRY_COLUMNS = 'id, user_id, date, time, text, tags, created_at, updated_at'

export async function listEntries(
  db: any,
  userId: string,
  from: string,
  to: string
): Promise<Entry[]> {
  const { results } = await db
    .prepare(
      `SELECT ${ENTRY_COLUMNS} FROM entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, time ASC`
    )
    .bind(userId, from, to)
    .all()
  return ((results ?? []) as EntryRow[]).map(mapEntryRow)
}

/**
 * Idempotent upsert of one quarter: same user/date/time returns the same
 * row (createdAt kept, updatedAt bumped). Caller validates input first.
 * Single statement — concurrent writes to the same quarter both succeed
 * with the stable id instead of racing a SELECT-then-INSERT.
 */
export async function upsertEntry(
  db: any,
  userId: string,
  input: { date: string; time: string; text: string; tags: string[] }
): Promise<Entry> {
  const now = new Date().toISOString()
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const row = (await db
    .prepare(
      `INSERT INTO entries (id, user_id, date, time, text, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date, time) DO UPDATE SET
         text = excluded.text,
         tags = excluded.tags,
         updated_at = excluded.updated_at
       RETURNING ${ENTRY_COLUMNS}`
    )
    .bind(id, userId, input.date, input.time, input.text, JSON.stringify(input.tags), now, now)
    .first()) as EntryRow
  return mapEntryRow(row)
}

/** Deletes one entry owned by the user. Returns false when nothing matched. */
export async function deleteEntry(db: any, userId: string, id: string): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()
  return (res?.meta?.changes ?? 0) > 0
}

export async function getSettings(db: any, userId: string): Promise<Settings> {
  const row = await db
    .prepare(
      'SELECT user_id, timezone, start_time, end_time, work_days, reminder_minutes, reminders_enabled FROM settings WHERE user_id = ?'
    )
    .bind(userId)
    .first()
  if (!row) return { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] }
  return mapSettingsRow(row as SettingsRow)
}

export async function saveSettings(db: any, userId: string, settings: Settings): Promise<Settings> {
  await db
    .prepare(
      `INSERT INTO settings (user_id, timezone, start_time, end_time, work_days, reminder_minutes, reminders_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         timezone = excluded.timezone,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         work_days = excluded.work_days,
         reminder_minutes = excluded.reminder_minutes,
         reminders_enabled = excluded.reminders_enabled`
    )
    .bind(
      userId,
      settings.timezone,
      settings.startTime,
      settings.endTime,
      JSON.stringify(settings.workDays),
      settings.reminderMinutes,
      settings.remindersEnabled ? 1 : 0
    )
    .run()
  return settings
}
