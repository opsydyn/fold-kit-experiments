import type { Html } from '@effect/ui/html';

import { gradientStops, validateDotPattern, validateHatch } from '../svg/paint-validation.js';
import type { GradientOptions, PatternOptions } from '../svg/paint-validation.js';

export type { GradientOptions, GradientStop, PatternOptions } from '../svg/paint-validation.js';

function stops<M>(h: Html.H<M>, options: GradientOptions) {
  return gradientStops(options).map(({ offset, colour, opacity }) =>
    h.el('stop').attrs({
      offset: String(offset),
      'stop-color': colour,
      'stop-opacity': String(opacity),
    }),
  );
}

/** Paint identifiers are caller-owned and unique across the containing page. */
export function dotPattern<M>(
  h: Html.H<M>,
  { id, colour, spacing, radius = 1 }: PatternOptions & Readonly<{ radius?: number }>,
) {
  validateDotPattern(id, spacing, radius);
  return h
    .el('pattern')
    .attrs({
      id,
      patternUnits: 'userSpaceOnUse',
      width: String(spacing),
      height: String(spacing),
    })
    .children(
      h.el('circle').attrs({
        cx: String(spacing / 2),
        cy: String(spacing / 2),
        r: String(radius),
        fill: colour,
      }),
    );
}

export function hatchPattern<M>(
  h: Html.H<M>,
  {
    id,
    colour,
    spacing,
    strokeWidth = 1,
    angle = 45,
  }: PatternOptions & Readonly<{ strokeWidth?: number; angle?: number }>,
) {
  validateHatch(id, spacing, strokeWidth, angle);
  return h
    .el('pattern')
    .attrs({
      id,
      patternUnits: 'userSpaceOnUse',
      width: String(spacing),
      height: String(spacing),
      patternTransform: `rotate(${angle})`,
    })
    .children(
      h.el('line').attrs({
        x1: '0',
        x2: '0',
        y1: '0',
        y2: String(spacing),
        stroke: colour,
        'stroke-width': String(strokeWidth),
      }),
    );
}

export function linearGradient<M>(
  h: Html.H<M>,
  options: GradientOptions & Readonly<{ x1?: string; y1?: string; x2?: string; y2?: string }>,
) {
  const { id, x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%' } = options;
  return h.el('linearGradient').attrs({ id, x1, y1, x2, y2 }).children(stops(h, options));
}

export function radialGradient<M>(
  h: Html.H<M>,
  options: GradientOptions & Readonly<{ cx?: string; cy?: string; radius?: string }>,
) {
  const { id, cx = '50%', cy = '50%', radius = '50%' } = options;
  return h.el('radialGradient').attrs({ id, cx, cy, r: radius }).children(stops(h, options));
}
