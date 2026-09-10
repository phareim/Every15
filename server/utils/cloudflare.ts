// Vendored from reader/server/utils/cloudflare.ts (D1 only),
// extended with the app's own EVERY15_DB binding. DB stays the read-only
// Reader session database; EVERY15_DB holds this app's entries/settings.
import { createError } from 'h3'

type CloudflareEnv = {
  DB?: any
  EVERY15_DB?: any
}

export const getD1 = (event: any) => {
  const env = event?.context?.cloudflare?.env as CloudflareEnv | undefined
  if (!env?.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 database binding (DB) is not configured.',
    })
  }
  return env.DB
}

export const getEvery15Db = (event: any) => {
  const env = event?.context?.cloudflare?.env as CloudflareEnv | undefined
  if (!env?.EVERY15_DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 database binding (EVERY15_DB) is not configured.',
    })
  }
  return env.EVERY15_DB
}
