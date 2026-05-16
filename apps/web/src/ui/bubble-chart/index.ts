import { linear, linearTicks, sqrt } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type Point = Readonly<{ x: number; y: number; value: number; label: string }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  minRadius: number;
  maxRadius: number;
  tickCount: number;
  xLabel: string;
  yLabel: string;
  valueLabel: string;
}>;

export type Model = Readonly<{
  points: ReadonlyArray<Point>;
  activeIndex: Option.Option<number>;
  config: Config;
}>;

export type InitConfig = Readonly<{
  points: ReadonlyArray<Point>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#8b5cf6',
  activeColor: '#7c3aed',
  minRadius: 6,
  maxRadius: 32,
  tickCount: 5,
  xLabel: 'X',
  yLabel: 'Y',
  valueLabel: 'Value',
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      points: cfg.points,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
    },
    [],
  ];
}

// MESSAGE

export const HoveredPoint = m('HoveredPoint', { index: Schema.Number });
export const BlurredPoint = m('BlurredPoint', {});
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const Message = Schema.Union([HoveredPoint, BlurredPoint, PressedKeyNav]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredPoint: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredPoint: () => [{ ...model, activeIndex: Option.none() }, []],
      PressedKeyNav: ({ direction }) => {
        const n = model.points.length;
        const current = Option.isSome(model.activeIndex) ? model.activeIndex.value : -1;
        const next = direction === 'next' ? (current + 1) % n : (current - 1 + n) % n;
        return [{ ...model, activeIndex: Option.some(next) }, []];
      },
    }),
  );

// VIEW

const W = 480;
const H = 280;
const MT = 24;
const MR = 36;
const MB = 52;
const ML = 52;
const PW = W - ML - MR;
const PH = H - MT - MB;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Bubble chart' } = config;
  const { points, activeIndex, config: cfg } = model;

  const maxX = points.reduce((a, p) => Math.max(a, p.x), 0);
  const maxY = points.reduce((a, p) => Math.max(a, p.y), 0);
  const maxV = points.reduce((a, p) => Math.max(a, p.value), 0);

  const xDomain: readonly [number, number] = [0, maxX * 1.1];
  const yDomain: readonly [number, number] = [0, maxY * 1.1];

  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const rScale = sqrt({ domain: [0, maxV], range: [cfg.minRadius, cfg.maxRadius], clamp: true });

  const xTicks = linearTicks(xDomain, cfg.tickCount);
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const handleKeyDown = (key: string): Option.Option<M> => {
    if (key === 'ArrowRight')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'next' })));
    if (key === 'ArrowLeft')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'prev' })));
    return Option.none();
  };

  return h.svg(
    [
      h.ViewBox(`0 0 ${W} ${H}`),
      h.Width('100%'),
      h.Role('img'),
      h.AriaLabel(ariaLabel),
      h.Tabindex(0),
      h.OnKeyDownPreventDefault(handleKeyDown),
      h.Style({ display: 'block', outline: 'none', 'font-family': 'inherit' }),
    ],
    [
      h.g(
        [h.Transform(`translate(${ML},${MT})`)],
        [
          // Y gridlines + tick labels
          h.g(
            [],
            yTicks.map((tick) => {
              const y = r3(yScale(tick));
              return h.g(
                [h.Transform(`translate(0,${y})`)],
                [
                  h.line(
                    [
                      h.X1('0'), h.Y1('0'),
                      h.X2(String(PW)), h.Y2('0'),
                      h.Stroke('#e5e5e5'), h.StrokeWidth('1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('-8'), h.Y('0'),
                      h.Style({
                        'text-anchor': 'end',
                        'dominant-baseline': 'middle',
                        'font-size': '0.7rem',
                        fill: '#888',
                      }),
                    ],
                    [String(tick)],
                  ),
                ],
              );
            }),
          ),

          // X gridlines + tick labels
          h.g(
            [],
            xTicks.map((tick) => {
              const x = r3(xScale(tick));
              return h.g(
                [h.Transform(`translate(${x},0)`)],
                [
                  h.line(
                    [
                      h.X1('0'), h.Y1('0'),
                      h.X2('0'), h.Y2(String(PH)),
                      h.Stroke('#e5e5e5'), h.StrokeWidth('1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('0'), h.Y(String(PH + 12)),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': 'hanging',
                        'font-size': '0.7rem',
                        fill: '#888',
                      }),
                    ],
                    [String(tick)],
                  ),
                ],
              );
            }),
          ),

          // Axis lines
          h.line(
            [
              h.X1('0'), h.Y1(String(PH)),
              h.X2(String(PW)), h.Y2(String(PH)),
              h.Stroke('#d4d4d4'), h.StrokeWidth('1'),
            ],
            [],
          ),
          h.line(
            [
              h.X1('0'), h.Y1('0'),
              h.X2('0'), h.Y2(String(PH)),
              h.Stroke('#d4d4d4'), h.StrokeWidth('1'),
            ],
            [],
          ),

          // X axis label
          h.text(
            [
              h.X(String(PW / 2)),
              h.Y(String(PH + 38)),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'auto',
                'font-size': '0.7rem',
                'font-weight': '600',
                fill: '#aaa',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
              }),
            ],
            [cfg.xLabel],
          ),

          // Y axis label (rotated)
          h.text(
            [
              h.Transform(`translate(${-ML + 12},${PH / 2}) rotate(-90)`),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'auto',
                'font-size': '0.7rem',
                'font-weight': '600',
                fill: '#aaa',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
              }),
            ],
            [cfg.yLabel],
          ),

          // Bubbles (fill layer first so hit areas render on top)
          h.g(
            [],
            points.map((p, i) => {
              const cx = r3(xScale(p.x));
              const cy = r3(yScale(p.y));
              const br = r3(rScale(p.value));
              const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
              return h.circle(
                [
                  h.Cx(String(cx)),
                  h.Cy(String(cy)),
                  h.R(String(br)),
                  h.Fill(isActive ? `${cfg.activeColor}cc` : `${cfg.color}66`),
                  h.Stroke(isActive ? cfg.activeColor : cfg.color),
                  h.StrokeWidth(isActive ? '2' : '1.5'),
                  h.Style({ transition: 'fill 120ms, stroke 120ms' }),
                ],
                [],
              );
            }),
          ),

          // Active label
          ...points.flatMap((p, i) => {
            const cx = r3(xScale(p.x));
            const cy = r3(yScale(p.y));
            const br = r3(rScale(p.value));
            const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
            if (!isActive) return [];
            return [
              h.text(
                [
                  h.X(String(cx)),
                  h.Y(String(r3(cy - br - 6))),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'auto',
                    'font-size': '0.72rem',
                    'font-weight': '600',
                    fill: cfg.activeColor,
                    'pointer-events': 'none',
                  }),
                ],
                [`${p.label} (${p.x}, ${p.y})`],
              ),
            ];
          }),

          // Hit areas on top
          h.g(
            [],
            points.map((p, i) => {
              const cx = r3(xScale(p.x));
              const cy = r3(yScale(p.y));
              const br = r3(rScale(p.value));
              return h.circle(
                [
                  h.Cx(String(cx)),
                  h.Cy(String(cy)),
                  h.R(String(br + 4)),
                  h.Fill('transparent'),
                  h.OnMouseEnter(toParentMessage(HoveredPoint({ index: i }))),
                  h.OnMouseLeave(toParentMessage(BlurredPoint({}))),
                  h.Style({ cursor: 'pointer' }),
                  h.AriaLabel(`${p.label}: x ${p.x}, y ${p.y}, ${cfg.valueLabel} ${p.value}`),
                ],
                [],
              );
            }),
          ),
        ],
      ),
    ],
  );
};
