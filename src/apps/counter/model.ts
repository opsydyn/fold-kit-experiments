import { Optic, Schema } from 'effect'

import { Particle } from './particle'
import { Count, CountSchema, ParticleId, ParticleIdSchema, Seconds, SecondsSchema } from './types'
import { countIso, particleIdIso, secondsIso } from './types'

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

// Composed optics: field lens + Newtype iso → arithmetic in number-space
export const _count          = Optic.id<Model>().key('count').compose(countIso)
export const _nextId         = Optic.id<Model>().key('nextId').compose(particleIdIso)
export const _elapsedSeconds = Optic.id<Model>().key('elapsedSeconds').compose(secondsIso)
export const _particles      = Optic.id<Model>().key('particles')
