import type { Html } from '@effect/ui/html';
import { Newtype } from 'effect';

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
import { Message } from './message';
import type { Model } from './model';
import { _count } from './model';
import type { Particle } from './particle';
import { _age, _hue, _lifespan, _px, _py } from './particle';

import * as styles from './counter.css';

const fadeAlpha = (particle: Particle): number => {
  const remaining = _lifespan.get(particle) - _age.get(particle);
  const fadeIn = Math.min(1, _age.get(particle) / Newtype.value(FADE_IN_MS));
  const fadeOut = Math.min(1, remaining / Newtype.value(FADE_OUT_MS));
  return Math.max(0, Math.min(fadeIn, fadeOut));
};

const particleView = (h: Html.H<Message>, particle: Particle) => {
  const head = particle.trail.at(-1);
  const fade = fadeAlpha(particle);
  if (head === undefined || particle.trail.length < 2 || fade < ALPHA_EPSILON) return undefined;
  const hue = _hue.get(particle);
  const path = particle.trail
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${_px.get(point)},${_py.get(point)}`)
    .join(' ');
  const stroke = (lightness: number, alpha: number, width: number) =>
    h.el('path').attrs({
      d: path,
      fill: 'none',
      stroke: `hsla(${hue}, ${SATURATION}%, ${lightness}%, ${alpha * fade})`,
      'stroke-width': String(width),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });

  return h
    .el('g')
    .key(String(Newtype.value(particle.id)))
    .children(
      stroke(GLOW_LIGHTNESS, GLOW_ALPHA, GLOW_WIDTH),
      stroke(CORE_LIGHTNESS, CORE_ALPHA, CORE_WIDTH),
      h.el('circle').attrs({
        cx: String(_px.get(head)),
        cy: String(_py.get(head)),
        r: String(HEAD_RADIUS),
        fill: `hsla(${hue}, ${SATURATION}%, ${HEAD_LIGHTNESS}%, ${HEAD_ALPHA * fade})`,
      }),
    );
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class(styles.scene).children(
    h
      .el('svg')
      .attrs({
        class: styles.canvas,
        viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      })
      .children(model.particles.map((particle) => particleView(h, particle))),
    h.div
      .class(styles.overlay)
      .children(
        h.output.class(styles.count).children(String(_count.get(model))),
        h.div
          .class(styles.controls)
          .children(
            h.button
              .class(styles.button)
              .attr('type', 'button')
              .on('click', Message.ClickedDecrement())
              .children('−'),
            h.button
              .class(styles.button)
              .attr('type', 'button')
              .on('click', Message.ClickedReset())
              .children('Reset'),
            h.button
              .class(styles.button)
              .attr('type', 'button')
              .on('click', Message.ClickedIncrement())
              .children('+'),
          ),
      ),
  );
