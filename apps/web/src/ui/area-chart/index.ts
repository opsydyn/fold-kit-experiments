import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { area } from '@opsydyn/foldkit-viz/shape/area';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type Point = Readonly<{ label: string; value: number }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  tickCount: number;
  curve: 'linear' | 'catmullRom' | 'monotoneX';
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
  color: '#10b981',
  activeColor: '#059669',
  tickCount: 5,
  curve: 'catmullRom',
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
const H = 260;
const MT = 24;
const MR = 20;
const MB = 44;
const ML = 44;
const PW = W - ML - MR;
const PH = H - MT - MB;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Area chart' } = config;
  const { points, activeIndex, config: cfg } = model;

  const maxValue = points.reduce((acc, p) => Math.max(acc, p.value), 0);
  const yDomain: readonly [number, number] = [0, maxValue * 1.15];
  const xDomain: readonly [number, number] = [0, points.length - 1];

  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const coords: ReadonlyArray<readonly [number, number]> = points.map(
    (p, i) => [r3(xScale(i)), r3(yScale(p.value))],
  );

  const areaPath = area(coords, PH, { curve: cfg.curve });
  const linePath = line(coords, { curve: cfg.curve });

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

          // Area fill
          ...(areaPath
            ? [h.path([h.D(areaPath), h.Fill(`${cfg.color}22`), h.Stroke('none')], [])]
            : []),

          // Stroke line on top
          ...(linePath
            ? [
                h.path(
                  [
                    h.D(linePath),
                    h.Fill('none'),
                    h.Stroke(cfg.color),
                    h.StrokeWidth('2'),
                    h.Style({ 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
                  ],
                  [],
                ),
              ]
            : []),

          // Active point vertical crosshair + dot
          ...(Option.isSome(activeIndex)
            ? (() => {
                const i = activeIndex.value;
                const [cx, cy] = coords[i];
                const p = points[i];
                return [
                  h.line(
                    [
                      h.X1(String(cx)), h.Y1(String(cy)),
                      h.X2(String(cx)), h.Y2(String(PH)),
                      h.Stroke(cfg.color), h.StrokeWidth('1'),
                      h.Style({ 'stroke-dasharray': '3,3', opacity: '0.5' }),
                    ],
                    [],
                  ),
                  h.circle(
                    [
                      h.Cx(String(cx)), h.Cy(String(cy)), h.R('5'),
                      h.Fill('#fff'),
                      h.Stroke(cfg.activeColor), h.StrokeWidth('2'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X(String(cx)),
                      h.Y(String(r3(cy - 10))),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': 'auto',
                        'font-size': '0.75rem',
                        'font-weight': '600',
                        fill: cfg.activeColor,
                      }),
                    ],
                    [String(p.value)],
                  ),
                ];
              })()
            : []),

          // Invisible hit areas for each point
          h.g(
            [],
            points.map((_, i) => {
              const [cx] = coords[i];
              return h.rect(
                [
                  h.X(String(r3(cx - 16))),
                  h.Y('0'),
                  h.Width('32'),
                  h.Height(String(PH)),
                  h.Fill('transparent'),
                  h.OnMouseEnter(toParentMessage(HoveredPoint({ index: i }))),
                  h.OnMouseLeave(toParentMessage(BlurredPoint({}))),
                  h.Style({ cursor: 'crosshair' }),
                  h.AriaLabel(`${points[i].label}: ${points[i].value}`),
                ],
                [],
              );
            }),
          ),

          // X axis line
          h.line(
            [
              h.X1('0'), h.Y1(String(PH)),
              h.X2(String(PW)), h.Y2(String(PH)),
              h.Stroke('#d4d4d4'), h.StrokeWidth('1'),
            ],
            [],
          ),

          // X axis labels
          h.g(
            [h.Transform(`translate(0,${PH})`)],
            points.map((p, i) =>
              h.text(
                [
                  h.X(String(r3(xScale(i)))),
                  h.Y('14'),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '0.7rem',
                    fill: '#888',
                  }),
                ],
                [p.label],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};
