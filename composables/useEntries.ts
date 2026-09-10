/**
 * Entry store against the foundation API (docs/web-rebuild.md):
 * GET /api/entries?from&to -> {entries}; PUT /api/entries (idempotent
 * upsert) -> {entry}; DELETE /api/entries/:id -> {ok:true}.
 *
 * Race safety: every range fetch carries a sequence number and only the
 * latest response writes state; every upsert is keyed per quarter with its
 * own sequence so a slow save cannot overwrite a newer one. Pending and
 * error state are visible per quarter — nothing fails silently, and drafts
 * stay in localStorage until a save succeeds (see useDrafts).
 */

export interface Entry {
  id: string
  date: string
  time: string
  text: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface EntryInput {
  date: string
  time: string
  text: string
  tags: string[]
}

export function entryKey(date: string, time: string): string {
  return `${date} ${time}`
}

export function useEntries() {
  const byKey = useState<Record<string, Entry>>('fifteen_entries', () => ({}))
  const rangeFrom = useState<string | null>('fifteen_range_from', () => null)
  const rangeTo = useState<string | null>('fifteen_range_to', () => null)
  const loading = useState<boolean>('fifteen_loading', () => false)
  const rangeError = useState<string | null>('fifteen_range_error', () => null)
  const pending = useState<Record<string, boolean>>('fifteen_pending', () => ({}))
  const saveErrors = useState<Record<string, string | null>>('fifteen_save_errors', () => ({}))
  const lastDeleted = useState<Entry | null>('fifteen_last_deleted', () => null)

  let rangeSeq = 0
  const saveSeq: Record<string, number> = {}

  const sorted = computed<Entry[]>(() =>
    Object.values(byKey.value).sort((a, b) =>
      a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1,
    ),
  )

  function entriesForDay(day: string): Entry[] {
    return sorted.value.filter((e) => e.date === day)
  }

  function entryAt(date: string, time: string): Entry | null {
    return byKey.value[entryKey(date, time)] ?? null
  }

  function isPending(date: string, time: string): boolean {
    return !!pending.value[entryKey(date, time)]
  }

  async function fetchRange(from: string, to: string): Promise<Entry[]> {
    const seq = ++rangeSeq
    loading.value = true
    rangeError.value = null
    try {
      const data = await $fetch<{ entries: Entry[] }>('/api/entries', {
        params: { from, to },
      })
      if (seq !== rangeSeq) return [] // stale: a newer range won
      const next: Record<string, Entry> = {}
      for (const e of data.entries ?? []) next[entryKey(e.date, e.time)] = e
      byKey.value = next
      rangeFrom.value = from
      rangeTo.value = to
      return Object.values(next)
    } catch (err) {
      if (seq !== rangeSeq) return []
      rangeError.value = err instanceof Error ? err.message : 'Could not load entries.'
      throw err
    } finally {
      if (seq === rangeSeq) loading.value = false
    }
  }

  async function saveEntry(input: EntryInput): Promise<Entry> {
    const key = entryKey(input.date, input.time)
    const seq = (saveSeq[key] ?? 0) + 1
    saveSeq[key] = seq
    pending.value = { ...pending.value, [key]: true }
    saveErrors.value = { ...saveErrors.value, [key]: null }
    try {
      const data = await $fetch<{ entry: Entry }>('/api/entries', {
        method: 'PUT',
        body: { date: input.date, time: input.time, text: input.text.trim(), tags: input.tags },
      })
      if (seq !== saveSeq[key]) return data.entry // superseded: keep newer state
      byKey.value = { ...byKey.value, [key]: data.entry }
      return data.entry
    } catch (err) {
      if (seq === saveSeq[key]) {
        saveErrors.value = {
          ...saveErrors.value,
          [key]: err instanceof Error ? err.message : 'Could not save this quarter.',
        }
      }
      throw err
    } finally {
      if (seq === saveSeq[key]) {
        const { [key]: _drop, ...rest } = pending.value
        pending.value = rest
      }
    }
  }

  async function deleteEntry(entry: Entry): Promise<void> {
    const key = entryKey(entry.date, entry.time)
    pending.value = { ...pending.value, [key]: true }
    try {
      await $fetch<{ ok: true }>(`/api/entries/${entry.id}`, { method: 'DELETE' })
      lastDeleted.value = entry
      const { [key]: _drop, ...rest } = byKey.value
      byKey.value = rest
    } finally {
      const { [key]: _p, ...rest } = pending.value
      pending.value = rest
    }
  }

  /** Undo a delete by re-upserting the snapshot (same date+time idempotency). */
  async function undoDelete(): Promise<Entry | null> {
    const snap = lastDeleted.value
    if (!snap) return null
    lastDeleted.value = null
    return saveEntry({ date: snap.date, time: snap.time, text: snap.text, tags: snap.tags })
  }

  return {
    byKey,
    sorted,
    loading,
    rangeError,
    pending,
    saveErrors,
    lastDeleted,
    entriesForDay,
    entryAt,
    isPending,
    fetchRange,
    saveEntry,
    deleteEntry,
    undoDelete,
  }
}
