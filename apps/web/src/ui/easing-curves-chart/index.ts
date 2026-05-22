import {
  easeBackOut,
  easeBounceOut,
  easeCubicOut,
  easeElasticOut,
  easeLinear,
  easeSinOut,
} from '@opsydyn/foldkit-viz/math/ease';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

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

export type Model = Readonly<{
  curves: ReadonlyArray<CurveEntry>;
  hovered: Option.Option<string>;
}>;

export function init(): readonly [Model, readonly []] {
  return [{ curves: CURVES, hovered: Option.none() }, []];
}

// MESSAGE

export const HoveredCurve = m('HoveredCurve', { name: Schema.String });
export const BlurredCurve = m('BlurredCurve', {});

export const Message = Schema.Union([HoveredCurve, BlurredCurve]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCurve: ({ name }) => [{ ...model, hovered: Option.some(name) }, []],
      BlurredCurve: () => [{ ...model, hovered: Option.none() }, []],
    }),
  );

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
const CURVE_PATHS: ReadonlyArray<{ name: string; color: string; d: string }> = CURVES.map(
  (c) => ({ name: c.name, color: c.color, d: curvePoints(c.fn) }),
);

const Y_ZERO = PH - ((0 - Y_MIN) / (Y_MAX - Y_MIN)) * PH;
const Y_ONE = PH - ((1 - Y_MIN) / (Y_MAX - Y_MIN)) * PH;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Easing curves comparison' } = config;
  const { hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;

  return h.svg(
    [
      h.ViewBox(`0 0 ${W} ${H}`),
      h.Width('100%'),
      h.Role('img'),
      h.AriaLabel(ariaLabel),
      h.Style({ display: 'block', 'font-family': 'inherit' }),
    ],
    [
      h.g(
        [h.Transform(`translate(${ML},${MT})`)],
        [
          // Grid lines at y=0 and y=1
          h.line(
            [
              h.X1('0'),
              h.Y1(String(Y_ZERO.toFixed(1))),
              h.X2(String(PW)),
              h.Y2(String(Y_ZERO.toFixed(1))),
              h.Stroke('#e2e8f0'),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.line(
            [
              h.X1('0'),
              h.Y1(String(Y_ONE.toFixed(1))),
              h.X2(String(PW)),
              h.Y2(String(Y_ONE.toFixed(1))),
              h.Stroke('#e2e8f0'),
              h.StrokeWidth('1'),
            ],
            [],
          ),

          // Axis labels
          h.text(
            [
              h.X('-4'),
              h.Y(String(Y_ZERO.toFixed(1))),
              h.Style({
                'text-anchor': 'end',
                'dominant-baseline': 'middle',
                'font-size': '0.55rem',
                fill: '#94a3b8',
              }),
            ],
            ['0'],
          ),
          h.text(
            [
              h.X('-4'),
              h.Y(String(Y_ONE.toFixed(1))),
              h.Style({
                'text-anchor': 'end',
                'dominant-baseline': 'middle',
                'font-size': '0.55rem',
                fill: '#94a3b8',
              }),
            ],
            ['1'],
          ),

          // Easing curves
          h.g(
            [],
            CURVE_PATHS.map(({ name, color, d }) => {
              const isActive = name === active;
              const isInactive = active !== null && !isActive;
              return h.path(
                [
                  h.D(d),
                  h.Fill('none'),
                  h.Stroke(color),
                  h.StrokeWidth(isActive ? '2.5' : '1.5'),
                  h.Opacity(isInactive ? '0.15' : '1'),
                  h.Style({ transition: 'opacity 80ms, stroke-width 80ms' }),
                ],
                [],
              );
            }),
          ),

          // Legend (2 rows of 3)
          h.g(
            [h.Transform(`translate(0,${PH + 18})`)],
            CURVE_PATHS.map(({ name, color }, i) => {
              const col = i % 3;
              const row = Math.floor(i / 3);
              const isActive = name === active;
              const isInactive = active !== null && !isActive;
              return h.g(
                [
                  h.Transform(`translate(${col * 112},${row * 18})`),
                  h.OnMouseEnter(toParentMessage(HoveredCurve({ name }))),
                  h.OnMouseLeave(toParentMessage(BlurredCurve({}))),
                  h.Style({ cursor: 'default' }),
                ],
                [
                  h.line(
                    [
                      h.X1('0'),
                      h.Y1('-4'),
                      h.X2('16'),
                      h.Y2('-4'),
                      h.Stroke(color),
                      h.StrokeWidth('2'),
                      h.Opacity(isInactive ? '0.25' : '1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('20'),
                      h.Y('0'),
                      h.Style({
                        'font-size': '0.6rem',
                        'font-weight': isActive ? '600' : '400',
                        fill: isInactive ? '#cbd5e1' : '#64748b',
                        transition: 'fill 80ms',
                      }),
                    ],
                    [name],
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    ],
  );
}
