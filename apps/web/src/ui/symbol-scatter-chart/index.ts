import { linear, linearTicks, ordinal } from '@opsydyn/foldkit-viz/math/scale';
import { SYMBOLS_FILL, symbolPath, type SymbolType } from '@opsydyn/foldkit-viz/shape/symbol';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type ScatterDatum = Readonly<{
  x: number;
  y: number;
  category: string;
}>;

export type CategoryStyle = Readonly<{
  color: string;
  symbol: SymbolType;
}>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<ScatterDatum>;
  categories: ReadonlyArray<string>;
  colors?: ReadonlyArray<string>;
  xLabel?: string;
  yLabel?: string;
  symbolSize?: number;
}>;

export type PlottedPoint = Readonly<{
  cx: number;
  cy: number;
  category: string;
  color: string;
  symbolType: SymbolType;
  path: string;
  datum: ScatterDatum;
}>;

export type Model = Readonly<{
  points: ReadonlyArray<PlottedPoint>;
  categories: ReadonlyArray<string>;
  categoryStyles: ReadonlyMap<string, CategoryStyle>;
  xLabel: string;
  yLabel: string;
  symbolSize: number;
  activeIndex: Option.Option<number>;
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
}>;

const DEFAULT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const colors = cfg.colors ?? DEFAULT_COLORS;
  const symbolSize = cfg.symbolSize ?? 72;

  const colorScale = ordinal(cfg.categories, colors);
  const symbolScale = ordinal(cfg.categories, SYMBOLS_FILL as unknown as string[]) as unknown as (v: string) => SymbolType;

  const categoryStyles = new Map<string, CategoryStyle>(
    cfg.categories.map((cat) => [
      cat,
      { color: colorScale(cat), symbol: symbolScale(cat) },
    ]),
  );

  const xValues = cfg.data.map((d) => d.x);
  const yValues = cfg.data.map((d) => d.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xPad = (xMax - xMin) * 0.08;
  const yPad = (yMax - yMin) * 0.08;

  const xDomain: readonly [number, number] = [xMin - xPad, xMax + xPad];
  const yDomain: readonly [number, number] = [yMin - yPad, yMax + yPad];

  // Points are positioned later in view (domain → range depends on layout consts)
  // Store raw data and compute pixel coords in view
  const points: ReadonlyArray<PlottedPoint> = cfg.data.map((datum) => {
    const style = categoryStyles.get(datum.category) ?? { color: colors[0] ?? '#6366f1', symbol: 'circle' as SymbolType };
    return {
      cx: 0, // placeholder, computed in view
      cy: 0,
      category: datum.category,
      color: style.color,
      symbolType: style.symbol,
      path: symbolPath(style.symbol, symbolSize),
      datum,
    };
  });

  return [
    {
      points,
      categories: cfg.categories,
      categoryStyles,
      xLabel: cfg.xLabel ?? 'x',
      yLabel: cfg.yLabel ?? 'y',
      symbolSize,
      activeIndex: Option.none(),
      xDomain,
      yDomain,
    },
    [],
  ];
}

// MESSAGE

export const HoveredPoint = m('HoveredPoint', { index: Schema.Number });
export const BlurredPoint = m('BlurredPoint', {});

export const Message = Schema.Union([HoveredPoint, BlurredPoint]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredPoint: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredPoint: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

const W = 480;
const H = 265;
const MT = 20;
const MR = 110; // space for legend
const MB = 44;
const ML = 44;
const PW = W - ML - MR;
const PH = H - MT - MB;

const LEGEND_X = W - MR + 12;
const LEGEND_SYMBOL_SIZE = 48;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Symbol scatter chart' } = config;
  const { points, categories, categoryStyles, xLabel, yLabel, activeIndex, xDomain, yDomain } = model;

  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const xTicks = linearTicks(xDomain, 5);
  const yTicks = linearTicks(yDomain, 5);

  const activeIdx = Option.isSome(activeIndex) ? activeIndex.value : -1;
  const isAnyActive = activeIdx !== -1;

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
          // Y gridlines + labels
          h.g(
            [],
            yTicks.map((tick) => {
              const y = r3(yScale(tick));
              return h.g(
                [h.Transform(`translate(0,${y})`)],
                [
                  h.line(
                    [h.X1('0'), h.Y1('0'), h.X2(String(PW)), h.Y2('0'), h.Stroke('#e5e7eb'), h.StrokeWidth('1')],
                    [],
                  ),
                  h.text(
                    [
                      h.X('-8'),
                      h.Y('0'),
                      h.Style({
                        'text-anchor': 'end',
                        'dominant-baseline': 'middle',
                        'font-size': '0.65rem',
                        fill: '#94a3b8',
                      }),
                    ],
                    [String(Math.round(tick))],
                  ),
                ],
              );
            }),
          ),

          // X gridlines + labels
          h.g(
            [h.Transform(`translate(0,${PH})`)],
            xTicks.map((tick) => {
              const x = r3(xScale(tick));
              return h.g(
                [h.Transform(`translate(${x},0)`)],
                [
                  h.line(
                    [h.X1('0'), h.Y1(String(-PH)), h.X2('0'), h.Y2('0'), h.Stroke('#e5e7eb'), h.StrokeWidth('1')],
                    [],
                  ),
                  h.text(
                    [
                      h.X('0'),
                      h.Y('14'),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': 'hanging',
                        'font-size': '0.65rem',
                        fill: '#94a3b8',
                      }),
                    ],
                    [String(Math.round(tick))],
                  ),
                ],
              );
            }),
          ),

          // Symbols
          h.g(
            [],
            points.map((pt, i) => {
              const cx = r3(xScale(pt.datum.x));
              const cy = r3(yScale(pt.datum.y));
              const isActive = i === activeIdx;
              const opacity = isAnyActive ? (isActive ? 1 : 0.3) : 0.8;
              return h.g(
                [
                  h.Transform(`translate(${cx},${cy})`),
                  h.OnMouseEnter(toParentMessage(HoveredPoint({ index: i }))),
                  h.OnMouseLeave(toParentMessage(BlurredPoint({}))),
                  h.Style({ cursor: 'pointer' }),
                ],
                [
                  h.path(
                    [
                      h.D(pt.path),
                      h.Fill(pt.color),
                      h.Opacity(String(opacity)),
                      h.Style({ transition: 'opacity 80ms' }),
                    ],
                    [],
                  ),
                  ...(isActive
                    ? [
                        h.text(
                          [
                            h.X('0'),
                            h.Y('-12'),
                            h.Style({
                              'text-anchor': 'middle',
                              'dominant-baseline': 'auto',
                              'font-size': '0.62rem',
                              'font-weight': '600',
                              fill: pt.color,
                            }),
                          ],
                          [`(${pt.datum.x}, ${pt.datum.y})`],
                        ),
                      ]
                    : []),
                ],
              );
            }),
          ),

          // Axis labels
          h.text(
            [
              h.X(String(PW / 2)),
              h.Y(String(PH + 36)),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'hanging',
                'font-size': '0.65rem',
                fill: '#64748b',
              }),
            ],
            [xLabel],
          ),
          h.text(
            [
              h.X(String(-PH / 2)),
              h.Y('-34'),
              h.Transform(`rotate(-90) translate(${-(PH / 2)}, -34)`),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'hanging',
                'font-size': '0.65rem',
                fill: '#64748b',
              }),
            ],
            [yLabel],
          ),
        ],
      ),

      // Legend
      h.g(
        [h.Transform(`translate(${LEGEND_X},${MT + 4})`)],
        categories.map((cat, i) => {
          const style = categoryStyles.get(cat) ?? { color: '#6366f1', symbol: 'circle' as SymbolType };
          const legendPath = symbolPath(style.symbol, LEGEND_SYMBOL_SIZE);
          return h.g(
            [h.Transform(`translate(0,${i * 20})`)],
            [
              h.path(
                [
                  h.D(legendPath),
                  h.Fill(style.color),
                  h.Opacity('0.85'),
                ],
                [],
              ),
              h.text(
                [
                  h.X('14'),
                  h.Y('0'),
                  h.Style({
                    'dominant-baseline': 'middle',
                    'font-size': '0.65rem',
                    fill: '#475569',
                  }),
                ],
                [cat],
              ),
            ],
          );
        }),
      ),
    ],
  );
}
