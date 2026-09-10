/**
 * Shared domain types. Dates/times are local wall-clock values, never UTC —
 * the timezone in Settings only controls "now", display, and reminders.
 */
export interface Entry {
  id: string
  /** Local calendar day. */
  date: string // YYYY-MM-DD
  /** Local quarter-hour. */
  time: string // HH:mm
  text: string
  tags: string[]
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export type ReminderMinutes = 15 | 30 | 60

export interface Settings {
  /** IANA timezone, e.g. Europe/Oslo. */
  timezone: string
  startTime: string // HH:mm, quarter-hour
  endTime: string // HH:mm, quarter-hour
  /** 0 = Sunday … 6 = Saturday. */
  workDays: number[]
  reminderMinutes: ReminderMinutes
  remindersEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'Europe/Oslo',
  startTime: '09:00',
  endTime: '17:00',
  workDays: [1, 2, 3, 4, 5],
  reminderMinutes: 15,
  remindersEnabled: false,
}
