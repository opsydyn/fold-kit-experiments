import { Array as Arr, Newtype, Option } from 'effect'
import type { Document } from 'foldkit/html'
import { html } from 'foldkit/html'
import { Canvas } from 'foldkit'

import type { Model } from './model'
import { ClickedDecrement, ClickedIncrement, ClickedReset } from './message'
import type { Message } from './message'
import type { Particle } from './particle'
import type { Point } from './particle'
import * as styles from './counter.css'
import {
  ALPHA_EPSILON,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CORE_ALPHA,
  CORE_LIGHTNESS,
  CORE_WIDTH,
  FADE_IN_MS,
  FADE_OUT_MS,
  GLOW_ALPHA,
  GLOW_LIGHTNESS,
  GLOW_WIDTH,
  HEAD_ALPHA,
  HEAD_LIGHTNESS,
  HEAD_RADIUS,
  SATURATION,
} from './constant'

const { div, button, Class, OnClick } = html<Message>()

const fadeAlpha = (particle: Particle): number => {
  const remaining = Newtype.value(particle.lifespanMs) - Newtype.value(particle.ageMs)
  const fadeIn = Math.min(1, Newtype.value(particle.ageMs) / Newtype.value(FADE_IN_MS))
  const fadeOut = Math.min(1, remaining / Newtype.value(FADE_OUT_MS))
  return Math.max(0, Math.min(fadeIn, fadeOut))
}

const trailToInstructions = (
  trail: ReadonlyArray<Point>,
): ReadonlyArray<Canvas.PathInstruction> =>
  Arr.matchLeft(trail, {
    onEmpty: () => [],
    onNonEmpty: (head, tail) => [
      Canvas.MoveTo({ x: Newtype.value(head.x), y: Newtype.value(head.y) }),
      ...Arr.map(tail, p => Canvas.LineTo({ x: Newtype.value(p.x), y: Newtype.value(p.y) })),
    ],
  })

const particleShapes = (particle: Particle): ReadonlyArray<Canvas.Shape> => {
  if (particle.trail.length < 2) return []
  const fade = fadeAlpha(particle)
  if (fade < ALPHA_EPSILON) return []

  const hue = Newtype.value(particle.hue)
  const instructions = trailToInstructions(particle.trail)

  const trailShapes: Canvas.Shape[] = [
    Canvas.Path({
      instructions,
      stroke: `hsla(${hue}, ${SATURATION}%, ${GLOW_LIGHTNESS}%, ${GLOW_ALPHA * fade})`,
      lineWidth: GLOW_WIDTH,
      lineCap: 'Round',
      lineJoin: 'Round',
    }),
    Canvas.Path({
      instructions,
      stroke: `hsla(${hue}, ${SATURATION}%, ${CORE_LIGHTNESS}%, ${CORE_ALPHA * fade})`,
      lineWidth: CORE_WIDTH,
      lineCap: 'Round',
      lineJoin: 'Round',
    }),
  ]

  const maybeHead = Option.map(Arr.last(particle.trail), pos =>
    Canvas.Circle({
      x: Newtype.value(pos.x),
      y: Newtype.value(pos.y),
      radius: HEAD_RADIUS,
      fill: `hsla(${hue}, ${SATURATION}%, ${HEAD_LIGHTNESS}%, ${HEAD_ALPHA * fade})`,
    }),
  )

  return Option.isSome(maybeHead)
    ? [...trailShapes, maybeHead.value]
    : trailShapes
}

const sceneShapes = (model: Model): ReadonlyArray<Canvas.Shape> =>
  Arr.flatMap(model.particles, particleShapes)

export const view = (model: Model): Document => ({
  title: `Counter: ${Newtype.value(model.count)}`,
  body: div(
    [Class(styles.scene)],
    [
      Canvas.view<Message>({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        shapes: sceneShapes(model),
        className: styles.canvas,
      }),
      div(
        [Class(styles.overlay)],
        [
          div([Class(styles.count)], [String(Newtype.value(model.count))]),
          div(
            [Class(styles.controls)],
            [
              button([OnClick(ClickedDecrement()), Class(styles.button)], ['−']),
              button([OnClick(ClickedReset()), Class(styles.button)], ['Reset']),
              button([OnClick(ClickedIncrement()), Class(styles.button)], ['+']),
            ],
          ),
        ],
      ),
    ],
  ),
})
