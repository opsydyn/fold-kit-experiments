import { Scene } from 'foldkit'
import { describe, test } from 'vitest'

import { SpawnParticle } from './command'
import { BURST_COUNT, DECREMENT_HUE, INCREMENT_HUE, RESET_HUE } from './constant'
import { SpawnedParticle } from './message'
import { init } from './model'
import { update } from './update'
import { view } from './view'
import type { Hue } from './types'
import { Milliseconds, Pixels, PixelsPerSec } from './types'

const emptyModel = init

const drainSpawns = (hue: Hue) =>
  Scene.Command.resolveAll(
    ...Array.from({ length: BURST_COUNT }, () =>
      [SpawnParticle, SpawnedParticle({ x: Pixels(400), y: Pixels(330), vx: PixelsPerSec(0), vy: PixelsPerSec(-100), hue, lifespanMs: Milliseconds(1000) })] as const,
    ),
  )

const incrementButton = Scene.role('button', { name: '+'  })
const decrementButton = Scene.role('button', { name: '−' })
const resetButton     = Scene.role('button', { name: 'Reset' })

describe('scene', () => {
  test('renders the initial count', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.expect(Scene.text('0')).toExist(),
    )
  })

  test('renders all three buttons', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.expect(incrementButton).toExist(),
      Scene.expect(decrementButton).toExist(),
      Scene.expect(resetButton).toExist(),
    )
  })

  test('clicking + increments the displayed count', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.click(incrementButton),
      drainSpawns(INCREMENT_HUE),
      Scene.expect(Scene.text('1')).toExist(),
    )
  })

  test('clicking − decrements the displayed count', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...emptyModel, count: 3 }),
      Scene.click(decrementButton),
      drainSpawns(DECREMENT_HUE),
      Scene.expect(Scene.text('2')).toExist(),
    )
  })

  test('clicking Reset resets count to 0', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...emptyModel, count: 5 }),
      Scene.click(resetButton),
      drainSpawns(RESET_HUE),
      Scene.expect(Scene.text('0')).toExist(),
    )
  })

  test('clicking + twice shows count of 2', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.click(incrementButton),
      drainSpawns(INCREMENT_HUE),
      Scene.click(incrementButton),
      drainSpawns(INCREMENT_HUE),
      Scene.expect(Scene.text('2')).toExist(),
    )
  })

  test('count goes below zero on decrement from 0', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.click(decrementButton),
      drainSpawns(DECREMENT_HUE),
      Scene.expect(Scene.text('-1')).toExist(),
    )
  })

  test('Reset after increment shows 0', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.click(incrementButton),
      drainSpawns(INCREMENT_HUE),
      Scene.click(resetButton),
      drainSpawns(RESET_HUE),
      Scene.expect(Scene.text('0')).toExist(),
    )
  })
})
