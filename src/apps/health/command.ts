import { Effect } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientResponse } from 'effect/unstable/http'
import { Command } from 'foldkit'

import { FetchedHealth } from './message'
import { HealthData } from './model'

export const FetchHealth = Command.define('FetchHealth', FetchedHealth)(
  Effect.gen(function* () {
    const response = yield* HttpClient.get('/api/health')
    const data = yield* HttpClientResponse.schemaBodyJson(HealthData)(response)
    return FetchedHealth(data)
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.orDie,
  ),
)
