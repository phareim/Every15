/**
 * CSV export helpers. Pure — no imports, no I/O.
 *
 * Two protections, both deliberate:
 * 1. Standard CSV escaping (double the quotes, wrap fields containing
 *    comma/quote/newline).
 * 2. Spreadsheet formula-injection guard: a cell starting with =, +, -,
 *    @, tab or carriage return gets a leading single quote so Excel/Sheets
 *    never evaluate entry text as a formula.
 */
import type { Entry } from './types'

const FORMULA_LEAD = /^[=+\-@\t\r]/

export function escapeCsvCell(value: string): string {
  let cell = value
  if (FORMULA_LEAD.test(cell)) cell = `'${cell}`
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

export function entriesToCsv(entries: Entry[]): string {
  const header = 'id,date,time,text,tags,createdAt,updatedAt'
  const rows = entries.map((e) =>
    [
      escapeCsvCell(e.id),
      escapeCsvCell(e.date),
      escapeCsvCell(e.time),
      escapeCsvCell(e.text),
      escapeCsvCell(e.tags.join(';')),
      escapeCsvCell(e.createdAt),
      escapeCsvCell(e.updatedAt),
    ].join(',')
  )
  return [header, ...rows].join('\n') + '\n'
}
