/**
 * Open-page reminders: while the day page is open, say when quarter-hours
 * in the work window have no entry. Pure derivation from settings +
 * entries + now; the page polls the clock, this file only computes.
 */
import { floorQuarter, quarterRange, timeInZone, toMinutes } from './quarters'
import type { Entry } from './useEntries'
import type { Settings } from './useSettings'

export interface ReminderState {
  /** Wall-clock quarters today still missing, earliest first. */
  missing: string[]
  /** Current quarter in the settings timezone (null when viewing another day). */
  currentQuarter: string | null
  /** Whether the reminder strip should show at all. */
  due: boolean
}

/** Monday=1..Sunday=0 workday of a wall-clock day. */
function workdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

export function computeReminders(
  settings: Settings,
  day: string,
  today: string,
  nowTime: string,
  entries: Entry[],
): ReminderState {
  if (!settings.remindersEnabled || day !== today) {
    return { missing: [], currentQuarter: null, due: false }
  }
  if (!settings.workDays.includes(workdayOf(day))) {
    return { missing: [], currentQuarter: null, due: false }
  }
  const window = quarterRange(settings.startTime, settings.endTime)
  if (window.length === 0) return { missing: [], currentQuarter: null, due: false }

  const currentQuarter = floorQuarter(nowTime)
  const logged = new Set(entries.filter((e) => e.date === day).map((e) => e.time))
  // Elapsed quarters count only once the reminder grace (15/30/60 min) has
  // passed since the quarter started — a quarter just begun is not late.
  const graceCutoff = toMinutes(currentQuarter) + 15 - settings.reminderMinutes
  const missing = window.filter(
    (q) => !logged.has(q) && toMinutes(q) < toMinutes(currentQuarter) && toMinutes(q) < graceCutoff,
  )
  const currentMissing =
    window.includes(currentQuarter) &&
    !logged.has(currentQuarter) &&
    settings.reminderMinutes <= 15 &&
    toMinutes(nowTime) >= toMinutes(currentQuarter)
  const all = currentMissing ? [...missing, currentQuarter] : missing
  return { missing: all, currentQuarter, due: all.length > 0 }
}

/** Tick the wall clock in the settings zone; call from the day page. */
export function useNow(timezone: () => string) {
  const nowMs = useState<number>('fifteen_now', () => Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  function tick(): void {
    nowMs.value = Date.now()
  }

  const today = computed(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(nowMs.value))
      const by: Record<string, string> = {}
      for (const p of parts) by[p.type] = p.value
      return `${by.year}-${by.month}-${by.day}`
    } catch {
      return new Intl.DateTimeFormat('en-CA').format(new Date(nowMs.value))
    }
  })

  const nowTime = computed(() => {
    try {
      return timeInZone(timezone(), nowMs.value)
    } catch {
      return timeInZone('Europe/Oslo', nowMs.value)
    }
  })

  function start(): void {
    stop()
    timer = setInterval(tick, 30000)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', tick)
    }
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', tick)
    }
  }

  return { nowMs, today, nowTime, start, stop, tick }
}
