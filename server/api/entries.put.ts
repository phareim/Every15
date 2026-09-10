import { requireAllowedUser } from '~/server/utils/readerSession'
import { getEvery15Db } from '~/server/utils/cloudflare'
import { upsertEntry } from '~/server/utils/db'
import { validateEntryInput } from '~/shared/validation'

export default defineEventHandler(async (event) => {
  const user = await requireAllowedUser(event)
  const input = validateEntryInput(await readBody(event))
  const entry = await upsertEntry(getEvery15Db(event), user.id, input)
  return { entry }
})
