import { Schema } from 'effect'

export const HealthData = Schema.Struct({
  status: Schema.String,
  uptimeSeconds: Schema.Number,
  startedAt: Schema.String,
  timestamp: Schema.String,
})
export type HealthData = typeof HealthData.Type

export const Model = Schema.Struct({
  loading: Schema.Boolean,
  data: Schema.NullOr(HealthData),
  elapsedMs: Schema.Number,
})
export type Model = typeof Model.Type

export const init: Model = { loading: true, data: null, elapsedMs: 0 }
