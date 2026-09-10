/**
 * Local drafts, keyed per user/date/quarter. A draft is written on every
 * keystroke, restored when the composer opens, and cleared only after the
 * server confirms the save — a failed request or a navigation never loses
 * a line.
 *
 * Presence is the signal: a stored draft always wins over the server entry,
 * even when the draft holds deliberately cleared (empty) text. Absence
 * (null) means "never touched", which is the only case where the saved
 * entry shows.
 */
import { draftKey } from './quarters'

export interface Draft {
  text: string
  tags: string
}

function rawRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function useDrafts() {
  const userId = useState<string>('fifteen_user_id', () => 'anon')

  function setUserId(id: string | null): void {
    userId.value = id || 'anon'
  }

  /** Null when the slot was never touched; empty strings are a real draft. */
  function loadDraft(date: string, time: string): Draft | null {
    const raw = rawRead(draftKey(userId.value, date, time))
    if (raw === null) return null
    if (!raw) return { text: '', tags: '' }
    try {
      const parsed = JSON.parse(raw) as { text?: string; tags?: string }
      return { text: parsed.text ?? '', tags: parsed.tags ?? '' }
    } catch {
      return { text: raw, tags: '' }
    }
  }

  function saveDraft(date: string, time: string, text: string, tags: string): void {
    try {
      localStorage.setItem(draftKey(userId.value, date, time), JSON.stringify({ text, tags }))
    } catch {
      /* private mode: the composer still holds the text in memory */
    }
  }

  function clearDraft(date: string, time: string): void {
    try {
      localStorage.removeItem(draftKey(userId.value, date, time))
    } catch {
      /* ignore */
    }
  }

  function hasDraft(date: string, time: string): boolean {
    return rawRead(draftKey(userId.value, date, time)) !== null
  }

  return { setUserId, loadDraft, saveDraft, clearDraft, hasDraft }
}
