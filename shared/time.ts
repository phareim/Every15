/**
 * Pure date/time helpers. No imports, no I/O — safe to use on server,
 * client, and in tests.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const QUARTER_MINUTES = new Set(['00', '15', '30', '45'])

/** YYYY-MM-DD that exists on the calendar (rejects 2026-02-30). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

/** HH:mm on a 24h clock. */
export function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

/** HH:mm exactly on a quarter-hour (:00, :15, :30, :45). */
export function isQuarterTimeString(value: unknown): value is string {
  if (!isValidTimeString(value)) return false
  return QUARTER_MINUTES.has(value.slice(3))
}

/** Compare two HH:mm strings: negative if a < b, 0 if equal, positive if a > b. */
export function compareTimeStrings(a: string, b: string): number {
  return timeToMinutes(a) - timeToMinutes(b)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Inclusive day count between two valid YYYY-MM-DD strings
 * (same date -> 1). Returns NaN for invalid input.
 */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = parseDateUtc(from)
  const b = parseDateUtc(to)
  if (a === null || b === null) return NaN
  return Math.round((b - a) / 86_400_000) + 1
}

function parseDateUtc(value: string): number | null {
  const match = DATE_RE.exec(value)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** True for a real IANA timezone name (rejects typos like "Oslo/Europe"). */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}
