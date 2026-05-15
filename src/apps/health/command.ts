import { Effect } from 'effect'
import { Command } from 'foldkit'

import { FetchedHealth } from './message'

export const FetchHealth = Command.define('FetchHealth', FetchedHealth)(
  Effect.gen(function* () {
    const res = yield* Effect.promise(() => fetch('/api/health'))
    const data = yield* Effect.promise(() => res.json() as Promise<{
      status: string
      uptimeSeconds: number
      startedAt: string
      timestamp: string
    }>)
    return FetchedHealth(data)
  }),
)
