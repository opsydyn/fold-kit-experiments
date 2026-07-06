import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { lineRadial } from '@opsydyn/foldkit-viz/shape/lineRadial';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot } from '../shared';

// MODEL

export type Series = Readonly<{
  label: string;
  color: string;
  values: ReadonlyArray<number>;
}>;

export type Model = Readonly<{
  axes: ReadonlyArray<string>;
  series: ReadonlyArray<Series>;
  activeSeriesIndex: Option.Option<number>;
  maxValue: number;
}>;

export type InitConfig = Readonly<{
  axes: ReadonlyArray<string>;
  series: ReadonlyArray<Series>;
  maxValue?: number;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const allValues = cfg.series.flatMap((s) => [...s.values]);
  const maxValue = cfg.maxValue ?? Math.max(...allValues, 1);
  return [
    {
      axes: cfg.axes,
      series: cfg.series,
      activeSeriesIndex: Option.none(),
      maxValue,
    },
    [],
  ];
}

// MESSAGE

export const HoveredSeries = m('HoveredSeries', { index: Schema.Number });
export const BlurredSeries = m('BlurredSeries', {});

export const Message = Schema.Union([HoveredSeries, BlurredSeries]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSeries: ({ index }) => [{ ...model, activeSeriesIndex: Option.some(index) }, []],
      BlurredSeries: () => [{ ...model, activeSeriesIndex: Option.none() }, []],
    }),
  );

// VIEW

const W = 480;
const H = 320;
const CX = 215;
const CY = 155;
const MAX_RADIUS = 110;
const GRID_LEVELS = 4;
const LABEL_OFFSET = 20;

const TAU = 2 * Math.PI;

// Regular n-gon polygon path at given radius, closed
function gridPolygon(n: number, radius: number): string {
  const pts: Array<readonly [number, number]> = Array.from({ length: n }, (_, i) => [
    (i / n) * TAU,
    radius,
  ]);
  return lineRadial(pts, { closed: true }) ?? '';
}

// Radial position for axis i of n
function radialXY(i: number, n: number, r: number): readonly [number, number] {
  const angle = (i / n) * TAU;
  return [r3(r * Math.sin(angle)), r3(-r * Math.cos(angle))];
}

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Radar chart' } = config;
  const { axes, series, activeSeriesIndex, maxValue } = model;
  const n = axes.length;

  const toRadius = linear({ domain: [0, maxValue], range: [0, MAX_RADIUS] });
  const isAnyActive = Option.isSome(activeSeriesIndex);

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${CX},${CY})`)],
      [
        // Concentric grid polygons
        ...Array.from({ length: GRID_LEVELS }, (_, i) => {
          const level = (i + 1) / GRID_LEVELS;
          return h.path(
            [
              h.D(gridPolygon(n, level * MAX_RADIUS)),
              h.Fill('none'),
              h.Stroke('var(--chart-grid, #2d2d2d)'),
              h.StrokeWidth('1'),
            ],
            [],
          );
        }),

        // Axis spokes
        ...axes.map((_, i) => {
          const [x, y] = radialXY(i, n, MAX_RADIUS);
          return h.line(
            [
              h.X1('0'),
              h.Y1('0'),
              h.X2(String(x)),
              h.Y2(String(y)),
              h.Stroke('var(--chart-axis, #3a3a3a)'),
              h.StrokeWidth('1'),
            ],
            [],
          );
        }),

        // Grid level value labels along axis 0 (top)
        ...Array.from({ length: GRID_LEVELS }, (_, i) => {
          const level = (i + 1) / GRID_LEVELS;
          const yPos = r3(-level * MAX_RADIUS);
          return h.text(
            [
              h.X('4'),
              h.Y(String(yPos)),
              h.Style({
                'font-size': '0.58rem',
                fill: '#94a3b8',
                'dominant-baseline': 'middle',
              }),
            ],
            [String(Math.round(level * maxValue))],
          );
        }),

        // Series polygons — filled + stroked
        ...series.map((s, si) => {
          const pts: Array<readonly [number, number]> = s.values.map((v, i) => [
            (i / n) * TAU,
            toRadius(v),
          ]);
          const d = lineRadial(pts, { closed: true }) ?? '';
          const isActive =
            isAnyActive && Option.isSome(activeSeriesIndex) && activeSeriesIndex.value === si;
          const strokeOpacity = !isAnyActive ? '0.9' : isActive ? '1' : '0.2';
          const fillOpacity = !isAnyActive ? '0.15' : isActive ? '0.25' : '0.04';
          const strokeWidth = isActive ? '2.5' : '1.5';
          return h.path(
            [
              h.D(d),
              h.Fill(s.color),
              h.Stroke(s.color),
              h.StrokeWidth(strokeWidth),
              h.Style({
                'fill-opacity': fillOpacity,
                'stroke-opacity': strokeOpacity,
                transition: 'fill-opacity 150ms, stroke-opacity 150ms',
                cursor: 'pointer',
              }),
              h.OnMouseEnter(toParentMessage(HoveredSeries({ index: si }))),
              h.OnMouseLeave(toParentMessage(BlurredSeries())),
            ],
            [],
          );
        }),

        // Axis labels
        ...axes.map((label, i) => {
          const [x, y] = radialXY(i, n, MAX_RADIUS + LABEL_OFFSET);
          const sinAngle = Math.sin((i / n) * TAU);
          const anchor = Math.abs(sinAngle) < 0.15 ? 'middle' : sinAngle > 0 ? 'start' : 'end';
          return h.text(
            [
              h.X(String(x)),
              h.Y(String(y)),
              h.Style({
                'text-anchor': anchor,
                'dominant-baseline': 'middle',
                'font-size': '0.72rem',
                fill: '#475569',
                'font-weight': '500',
              }),
            ],
            [label],
          );
        }),
      ],
    ),

    // Legend
    h.g(
      [h.Transform(`translate(${W - 120}, 20)`)],
      series.map((s, si) => {
        const isActive =
          isAnyActive && Option.isSome(activeSeriesIndex) && activeSeriesIndex.value === si;
        return h.g(
          [
            h.Transform(`translate(0, ${si * 24})`),
            h.OnMouseEnter(toParentMessage(HoveredSeries({ index: si }))),
            h.OnMouseLeave(toParentMessage(BlurredSeries())),
            h.Style({ cursor: 'pointer' }),
          ],
          [
            h.circle(
              [h.Cx('6'), h.Cy('6'), h.R('5'), h.Fill(s.color), h.Opacity(isActive ? '1' : '0.65')],
              [],
            ),
            h.text(
              [
                h.X('16'),
                h.Y('6'),
                h.Style({
                  'dominant-baseline': 'middle',
                  'font-size': '0.7rem',
                  fill: isActive ? '#1e293b' : '#64748b',
                  'font-weight': isActive ? '600' : '400',
                }),
              ],
              [s.label],
            ),
          ],
        );
      }),
    ),
  ]);
};
