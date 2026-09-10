import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/cloudflare'
import { getSettings } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const settings = await getSettings(getEvery15Db(event), user.id)
  return { settings }
})
