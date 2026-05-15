import { Effect, Newtype, Random, Schema } from 'effect'
import { Command } from 'foldkit'

import {
  HUE_JITTER,
  LIFESPAN_MAX_MS,
  LIFESPAN_MIN_MS,
  SPEED_MAX,
  SPEED_MIN,
  SPREAD,
} from './constant'
import { SpawnedParticle } from './message'
import { Hue, HueSchema, Milliseconds, PixelsPerSec, PixelsSchema } from './types'

export const SpawnParticle = Command.define(
  'SpawnParticle',
  { x: PixelsSchema, y: PixelsSchema, hue: HueSchema, angleBase: Schema.Number },
  SpawnedParticle,
)(({ x, y, hue, angleBase }) =>
  Effect.gen(function* () {
    const jitter = yield* Random.nextBetween(-SPREAD, SPREAD)
    const angle = angleBase + jitter
    const speed = yield* Random.nextBetween(Newtype.value(SPEED_MIN), Newtype.value(SPEED_MAX))
    const lifespanMs = yield* Random.nextBetween(Newtype.value(LIFESPAN_MIN_MS), Newtype.value(LIFESPAN_MAX_MS))
    const hueJitter = yield* Random.nextBetween(-HUE_JITTER, HUE_JITTER)
    return SpawnedParticle({
      x,
      y,
      vx: PixelsPerSec(Math.cos(angle) * speed),
      vy: PixelsPerSec(Math.sin(angle) * speed),
      hue: Hue(((Newtype.value(hue) + hueJitter) % 360 + 360) % 360),
      lifespanMs: Milliseconds(lifespanMs),
    })
  }),
)
