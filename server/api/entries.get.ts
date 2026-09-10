import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/every15Db'
import { listEntries } from '~/server/utils/db'
import { validateDateRange } from '~/shared/validation'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const { from, to } = validateDateRange(getQuery(event) as Record<string, unknown>)
  const entries = await listEntries(getEvery15Db(event), user.id, from, to)
  return { entries }
})
