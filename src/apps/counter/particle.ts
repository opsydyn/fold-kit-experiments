import { Schema } from 'effect'

import { HueSchema, MillisecondsSchema, ParticleIdSchema, PixelsPerSecSchema, PixelsSchema } from './types'

export const Point = Schema.Struct({ x: PixelsSchema, y: PixelsSchema })
export type Point = typeof Point.Type

export const Particle = Schema.Struct({
  id: ParticleIdSchema,
  trail: Schema.Array(Point),
  hue: HueSchema,
  ageMs: MillisecondsSchema,
  lifespanMs: MillisecondsSchema,
  vx: PixelsPerSecSchema,
  vy: PixelsPerSecSchema,
})
export type Particle = typeof Particle.Type
