/**
 * Reminders, two layers:
 *
 * 1. Inline (computeReminders): while the day page is open, name the
 *    quarters in the work window with no entry yet. Pure derivation from
 *    settings + entries + now; the page polls the clock, this file only
 *    computes. Past days and non-workdays never read as missing; today
 *    lists only quarters through the current one.
 *
 * 2. Timed (useBrowserNotify + notificationTarget): optional browser
 *    notifications at the 15/30/60-minute cadence during the scheduled work
 *    window on workdays. Permission is requested only on an explicit click.
 *    Each boundary fires once (localStorage dedupe survives remounts), never
 *    for an already-logged quarter. Notifications need the app open in a
 *    tab; a suspended tab may delay them.
 */
import {
  backfillQuarters,
  floorQuarter,
  notificationTarget,
  notifiedKey,
  timeInZone,
} from './quarters'
import type { Entry } from './useEntries'
import type { Settings } from './useSettings'

export interface ReminderState {
  /** Wall-clock quarters still missing, earliest first. */
  missing: string[]
  /** Current quarter in the settings timezone (null when viewing another day). */
  currentQuarter: string | null
  /** Whether the reminder strip should show at all. */
  due: boolean
}

export function computeReminders(
  settings: Settings,
  day: string,
  today: string,
  nowTime: string,
  entries: Entry[],
): ReminderState {
  const logged = entries.filter((e) => e.date === day).map((e) => e.time)
  const missing = backfillQuarters(settings, day, today, nowTime, logged)
  const currentQuarter = day === today ? floorQuarter(nowTime) : null
  return { missing, currentQuarter, due: settings.remindersEnabled && missing.length > 0 }
}

/** Which quarter to announce now, if any — the pure cadence check. */
export function reminderTarget(
  settings: Settings,
  day: string,
  today: string,
  nowTime: string,
  entries: Entry[],
): string | null {
  return notificationTarget(
    settings,
    day,
    today,
    nowTime,
    entries.filter((e) => e.date === day).map((e) => e.time),
  )
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

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Browser-notification state, shared between the shell (which fires) and the
 * strip (which holds the enable button). Firing is deduped per boundary in
 * localStorage, so rerenders and remounts never repeat a nudge.
 */
export function useBrowserNotify() {
  const permission = useState<NotifyPermission>('fifteen_notif_perm', () =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  function refresh(): void {
    if (typeof Notification === 'undefined') permission.value = 'unsupported'
    else permission.value = Notification.permission
  }

  /** Call only from an explicit click — browsers ignore it elsewhere. */
  async function enable(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return false
    }
    const p = await Notification.requestPermission()
    permission.value = p
    return p === 'granted'
  }

  function alreadyFired(userId: string, day: string, time: string): boolean {
    try {
      return localStorage.getItem(notifiedKey(userId, day, time)) === '1'
    } catch {
      return false
    }
  }

  /** Fire once per boundary; returns true when a notification went out. */
  function fire(userId: string, day: string, time: string, missing: number): boolean {
    if (permission.value !== 'granted') return false
    if (typeof Notification === 'undefined') return false
    const key = notifiedKey(userId, day, time)
    try {
      if (localStorage.getItem(key) === '1') return false
      localStorage.setItem(key, '1')
    } catch {
      /* private mode: still notify, dedupe is best-effort */
    }
    try {
      new Notification(`Fifteen — ${time} unlogged`, {
        body:
          missing === 1
            ? 'One quarter-hour in the work window has no entry yet.'
            : `${missing} quarters in the work window have no entry yet. Open the tab to log them.`,
        tag: key,
      })
      return true
    } catch {
      return false
    }
  }

  return { permission, refresh, enable, alreadyFired, fire }
}
