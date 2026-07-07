import { Array as Arr, Newtype, Option } from 'effect';
import { Canvas } from 'foldkit';
import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

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
} from './constant';
import type { Message } from './message';
import { ClickedDecrement, ClickedIncrement, ClickedReset } from './message';
import type { Model } from './model';
import { _count } from './model';
import type { Particle, Point } from './particle';
import { _age, _hue, _lifespan, _px, _py } from './particle';

import * as styles from './counter.css';

const { div, button, Class, OnClick } = html<Message>();

const fadeAlpha = (particle: Particle): number => {
  const remaining = _lifespan.get(particle) - _age.get(particle);
  const fadeIn = Math.min(1, _age.get(particle) / Newtype.value(FADE_IN_MS));
  const fadeOut = Math.min(1, remaining / Newtype.value(FADE_OUT_MS));
  return Math.max(0, Math.min(fadeIn, fadeOut));
};

const trailToInstructions = (trail: ReadonlyArray<Point>): ReadonlyArray<Canvas.PathInstruction> =>
  Arr.matchLeft(trail, {
    onEmpty: () => [],
    onNonEmpty: (head, tail) => [
      Canvas.MoveTo({ x: _px.get(head), y: _py.get(head) }),
      ...Arr.map(tail, (p) => Canvas.LineTo({ x: _px.get(p), y: _py.get(p) })),
    ],
  });

const particleShapes = (particle: Particle): ReadonlyArray<Canvas.Shape> => {
  if (particle.trail.length < 2) return [];
  const fade = fadeAlpha(particle);
  if (fade < ALPHA_EPSILON) return [];

  const hue = _hue.get(particle);
  const instructions = trailToInstructions(particle.trail);

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
  ];

  const maybeHead = Option.map(Arr.last(particle.trail), (pos) =>
    Canvas.Circle({
      x: _px.get(pos),
      y: _py.get(pos),
      radius: HEAD_RADIUS,
      fill: `hsla(${hue}, ${SATURATION}%, ${HEAD_LIGHTNESS}%, ${HEAD_ALPHA * fade})`,
    }),
  );

  return Option.isSome(maybeHead) ? [...trailShapes, maybeHead.value] : trailShapes;
};

const sceneShapes = (model: Model): ReadonlyArray<Canvas.Shape> =>
  Arr.flatMap(model.particles, particleShapes);

export const view = (model: Model): Document => ({
  title: `Counter: ${_count.get(model)}`,
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
          div([Class(styles.count)], [String(_count.get(model))]),
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
});
