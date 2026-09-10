/**
 * Pure quarter-hour / wall-clock helpers for the Fifteen UI.
 *
 * The package owns no shared/ directory, so the UI carries its own helpers
 * rather than depending on the foundation's shared/time.ts.
 *
 * Contract recap (docs/web-rebuild.md): dates are local wall-clock
 * 'YYYY-MM-DD', times are wall-clock 'HH:mm' on a quarter-hour, and the
 * settings timezone only controls which wall-clock day/time "now" is.
 * Entries are never constructed as Date objects from their date+time, so no
 * UTC shift can move an entry to the wrong day.
 *
 * This file uses only JSDoc types (no TypeScript-only syntax) so the same
 * source can be executed by node for verification.
 */

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const QUARTER_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
export const MAX_TEXT = 2000
export const MAX_TAGS = 8
export const MAX_TAG_LEN = 40

/** @param {unknown} s */
export function isDayString(s) {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** @param {unknown} s */
export function isQuarterTime(s) {
  if (typeof s !== 'string' || !QUARTER_RE.test(s)) return false
  return Number(s.slice(3, 5)) % 15 === 0
}

/** @param {number} n */
export function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Add whole calendar days to a wall-clock day string. Arithmetic runs at UTC
 * noon so DST transitions in any zone cannot shift the calendar day.
 * @param {string} day 'YYYY-MM-DD'
 * @param {number} n signed offset
 */
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0) + n * 86400000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/** Compare two day strings. @returns {-1|0|1} */
export function compareDays(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Wall-clock date parts of an instant in an IANA zone.
 * @param {string} timeZone
 * @param {number} [nowMs]
 */
export function dayInZone(timeZone, nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs))
  /** @type {Record<string, string>} */
  const by = {}
  for (const p of parts) by[p.type] = p.value
  return `${by.year}-${by.month}-${by.day}`
}

/**
 * Wall-clock HH:mm of an instant in an IANA zone.
 * @param {string} timeZone
 * @param {number} [nowMs]
 */
export function timeInZone(timeZone, nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs))
  /** @type {Record<string, string>} */
  const by = {}
  for (const p of parts) by[p.type] = p.value
  return `${by.hour}:${by.minute}`
}

/** @param {string} timeZone @param {number} [nowMs] */
export function nowInZone(timeZone, nowMs = Date.now()) {
  return { day: dayInZone(timeZone, nowMs), time: timeInZone(timeZone, nowMs) }
}

/** @param {string} timeZone */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

/**
 * Floor a wall-clock time to its quarter-hour.
 * @param {string} hhmm
 */
export function floorQuarter(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${pad2(h)}:${pad2(Math.floor(m / 15) * 15)}`
}

/** @param {string} hhmm @returns {number} minutes since midnight */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** @param {number} mins @returns {string} HH:mm, wraps past midnight */
export function toHHMM(mins) {
  const n = ((mins % 1440) + 1440) % 1440
  return `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`
}

/**
 * Quarters t with start <= t < end (so end '17:00' ends at 16:45).
 * Defaults cover the full day for backfill.
 * @param {string} [start]
 * @param {string} [end]
 * @returns {string[]}
 */
export function quarterRange(start = '00:00', end = '24:00') {
  const from = toMinutes(start)
  const to = end === '24:00' ? 1440 : toMinutes(end)
  /** @type {string[]} */
  const out = []
  for (let m = from; m < to; m += 15) out.push(toHHMM(m))
  return out
}

/**
 * Monday-first week containing day. Monday=1..Sunday=0 convention matches
 * Settings.workDays.
 * @param {string} day
 */
export function weekStartMonday(day) {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return addDays(day, -((dow + 6) % 7))
}

/** @param {string} day @returns {string[]} seven days, Monday first */
export function weekDays(day) {
  const start = weekStartMonday(day)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** @param {string} day @returns {string} e.g. 'Thursday 10 September 2026' */
export function longDayLabel(day) {
  // Built from UTC parts, not Intl: identical in every browser and zone —
  // Pacific/Kiritimati must never push the label to the next day.
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return `${WEEKDAYS_LONG[dt.getUTCDay()]} ${d} ${MONTHS_LONG[m - 1]} ${y}`
}

/** @param {string} day @returns {string} e.g. 'Thu 10 Sep' */
export function shortDayLabel(day) {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return `${WEEKDAYS_SHORT[dt.getUTCDay()]} ${d} ${MONTHS_SHORT[m - 1]}`
}

/**
 * '2 h 15 min' style duration for a count of 15-minute entries.
 * @param {number} count
 */
export function fmtDuration(count) {
  const mins = count * 15
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`
  return `${h} h ${m} min`
}

/**
 * Split a tags field on commas. Validation (max 8, max 40 chars each) is
 * left to the caller so the composer can show honest errors.
 * @param {string} raw
 * @returns {string[]}
 */
export function parseTags(raw) {
  if (!raw) return []
  const seen = new Set()
  /** @type {string[]} */
  const out = []
  for (const t of raw.split(',')) {
    const tag = t.trim().replace(/\s+/g, ' ')
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out
}

/**
 * Validate composer input against the API contract.
 * @param {{ date: string, time: string, text: string, tags: string[] }} v
 * @returns {string[]} error messages, empty when valid
 */
export function validateEntryInput(v) {
  /** @type {string[]} */
  const errs = []
  if (!isDayString(v.date)) errs.push('Pick a valid date.')
  if (!isQuarterTime(v.time)) errs.push('Quarters start on the hour or at 15, 30, 45.')
  const text = (v.text || '').trim()
  if (!text) errs.push('Write a line about the quarter-hour first.')
  if (text.length > MAX_TEXT) errs.push(`Keep it under ${MAX_TEXT} characters.`)
  if (v.tags.length > MAX_TAGS) errs.push(`At most ${MAX_TAGS} tags.`)
  for (const t of v.tags) {
    if (t.length > MAX_TAG_LEN) errs.push(`Tags stay under ${MAX_TAG_LEN} characters: "${t.slice(0, 24)}…"`)
  }
  return errs
}

/**
 * CSV-escape one cell, mirroring the export contract: spreadsheet formula
 * injection protection plus quoting. Cells starting with = + - @ (or after
 * trimming leading spaces/tabs) are prefixed with a single quote.
 * @param {unknown} value
 */
export function escapeCsvCell(value) {
  let s = String(value ?? '')
  if (/^[ \t]*[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Aggregate entries by first tag for the week review. Each entry counts
 * exactly once under its first tag, or 'Untagged' — no double counting.
 * @param {Array<{ tags?: string[] }>} entries
 * @returns {Array<{ label: string, count: number }>} sorted count desc, label asc
 */
export function groupByFirstTag(entries) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const e of entries) {
    const label = e.tags && e.tags.length > 0 ? e.tags[0] : 'Untagged'
    map.set(label, (map.get(label) || 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : 1))
}

/**
 * Client-side mirror of Settings validation (server re-validates).
 * @param {{ timezone: string, startTime: string, endTime: string, workDays: number[], reminderMinutes: number, remindersEnabled: boolean }} s
 * @returns {string[]}
 */
export function validateSettings(s) {
  /** @type {string[]} */
  const errs = []
  if (!isValidTimeZone(s.timezone)) errs.push('Use a valid IANA timezone, e.g. Europe/Oslo.')
  if (!isQuarterTime(s.startTime)) errs.push('Work starts on a quarter-hour (HH:mm).')
  // The API contract accepts quarter-hour HH:mm times only — '24:00' is a
  // display convenience, not a valid setting, so the form never offers it.
  if (!isQuarterTime(s.endTime)) errs.push('Work ends on a quarter-hour (HH:mm).')
  if (
    isQuarterTime(s.startTime) &&
    isQuarterTime(s.endTime) &&
    toMinutes(s.startTime) >= toMinutes(s.endTime)
  ) {
    errs.push('The workday must start before it ends.')
  }
  const days = Array.isArray(s.workDays) ? s.workDays : []
  if (days.length === 0) errs.push('Pick at least one workday.')
  if (new Set(days).size !== days.length) errs.push('Workdays must be unique.')
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errs.push('Workdays run Monday 1 to Sunday 0.')
  if (![15, 30, 60].includes(s.reminderMinutes)) errs.push('Reminders come every 15, 30 or 60 minutes.')
  if (typeof s.remindersEnabled !== 'boolean') errs.push('Reminders are either on or off.')
  return errs
}

/** @returns {{ timezone: string, startTime: string, endTime: string, workDays: number[], reminderMinutes: number, remindersEnabled: boolean }} */
export function defaultSettings() {
  return {
    timezone: 'Europe/Oslo',
    startTime: '09:00',
    endTime: '17:00',
    workDays: [1, 2, 3, 4, 5],
    reminderMinutes: 15,
    remindersEnabled: false,
  }
}

/** Storage key for a local draft. Drafts survive failed saves and navigation. */
export function draftKey(userId, date, time) {
  return `fifteen:draft:${userId || 'anon'}:${date}:${time}`
}

/**
 * Monday=1..Sunday=0 workday of a wall-clock day (matches Settings.workDays).
 * @param {string} day 'YYYY-MM-DD'
 */
export function workdayOf(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

/**
 * The exact quarter before a slot, rolling over midnight to the previous day.
 * @param {string} date 'YYYY-MM-DD'
 * @param {string} time 'HH:mm'
 */
export function previousQuarterSlot(date, time) {
  const mins = toMinutes(time) - 15
  if (mins < 0) return { date: addDays(date, -1), time: '23:45' }
  return { date, time: toHHMM(mins) }
}

/**
 * Unlogged work-window quarters worth pointing at. Past days list every
 * unlogged quarter; today lists only quarters through the current one, so
 * the future never reads as missing. Future days and non-workdays list
 * nothing. Pure — the day page and the reminder check share it.
 * @param {{ startTime: string, endTime: string, workDays: number[] }} settings
 * @param {string} day the viewed day
 * @param {string} today wall-clock today in the settings zone
 * @param {string} nowTime wall-clock HH:mm in the settings zone
 * @param {string[]} loggedTimes quarter times already logged for day
 * @returns {string[]}
 */
export function backfillQuarters(settings, day, today, nowTime, loggedTimes) {
  const window = quarterRange(settings.startTime, settings.endTime)
  if (window.length === 0) return []
  if (!settings.workDays.includes(workdayOf(day))) return []
  if (compareDays(day, today) > 0) return []
  const logged = new Set(loggedTimes)
  if (compareDays(day, today) < 0) return window.filter((q) => !logged.has(q))
  const current = floorQuarter(nowTime)
  const cutoff = toMinutes(current)
  return window.filter((q) => !logged.has(q) && toMinutes(q) <= cutoff)
}

/**
 * Which quarter deserves a timed nudge right now, if any. The cadence
 * (15/30/60) picks boundaries — every quarter, :00/:30, or :00 — inside the
 * work window on workdays, and only for quarters with no entry yet. The
 * caller dedupes per boundary so a nudge fires once. Pure and testable.
 * @param {{ startTime: string, endTime: string, workDays: number[], reminderMinutes: number, remindersEnabled: boolean }} settings
 * @param {string} day the viewed day (must be today to nudge)
 * @param {string} today wall-clock today in the settings zone
 * @param {string} nowTime wall-clock HH:mm in the settings zone
 * @param {string[]} loggedTimes quarter times already logged for day
 * @returns {string|null} the quarter to announce, or null
 */
export function notificationTarget(settings, day, today, nowTime, loggedTimes) {
  if (!settings.remindersEnabled) return null
  if (day !== today) return null
  if (!settings.workDays.includes(workdayOf(day))) return null
  const window = quarterRange(settings.startTime, settings.endTime)
  if (window.length === 0) return null
  const q = floorQuarter(nowTime)
  if (!window.includes(q)) return null
  if (loggedTimes.includes(q)) return null
  if (toMinutes(q) % settings.reminderMinutes !== 0) return null
  return q
}

/** Dedupe key so one boundary notifies once, across remounts. */
export function notifiedKey(userId, day, time) {
  return `fifteen:notified:${userId || 'anon'}:${day}:${time}`
}
