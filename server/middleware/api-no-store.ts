/**
 * API responses are per-user private data — never let a cache store them.
 */
export default defineEventHandler((event) => {
  if (event.path.startsWith('/api/')) {
    setHeader(event, 'Cache-Control', 'private, no-store')
  }
})
