import { Array as Arr, Match as M, Newtype, Option, Result } from 'effect'
import type { Command } from 'foldkit'

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
import { _count, _elapsedSeconds, _nextId, _particles } from './model'
import type { Model } from './model'
import { _age, _lifespan, _px, _py, _trail, _vx, _vy } from './particle'
import type { Particle } from './particle'
import type { Hue } from './types'
import { Milliseconds, Pixels } from './types'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

const advanceParticle =
  (deltaSeconds: number) =>
  (particle: Particle): Result.Result<Particle, void> =>
    Option.match(Arr.last(particle.trail), {
      onNone: () => Result.failVoid,
      onSome: pos => {
        const nextAge = _age.get(particle) + deltaSeconds * MS_PER_SECOND
        if (nextAge >= _lifespan.get(particle)) return Result.failVoid
        const nextPos = {
          x: Pixels(_px.get(pos) + _vx.get(particle) * deltaSeconds),
          y: Pixels(_py.get(pos) + _vy.get(particle) * deltaSeconds),
        }
        const newTrail = Arr.takeRight(Arr.append(particle.trail, nextPos), TRAIL_LENGTH)
        return Result.succeed(
          _vy.modify(vy => vy + GRAVITY * deltaSeconds)(
            _age.replace(nextAge, _trail.replace(newTrail, particle))
          ),
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
      ClickedDecrement: () => [_count.modify(n => n - 1)(model), directionalBurst(DECREMENT_HUE, DOWN_ANGLE)],
      ClickedIncrement: () => [_count.modify(n => n + 1)(model), directionalBurst(INCREMENT_HUE, UP_ANGLE)],
      ClickedReset:     () => [_particles.replace([], _count.replace(0, model)), radialBurst(RESET_HUE)],
      TickedFrame: ({ deltaTimeMs }) => {
        const deltaSeconds = cappedDelta(deltaTimeMs)
        return [
          _elapsedSeconds.modify(s => s + deltaSeconds)(
            _particles.modify(ps => Arr.filterMap(ps, advanceParticle(deltaSeconds)))(model)
          ),
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
          _nextId.modify(id => id + 1)(_particles.modify(Arr.append(particle))(model)),
          [],
        ]
      },
    }),
  )
