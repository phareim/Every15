/**
 * This app's own D1 binding. Kept separate so server/utils/cloudflare.ts
 * stays byte-identical with the vendored Reader helper in do-web.
 */
import { createError } from 'h3'

export const getEvery15Db = (event: any) => {
  const env = event?.context?.cloudflare?.env as { EVERY15_DB?: any } | undefined
  if (!env?.EVERY15_DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 database binding (EVERY15_DB) is not configured.',
    })
  }
  return env.EVERY15_DB
}
