import { Schema } from 'effect'

import { Particle } from './particle'
import { Count, CountSchema, ParticleId, ParticleIdSchema, Seconds, SecondsSchema } from './types'

export const Model = Schema.Struct({
  count: CountSchema,
  particles: Schema.Array(Particle),
  nextId: ParticleIdSchema,
  elapsedSeconds: SecondsSchema,
})
export type Model = typeof Model.Type

export const init: Model = {
  count: Count(0),
  particles: [],
  nextId: ParticleId(0),
  elapsedSeconds: Seconds(0),
}
