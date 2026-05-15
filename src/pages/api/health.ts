import { DateTime, Duration } from 'effect'
import type { APIRoute } from 'astro'

const startedAt = DateTime.nowUnsafe()

export const GET: APIRoute = () => {
  const now = DateTime.nowUnsafe()
  const uptimeSeconds = Duration.toSeconds(DateTime.distance(startedAt, now))

  return new Response(
    JSON.stringify({
      status: 'ok',
      uptimeSeconds,
      startedAt: DateTime.formatIso(startedAt),
      timestamp: DateTime.formatIso(now),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
