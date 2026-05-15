import { Array as Arr, Match as M, Newtype, Option, Result } from 'effect'
import type { Command } from 'foldkit'
import { evo } from 'foldkit/struct'

import { SpawnParticle } from './command'
import {
  BURST_COUNT,
  DECREMENT_HUE,
  DELTA_SECONDS_CAP,
  DOWN_ANGLE,
  GRAVITY,
  INCREMENT_HUE,
  MS_PER_SECOND,
  RESET_HUE,
  SPAWN_X,
  SPAWN_Y,
  TRAIL_LENGTH,
  TWO_PI,
  UP_ANGLE,
} from './constant'
import type { Message } from './message'
import type { Model } from './model'
import type { Particle } from './particle'
import type { Hue } from './types'
import { Count, Milliseconds, ParticleId, Pixels, PixelsPerSec, Seconds } from './types'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

const advanceParticle =
  (deltaSeconds: number) =>
  (particle: Particle): Result.Result<Particle, void> =>
    Option.match(Arr.last(particle.trail), {
      onNone: () => Result.failVoid,
      onSome: pos => {
        const nextAgeMs = Milliseconds(Newtype.value(particle.ageMs) + deltaSeconds * MS_PER_SECOND)
        if (Newtype.value(nextAgeMs) >= Newtype.value(particle.lifespanMs)) return Result.failVoid
        const nextX = Pixels(Newtype.value(pos.x) + Newtype.value(particle.vx) * deltaSeconds)
        const nextY = Pixels(Newtype.value(pos.y) + Newtype.value(particle.vy) * deltaSeconds)
        const nextVy = PixelsPerSec(Newtype.value(particle.vy) + GRAVITY * deltaSeconds)
        const appended = Arr.append(particle.trail, { x: nextX, y: nextY })
        return Result.succeed(
          evo(particle, {
            trail: () => Arr.takeRight(appended, TRAIL_LENGTH),
            ageMs: () => nextAgeMs,
            vy: () => nextVy,
          }),
        )
      },
    })

const cappedDelta = (deltaTimeMs: Milliseconds): number =>
  Math.min(Newtype.value(deltaTimeMs) / MS_PER_SECOND, DELTA_SECONDS_CAP)

const directionalBurst = (
  hue: Hue,
  angleBase: number,
): ReadonlyArray<Command.Command<Message>> =>
  Arr.makeBy(BURST_COUNT, () =>
    SpawnParticle({ x: SPAWN_X, y: SPAWN_Y, hue, angleBase }),
  )

const radialBurst = (hue: Hue): ReadonlyArray<Command.Command<Message>> =>
  Arr.makeBy(BURST_COUNT, i =>
    SpawnParticle({
      x: SPAWN_X,
      y: SPAWN_Y,
      hue,
      angleBase: (i / BURST_COUNT) * TWO_PI,
    }),
  )

export const update = (model: Model, message: Message): Return =>
  M.value(message).pipe(
    M.withReturnType<Return>(),
    M.tagsExhaustive({
      ClickedDecrement: () => [
        evo(model, { count: c => Count(Newtype.value(c) - 1) }),
        directionalBurst(DECREMENT_HUE, DOWN_ANGLE),
      ],
      ClickedIncrement: () => [
        evo(model, { count: c => Count(Newtype.value(c) + 1) }),
        directionalBurst(INCREMENT_HUE, UP_ANGLE),
      ],
      ClickedReset: () => [
        evo(model, { count: () => Count(0), particles: () => [] }),
        radialBurst(RESET_HUE),
      ],
      TickedFrame: ({ deltaTimeMs }) => {
        const deltaSeconds = cappedDelta(deltaTimeMs)
        return [
          evo(model, {
            particles: ps => Arr.filterMap(ps, advanceParticle(deltaSeconds)),
            elapsedSeconds: s => Seconds(Newtype.value(s) + deltaSeconds),
          }),
          [],
        ]
      },
      SpawnedParticle: ({ x, y, vx, vy, hue, lifespanMs }) => {
        const particle: Particle = {
          id: model.nextId,
          trail: [{ x, y }],
          hue,
          ageMs: Milliseconds(0),
          lifespanMs,
          vx,
          vy,
        }
        return [
          evo(model, {
            particles: Arr.append(particle),
            nextId: id => ParticleId(Newtype.value(id) + 1),
          }),
          [],
        ]
      },
    }),
  )
