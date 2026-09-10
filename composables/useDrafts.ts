/**
 * Local drafts, keyed per user/date/quarter. A draft is written on every
 * keystroke, restored when the composer opens, and cleared only after the
 * server confirms the save — a failed request or a navigation never loses
 * a line.
 */
import { draftKey } from './quarters'

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* private mode: the composer still holds the text in memory */
  }
}

export function useDrafts() {
  const userId = useState<string>('fifteen_user_id', () => 'anon')

  function setUserId(id: string | null): void {
    userId.value = id || 'anon'
  }

  function loadDraft(date: string, time: string): { text: string; tags: string } {
    const raw = read(draftKey(userId.value, date, time))
    if (!raw) return { text: '', tags: '' }
    try {
      const parsed = JSON.parse(raw) as { text?: string; tags?: string }
      return { text: parsed.text ?? '', tags: parsed.tags ?? '' }
    } catch {
      return { text: raw, tags: '' }
    }
  }

  function saveDraft(date: string, time: string, text: string, tags: string): void {
    if (!text && !tags) {
      clearDraft(date, time)
      return
    }
    write(draftKey(userId.value, date, time), JSON.stringify({ text, tags }))
  }

  function clearDraft(date: string, time: string): void {
    try {
      localStorage.removeItem(draftKey(userId.value, date, time))
    } catch {
      /* ignore */
    }
  }

  function hasDraft(date: string, time: string): boolean {
    return read(draftKey(userId.value, date, time)) !== ''
  }

  return { setUserId, loadDraft, saveDraft, clearDraft, hasDraft }
}
