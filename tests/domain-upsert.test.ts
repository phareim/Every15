/**
 * Regression tests for the atomic entry upsert: one INSERT ... ON CONFLICT
 * (user_id, date, time) DO UPDATE ... RETURNING statement, so concurrent
 * writes to the same quarter both succeed with the stable row id.
 *
 * The fake D1 below enforces the UNIQUE(user_id, date, time) constraint
 * like real SQLite: a plain INSERT of a duplicate key throws, while a
 * statement carrying an ON CONFLICT clause upserts. A SELECT-then-INSERT
 * implementation would fail the parallel-writes test against this fake.
 */
import { mapEntryRow, upsertEntry } from '../server/utils/db'

interface Row {
  id: string
  user_id: string
  date: string
  time: string
  text: string
  tags: string
  created_at: string
  updated_at: string
}

/** Minimal in-memory D1 stand-in with real unique-constraint semantics. */
function createFakeDb() {
  const rows = new Map<string, Row>()
  const statements: string[] = []
  const key = (userId: string, date: string, time: string) => `${userId}|${date}|${time}`

  const db = {
    statements,
    prepare(sql: string) {
      statements.push(sql)
      return {
        bind(...args: any[]) {
          return {
            async first(): Promise<Row> {
              // Emulate INSERT ... ON CONFLICT ... RETURNING.
              const [id, userId, date, time, text, tags, createdAt, updatedAt] = args
              const k = key(userId, date, time)
              const existing = rows.get(k)
              if (existing) {
                if (!/ON CONFLICT/i.test(sql)) {
                  throw new Error('UNIQUE constraint failed: entries.user_id, entries.date, entries.time')
                }
                existing.text = text
                existing.tags = tags
                existing.updated_at = updatedAt
                return { ...existing }
              }
              const row: Row = {
                id,
                user_id: userId,
                date,
                time,
                text,
                tags,
                created_at: createdAt,
                updated_at: updatedAt,
              }
              rows.set(k, row)
              return { ...row }
            },
          }
        },
      }
    },
  }
  return db
}

describe('atomic entry upsert', () => {
  const input = { date: '2026-09-10', time: '09:15', text: 'Standup', tags: ['meetings'] }

  it('issues a single INSERT ... ON CONFLICT ... RETURNING statement', async () => {
    const db = createFakeDb()
    const entry = await upsertEntry(db, 'u1', input)

    expect(db.statements).toHaveLength(1)
    expect(db.statements[0]).toMatch(/INSERT INTO entries/i)
    expect(db.statements[0]).toMatch(/ON CONFLICT\s*\(\s*user_id\s*,\s*date\s*,\s*time\s*\)/i)
    expect(db.statements[0]).toMatch(/DO UPDATE SET/i)
    expect(db.statements[0]).toMatch(/RETURNING/i)
    expect(db.statements[0]).not.toMatch(/^\s*SELECT/i)

    expect(entry.id).toBeTruthy()
    expect(entry).toMatchObject({ date: input.date, time: input.time, text: 'Standup', tags: ['meetings'] })
    expect(entry.createdAt).toBe(entry.updatedAt)
  })

  it('rewriting the same quarter keeps the id and createdAt', async () => {
    const db = createFakeDb()
    const first = await upsertEntry(db, 'u1', input)
    const second = await upsertEntry(db, 'u1', { ...input, text: 'Standup + planning', tags: [] })

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.text).toBe('Standup + planning')
    expect(second.tags).toEqual([])
  })

  it('parallel writes to the same quarter both succeed with the same id', async () => {
    const db = createFakeDb()
    const [a, b] = await Promise.all([
      upsertEntry(db, 'u1', input),
      upsertEntry(db, 'u1', { ...input, text: 'Parallel edit' }),
    ])

    expect(a.id).toBe(b.id)
    expect(db.statements).toHaveLength(2)
  })

  it('scopes the conflict key per user', async () => {
    const db = createFakeDb()
    const a = await upsertEntry(db, 'u1', input)
    const b = await upsertEntry(db, 'u2', input)

    expect(a.id).not.toBe(b.id)
  })

  it('mapEntryRow parses stored tag JSON', () => {
    expect(
      mapEntryRow({
        id: 'x',
        user_id: 'u1',
        date: '2026-09-10',
        time: '09:15',
        text: 't',
        tags: '["a","b"]',
        created_at: 'c',
        updated_at: 'u',
      }).tags
    ).toEqual(['a', 'b'])
  })
})
