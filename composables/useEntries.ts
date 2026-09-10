/**
 * Entry store against the API (docs/web-rebuild.md):
 * GET /api/entries?from&to -> {entries}; PUT /api/entries (idempotent
 * upsert) -> {entry}; DELETE /api/entries/:id -> {ok:true}.
 *
 * Race safety: the range sequence and the per-quarter save sequences live in
 * shared state, so two store instances (two routes, a remount) still agree
 * on which response is newest. Range fetches merge into the map instead of
 * replacing it, and a response never overwrites a quarter that was written
 * while it was in flight. Pending and error state are visible per quarter —
 * nothing fails silently, and drafts stay in localStorage until a save
 * succeeds (see useDrafts).
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

/** True when the day string falls inside an inclusive range. */
function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to
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

  // Shared versions: every instance reads the same counters, so a stale
  // response from an earlier route can never overwrite current data.
  const rangeSeq = useState<number>('fifteen_range_seq', () => 0)
  const saveSeqMap = useState<Record<string, number>>('fifteen_save_seq', () => ({}))
  const writeSeq = useState<number>('fifteen_write_seq', () => 0)
  const writtenAt = useState<Record<string, number>>('fifteen_written_at', () => ({}))

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
    const seq = ++rangeSeq.value
    const writesBefore = writeSeq.value
    loading.value = true
    rangeError.value = null
    try {
      const data = await $fetch<{ entries: Entry[] }>('/api/entries', {
        params: { from, to },
      })
      if (seq !== rangeSeq.value) return [] // stale: a newer range won
      const next = { ...byKey.value }
      for (const k of Object.keys(next)) {
        if (inRange(k.slice(0, 10), from, to)) delete next[k]
      }
      const pendingNow = pending.value
      for (const e of data.entries ?? []) {
        const key = entryKey(e.date, e.time)
        if (!inRange(e.date, from, to)) continue
        // A quarter written or saving while this fetch flew is newer than
        // the response — the response must not clobber it.
        if ((writtenAt.value[key] ?? 0) > writesBefore) continue
        if (pendingNow[key]) continue
        next[key] = e
      }
      byKey.value = next
      rangeFrom.value = from
      rangeTo.value = to
      return Object.values(next).filter((e) => inRange(e.date, from, to))
    } catch (err) {
      if (seq !== rangeSeq.value) return []
      rangeError.value = err instanceof Error ? err.message : 'Could not load entries.'
      throw err
    } finally {
      if (seq === rangeSeq.value) loading.value = false
    }
  }

  async function saveEntry(input: EntryInput): Promise<Entry> {
    const key = entryKey(input.date, input.time)
    const seq = (saveSeqMap.value[key] ?? 0) + 1
    saveSeqMap.value = { ...saveSeqMap.value, [key]: seq }
    pending.value = { ...pending.value, [key]: true }
    saveErrors.value = { ...saveErrors.value, [key]: null }
    try {
      const data = await $fetch<{ entry: Entry }>('/api/entries', {
        method: 'PUT',
        body: { date: input.date, time: input.time, text: input.text.trim(), tags: input.tags },
      })
      if (seq !== saveSeqMap.value[key]) return data.entry // superseded: keep newer state
      byKey.value = { ...byKey.value, [key]: data.entry }
      writeSeq.value += 1
      writtenAt.value = { ...writtenAt.value, [key]: writeSeq.value }
      return data.entry
    } catch (err) {
      if (seq === saveSeqMap.value[key]) {
        saveErrors.value = {
          ...saveErrors.value,
          [key]: err instanceof Error ? err.message : 'Could not save this quarter.',
        }
      }
      throw err
    } finally {
      if (seq === saveSeqMap.value[key]) {
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
      const { [key]: _drop, ...rest } = byKey.value
      byKey.value = rest
      writeSeq.value += 1
      writtenAt.value = { ...writtenAt.value, [key]: writeSeq.value }
      lastDeleted.value = entry
    } finally {
      const { [key]: _p, ...rest } = pending.value
      pending.value = rest
    }
  }

  /**
   * Undo a delete by re-upserting the snapshot (same date+time idempotency).
   * The snapshot clears only after the server confirms, so a failed undo
   * keeps it around for a retry.
   */
  async function undoDelete(): Promise<Entry | null> {
    const snap = lastDeleted.value
    if (!snap) return null
    const restored = await saveEntry({ date: snap.date, time: snap.time, text: snap.text, tags: snap.tags })
    if (lastDeleted.value === snap) lastDeleted.value = null
    return restored
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
