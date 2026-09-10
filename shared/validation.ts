/**
 * Pure input validation for the entries/settings/export API. Throws
 * ApiError (a 400) on bad input so routes stay thin; every message is
 * written to be shown to the user verbatim.
 */
import {
  DEFAULT_SETTINGS,
  type ReminderMinutes,
  type Settings,
} from './types'
import {
  compareTimeStrings,
  daysBetweenInclusive,
  isQuarterTimeString,
  isValidDateString,
  isValidTimeString,
  isValidTimeZone,
} from './time'

export class ApiError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const badRequest = (message: string) => new ApiError(400, message)

export const MAX_TEXT_LENGTH = 2000
export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 40
/** Inclusive range cap for list/export queries. */
export const MAX_RANGE_DAYS = 366

export interface EntryInput {
  date: string
  time: string
  text: string
  tags: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateEntryInput(body: unknown): EntryInput {
  if (!isRecord(body)) throw badRequest('Request body must be a JSON object.')
  const { date, time, text } = body
  const tags = body.tags ?? []

  if (!isValidDateString(date)) {
    throw badRequest('date must be a real calendar day as YYYY-MM-DD.')
  }
  if (!isValidTimeString(time) || !isQuarterTimeString(time)) {
    throw badRequest('time must be a quarter-hour as HH:mm (:00, :15, :30 or :45).')
  }
  if (typeof text !== 'string') {
    throw badRequest('text must be a string.')
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw badRequest(`text must be at most ${MAX_TEXT_LENGTH} characters.`)
  }
  return { date, time, text, tags: validateTags(tags) }
}

export function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) throw badRequest('tags must be an array of strings.')
  if (tags.length > MAX_TAGS) {
    throw badRequest(`At most ${MAX_TAGS} tags per entry.`)
  }
  return tags.map((tag, i) => {
    if (typeof tag !== 'string' || !tag.trim()) {
      throw badRequest(`Tag #${i + 1} must be a non-empty string.`)
    }
    const trimmed = tag.trim()
    if (trimmed.length > MAX_TAG_LENGTH) {
      throw badRequest(`Tag "${trimmed.slice(0, 20)}…" must be at most ${MAX_TAG_LENGTH} characters.`)
    }
    return trimmed
  })
}

/**
 * PUT accepts a full Settings object; missing fields fall back to defaults
 * so an older client never wipes a preference it does not know about.
 */
export function validateSettings(body: unknown): Settings {
  if (!isRecord(body)) throw badRequest('Request body must be a JSON object.')
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...body }

  if (!isValidTimeZone(merged.timezone)) {
    throw badRequest('timezone must be a valid IANA name, e.g. Europe/Oslo.')
  }
  if (!isQuarterTimeString(merged.startTime) || !isQuarterTimeString(merged.endTime)) {
    throw badRequest('startTime and endTime must be quarter-hours as HH:mm.')
  }
  if (compareTimeStrings(merged.startTime as string, merged.endTime as string) >= 0) {
    throw badRequest('startTime must be earlier than endTime.')
  }
  if (!Array.isArray(merged.workDays)) {
    throw badRequest('workDays must be an array of weekday numbers 0–6.')
  }
  const workDays = merged.workDays as unknown[]
  if (workDays.some((d) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) {
    throw badRequest('workDays must be an array of weekday numbers 0–6.')
  }
  if (new Set(workDays).size !== workDays.length) {
    throw badRequest('workDays must not contain duplicates.')
  }
  const reminderMinutes = merged.reminderMinutes as unknown
  if (reminderMinutes !== 15 && reminderMinutes !== 30 && reminderMinutes !== 60) {
    throw badRequest('reminderMinutes must be 15, 30 or 60.')
  }
  if (typeof merged.remindersEnabled !== 'boolean') {
    throw badRequest('remindersEnabled must be true or false.')
  }

  return {
    timezone: merged.timezone as string,
    startTime: merged.startTime as string,
    endTime: merged.endTime as string,
    workDays: [...(workDays as number[])].sort((a, b) => a - b),
    reminderMinutes: reminderMinutes as ReminderMinutes,
    remindersEnabled: merged.remindersEnabled as boolean,
  }
}

/** Shared from/to range check for list and export endpoints. */
export function validateDateRange(query: Record<string, unknown>): { from: string; to: string } {
  const { from, to } = query
  if (!isValidDateString(from) || !isValidDateString(to)) {
    throw badRequest('from and to are required as YYYY-MM-DD.')
  }
  if (from > to) {
    throw badRequest('from must not be later than to.')
  }
  if (daysBetweenInclusive(from, to) > MAX_RANGE_DAYS) {
    throw badRequest(`Date range must be at most ${MAX_RANGE_DAYS} days.`)
  }
  return { from, to }
}
