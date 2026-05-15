import { Optic, Schema } from 'effect'

export const HealthData = Schema.Struct({
  status: Schema.String,
  uptimeSeconds: Schema.Number,
  startedAt: Schema.String,
  timestamp: Schema.String,
})
export type HealthData = typeof HealthData.Type

const Loading = Schema.Struct({ _tag: Schema.Literal('Loading') })
const Failed  = Schema.Struct({ _tag: Schema.Literal('Failed'), error: Schema.String })
export const Loaded = Schema.Struct({
  _tag: Schema.Literal('Loaded'),
  data: HealthData,
  elapsedMs: Schema.Number,
  sinceLabel: Schema.String,
})
export type Loaded = typeof Loaded.Type

export const Model = Schema.Union([Loading, Failed, Loaded])
export type Model = typeof Model.Type

export const init: Model = { _tag: 'Loading' }

export const _elapsedMs = Optic.id<Loaded>().key('elapsedMs')
