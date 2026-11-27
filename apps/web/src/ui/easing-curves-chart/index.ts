import { UiSchema } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import {
  easeBackOut,
  easeBounceOut,
  easeCubicOut,
  easeElasticOut,
  easeLinear,
  easeSinOut,
} from '@opsydyn/foldkit-viz/math/ease';
import { Option, Schema } from 'effect';

import { svgRoot } from '../shared';

// MODEL

export type CurveEntry = Readonly<{
  name: string;
  fn: (t: number) => number;
  color: string;
}>;

const CURVES: ReadonlyArray<CurveEntry> = [
  { name: 'linear', fn: easeLinear, color: '#94a3b8' },
  { name: 'sinOut', fn: easeSinOut, color: '#6366f1' },
  { name: 'cubicOut', fn: easeCubicOut, color: '#f59e0b' },
  { name: 'backOut', fn: easeBackOut, color: '#10b981' },
  { name: 'elasticOut', fn: easeElasticOut, color: '#ef4444' },
  { name: 'bounceOut', fn: easeBounceOut, color: '#8b5cf6' },
];

export const Model = Schema.Struct({ hovered: Schema.Option(Schema.String) });
export type Model = typeof Model.Type;

export const init: Model = { hovered: Option.none() };

export const Message = UiSchema.TaggedEnum({
  HoveredCurve: { name: Schema.String },
  BlurredCurve: {},
});
export type Message = typeof Message.Type;

export const update = (_model: Model, message: Message): Model =>
  Message.match(message, {
    HoveredCurve: ({ name }) => ({ hovered: Option.some(name) }),
    BlurredCurve: () => init,
  });

// VIEW

const W = 400;
const H = 290;
const MT = 16;
const MR = 16;
const MB = 64;
const ML = 32;
const PW = W - ML - MR;
const PH = H - MT - MB;

const STEPS = 120;
const Y_MIN = -0.3;
const Y_MAX = 1.45;

function curvePoints(fn: (t: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const y = fn(t);
    const px = (t * PW).toFixed(1);
    const py = (PH - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * PH).toFixed(1);
    pts.push(`${i === 0 ? 'M' : 'L'}${px},${py}`);
  }
  return pts.join('');
}

// Pre-compute all paths (static data, so done once at module level)
const CURVE_PATHS: ReadonlyArray<{ name: string; color: string; d: string }> = CURVES.map((c) => ({
  name: c.name,
  color: c.color,
  d: curvePoints(c.fn),
}));

const Y_ZERO = PH - ((0 - Y_MIN) / (Y_MAX - Y_MIN)) * PH;
const Y_ONE = PH - ((1 - Y_MIN) / (Y_MAX - Y_MIN)) * PH;

export function view(h: Html.H<Message>, model: Model, ariaLabel: string) {
  const active = Option.getOrNull(model.hovered);
  const grid = [
    [Y_ZERO, '0'],
    [Y_ONE, '1'],
  ] as const;
  const paths = CURVE_PATHS.map(({ name, color, d }) =>
    h
      .el('path')
      .key(name)
      .attrs({
        d,
        fill: 'none',
        stroke: color,
        'stroke-width': name === active ? '2.5' : '1.5',
        opacity: active !== null && name !== active ? '0.15' : '1',
        style: 'transition:opacity 80ms,stroke-width 80ms',
      }),
  );
  const legend = CURVE_PATHS.map(({ name, color }, index) => {
    const isInactive = active !== null && name !== active;
    return h
      .el('g')
      .key(name)
      .attrs({
        transform: `translate(${(index % 3) * 112},${Math.floor(index / 3) * 18})`,
        style: 'cursor:default',
      })
      .on('mouseenter', Message.HoveredCurve({ name }))
      .on('mouseleave', Message.BlurredCurve())
      .children(
        h.el('line').attrs({
          x1: '0',
          y1: '-4',
          x2: '16',
          y2: '-4',
          stroke: color,
          'stroke-width': '2',
          opacity: isInactive ? '0.25' : '1',
        }),
        h
          .el('text')
          .attrs({
            x: '20',
            y: '0',
            'font-size': '0.6rem',
            'font-weight': name === active ? '600' : '400',
            fill: isInactive ? 'var(--chart-label-muted,#555)' : 'var(--chart-label,#888)',
            style: 'transition:fill 80ms',
          })
          .children(name),
      );
  });
  return svgRoot(h, { width: W, height: H, ariaLabel }, [
    h
      .el('g')
      .attr('transform', `translate(${ML},${MT})`)
      .children(
        grid.map(([y, label]) =>
          h
            .el('g')
            .key(label)
            .children(
              h.el('line').attrs({
                x1: '0',
                y1: y.toFixed(1),
                x2: String(PW),
                y2: y.toFixed(1),
                stroke: 'var(--chart-grid,#2d2d2d)',
                'stroke-width': '1',
              }),
              h
                .el('text')
                .attrs({
                  x: '-4',
                  y: y.toFixed(1),
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.55rem',
                  fill: '#94a3b8',
                })
                .children(label),
            ),
        ),
        h.el('g').children(paths),
        h
          .el('g')
          .attr('transform', `translate(0,${PH + 18})`)
          .children(legend),
      ),
  ]);
}
