import { Optic, Schema } from 'effect'

import { HueSchema, MillisecondsSchema, ParticleIdSchema, PixelsPerSecSchema, PixelsSchema } from './types'
import { hueIso, millisecondsIso, pixelsIso, pixelsPerSecIso } from './types'

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

// Composed optics: field lens + Newtype iso → arithmetic in number-space
export const _age      = Optic.id<Particle>().key('ageMs').compose(millisecondsIso)
export const _lifespan = Optic.id<Particle>().key('lifespanMs').compose(millisecondsIso)
export const _vx       = Optic.id<Particle>().key('vx').compose(pixelsPerSecIso)
export const _vy       = Optic.id<Particle>().key('vy').compose(pixelsPerSecIso)
export const _hue      = Optic.id<Particle>().key('hue').compose(hueIso)
export const _trail    = Optic.id<Particle>().key('trail')

export const _px = Optic.id<Point>().key('x').compose(pixelsIso)
export const _py = Optic.id<Point>().key('y').compose(pixelsIso)
