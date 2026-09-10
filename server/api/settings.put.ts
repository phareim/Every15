import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/cloudflare'
import { saveSettings } from '~/server/utils/db'
import { validateSettings } from '~/shared/validation'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const settings = validateSettings(await readBody(event))
  await saveSettings(getEvery15Db(event), user.id, settings)
  return { settings }
})
