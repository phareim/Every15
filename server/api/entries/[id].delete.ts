import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/cloudflare'
import { deleteEntry } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Entry id is required.' })
  }
  const deleted = await deleteEntry(getEvery15Db(event), user.id, id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found.' })
  }
  return { ok: true }
})
