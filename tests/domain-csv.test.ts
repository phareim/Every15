import { entriesToCsv, escapeCsvCell } from '../shared/csv'
import type { Entry } from '../shared/types'

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'abc-123',
  date: '2026-09-10',
  time: '09:15',
  text: 'Deep work on the report',
  tags: ['writing', 'focus'],
  createdAt: '2026-09-10T07:15:00.000Z',
  updatedAt: '2026-09-10T07:15:00.000Z',
  ...overrides,
})

describe('escapeCsvCell', () => {
  it('leaves plain cells untouched', () => {
    expect(escapeCsvCell('standup')).toBe('standup')
    expect(escapeCsvCell('09:15')).toBe('09:15')
  })

  it('quotes cells with commas, quotes, or newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('neutralizes spreadsheet formula injection', () => {
    // A leading single quote forces Sheets/Excel to treat the cell as text.
    for (const lead of ['=', '+', '-', '@']) {
      const out = escapeCsvCell(`${lead}2+2`)
      expect(out.startsWith("'")).toBe(true)
    }
    // The guard quote stays inside the CSV quoting: still text, never a formula.
    expect(escapeCsvCell('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`
    )
  })
})

describe('entriesToCsv', () => {
  it('emits a header plus one row per entry', () => {
    const csv = entriesToCsv([entry(), entry({ id: 'def-456', time: '09:30', text: 'Email' })])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,date,time,text,tags,createdAt,updatedAt')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('abc-123,2026-09-10,09:15')
    expect(lines[2]).toContain('def-456,2026-09-10,09:30,Email')
  })

  it('joins tags with semicolons and ends with a newline', () => {
    const csv = entriesToCsv([entry()])
    expect(csv).toContain('writing;focus')
    expect(csv.endsWith('\n')).toBe(true)
  })

  it('emits only the header for an empty export', () => {
    expect(entriesToCsv([])).toBe('id,date,time,text,tags,createdAt,updatedAt\n')
  })
})
