import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/cloudflare'
import { listEntries } from '~/server/utils/db'
import { entriesToCsv } from '~/shared/csv'
import { badRequest, validateDateRange } from '~/shared/validation'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const query = getQuery(event) as Record<string, unknown>
  const { from, to } = validateDateRange(query)
  if (query.format !== 'csv' && query.format !== 'json') {
    throw badRequest('format must be csv or json.')
  }

  const entries = await listEntries(getEvery15Db(event), user.id, from, to)
  const filename = `every15-${from}-${to}.${query.format}`
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  if (query.format === 'csv') {
    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    return entriesToCsv(entries)
  }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { entries }
})
