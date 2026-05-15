import { Newtype } from 'effect'
import { Story } from 'foldkit'
import { describe, expect, test } from 'vitest'

import { SpawnParticle } from './command'
import {
  BURST_COUNT,
  DECREMENT_HUE,
  INCREMENT_HUE,
  RESET_HUE,
  SPAWN_X,
  SPAWN_Y,
} from './constant'
import {
  ClickedDecrement,
  ClickedIncrement,
  ClickedReset,
  SpawnedParticle,
  TickedFrame,
} from './message'
import { init } from './model'
import { update } from './update'
import type { Hue } from './types'
import { Milliseconds, ParticleId, PixelsPerSec } from './types'

const emptyModel = init

const fakeParticle = (hue: Hue) =>
  SpawnedParticle({ x: SPAWN_X, y: SPAWN_Y, vx: PixelsPerSec(0), vy: PixelsPerSec(-100), hue, lifespanMs: Milliseconds(1000) })

const drainSpawns = (hue: Hue) =>
  Story.Command.resolveAll(
    ...Array.from({ length: BURST_COUNT }, () =>
      [SpawnParticle, fakeParticle(hue)] as const,
    ),
  )

describe('update', () => {
  describe('counter', () => {
    test('ClickedIncrement increments count', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedIncrement()),
        drainSpawns(INCREMENT_HUE),
        Story.model(model => {
          expect(model.count).toBe(1)
        }),
      )
    })

    test('ClickedDecrement decrements count', () => {
      Story.story(
        update,
        Story.with({ ...emptyModel, count: 3 }),
        Story.message(ClickedDecrement()),
        drainSpawns(DECREMENT_HUE),
        Story.model(model => {
          expect(model.count).toBe(2)
        }),
      )
    })

    test('ClickedReset resets count to zero', () => {
      Story.story(
        update,
        Story.with({ ...emptyModel, count: 5 }),
        Story.message(ClickedReset()),
        drainSpawns(RESET_HUE),
        Story.model(model => {
          expect(model.count).toBe(0)
        }),
      )
    })

    test('count can go below zero', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedDecrement()),
        drainSpawns(DECREMENT_HUE),
        Story.model(model => {
          expect(model.count).toBe(-1)
        }),
      )
    })
  })

  describe('particle spawning', () => {
    test('ClickedIncrement spawns BURST_COUNT particles', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedIncrement()),
        Story.Command.expectExact(
          ...Array.from({ length: BURST_COUNT }, () => SpawnParticle),
        ),
        drainSpawns(INCREMENT_HUE),
        Story.model(model => {
          expect(model.particles).toHaveLength(BURST_COUNT)
        }),
      )
    })

    test('ClickedDecrement spawns BURST_COUNT particles', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedDecrement()),
        Story.Command.expectExact(
          ...Array.from({ length: BURST_COUNT }, () => SpawnParticle),
        ),
        drainSpawns(DECREMENT_HUE),
        Story.model(model => {
          expect(model.particles).toHaveLength(BURST_COUNT)
        }),
      )
    })

    test('ClickedReset spawns BURST_COUNT particles as scatter', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedReset()),
        Story.Command.expectExact(
          ...Array.from({ length: BURST_COUNT }, () => SpawnParticle),
        ),
        drainSpawns(RESET_HUE),
        Story.model(model => {
          expect(model.particles).toHaveLength(BURST_COUNT)
        }),
      )
    })

    test('SpawnedParticle appends a particle with the correct hue', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedIncrement()),
        Story.Command.resolve(SpawnParticle, fakeParticle(INCREMENT_HUE)),
        Story.model(model => {
          expect(model.particles[0]?.hue).toBe(INCREMENT_HUE)
        }),
        drainSpawns(INCREMENT_HUE),
      )
    })

    test('SpawnedParticle assigns sequential ids', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedIncrement()),
        Story.Command.resolve(SpawnParticle, fakeParticle(INCREMENT_HUE)),
        Story.Command.resolve(SpawnParticle, fakeParticle(INCREMENT_HUE)),
        Story.model(model => {
          expect(model.particles[0]?.id).toBe(0)
          expect(model.particles[1]?.id).toBe(1)
        }),
        drainSpawns(INCREMENT_HUE),
      )
    })

    test('SpawnedParticle initialises trail at spawn position', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(ClickedIncrement()),
        Story.Command.resolve(SpawnParticle, fakeParticle(INCREMENT_HUE)),
        Story.model(model => {
          expect(model.particles[0]?.trail).toHaveLength(1)
          expect(model.particles[0]?.trail[0]).toEqual({ x: SPAWN_X, y: SPAWN_Y })
        }),
        drainSpawns(INCREMENT_HUE),
      )
    })
  })

  describe('particle physics', () => {
    const aParticle = {
      id: ParticleId(0),
      trail: [{ x: SPAWN_X, y: SPAWN_Y }],
      hue: INCREMENT_HUE,
      ageMs: Milliseconds(0),
      lifespanMs: Milliseconds(1000),
      vx: PixelsPerSec(0),
      vy: PixelsPerSec(-200),
    }

    const modelWithParticle = { ...emptyModel, nextId: ParticleId(1), particles: [aParticle] }

    test('TickedFrame advances particle age by delta', () => {
      Story.story(
        update,
        Story.with(modelWithParticle),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          expect(model.particles[0]?.ageMs).toBe(16)
        }),
      )
    })

    test('TickedFrame appends a trail point', () => {
      Story.story(
        update,
        Story.with(modelWithParticle),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          expect(model.particles[0]?.trail).toHaveLength(2)
        }),
      )
    })

    test('TickedFrame moves particle upward when vy is negative', () => {
      Story.story(
        update,
        Story.with(modelWithParticle),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          const tip = model.particles[0]?.trail[1]
          expect(tip?.y).toBeLessThan(Newtype.value(SPAWN_Y))
        }),
      )
    })

    test('TickedFrame applies gravity (vy increases toward positive)', () => {
      Story.story(
        update,
        Story.with(modelWithParticle),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          expect(model.particles[0]?.vy).toBeGreaterThan(Newtype.value(aParticle.vy))
        }),
      )
    })

    test('TickedFrame advances elapsedSeconds', () => {
      Story.story(
        update,
        Story.with(emptyModel),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          expect(Newtype.value(model.elapsedSeconds)).toBeCloseTo(0.016)
        }),
      )
    })

    test('TickedFrame removes particles that have expired', () => {
      Story.story(
        update,
        Story.with({ ...modelWithParticle, particles: [{ ...aParticle, ageMs: Milliseconds(990) }] }),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.model(model => {
          expect(model.particles).toHaveLength(0)
        }),
      )
    })

    test('TickedFrame emits no commands', () => {
      Story.story(
        update,
        Story.with(modelWithParticle),
        Story.message(TickedFrame({ deltaTimeMs: Milliseconds(16) })),
        Story.Command.expectNone(),
      )
    })
  })

  describe('ClickedReset', () => {
    test('clears existing particles before spawning new ones', () => {
      Story.story(
        update,
        Story.with({ ...emptyModel, count: 3, particles: [
          { id: ParticleId(0), trail: [{ x: SPAWN_X, y: SPAWN_Y }], hue: INCREMENT_HUE, ageMs: Milliseconds(200), lifespanMs: Milliseconds(1000), vx: PixelsPerSec(0), vy: PixelsPerSec(-100) },
        ] }),
        Story.message(ClickedReset()),
        Story.model(model => {
          expect(model.count).toBe(0)
          expect(model.particles).toHaveLength(0)
        }),
        drainSpawns(RESET_HUE),
      )
    })
  })
})
