import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot } from '../shared';

// MODEL

export type Axis = Readonly<{
  label: string;
  format?: (v: number) => string;
}>;

export type DataRecord = Readonly<{
  label: string;
  color: string;
  values: ReadonlyArray<number>;
}>;

export type InitConfig = Readonly<{
  axes: ReadonlyArray<Axis>;
  records: ReadonlyArray<DataRecord>;
}>;

export type Model = Readonly<{
  axes: ReadonlyArray<Axis>;
  records: ReadonlyArray<DataRecord>;
  axisDomains: ReadonlyArray<readonly [number, number]>;
  activeIndex: Option.Option<number>;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const axisDomains = cfg.axes.map((_, ai) => {
    const vals = cfg.records.map((r) => r.values[ai] ?? 0);
    return [Math.min(...vals), Math.max(...vals)] as readonly [number, number];
  });
  return [{ axes: cfg.axes, records: cfg.records, axisDomains, activeIndex: Option.none() }, []];
}

// MESSAGE

export const HoveredRecord = m('HoveredRecord', { index: Schema.Number });
export const BlurredRecord = m('BlurredRecord', {});
export const Message = Schema.Union([HoveredRecord, BlurredRecord]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredRecord: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredRecord: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

const W = 480;
const H = 265;
const PLOT_L = 50;
const PLOT_R = 350;
const PLOT_T = 38;
const PLOT_B = 210;

function fmtDefault(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Parallel coordinates chart' } = config;
  const { axes, records, axisDomains, activeIndex } = model;
  const numAxes = axes.length;
  const spacing = numAxes > 1 ? (PLOT_R - PLOT_L) / (numAxes - 1) : 0;
  const axX = (i: number) => r3(PLOT_L + i * spacing);

  const yScales = axisDomains.map(([mn, mx]) =>
    linear({ domain: [mn, mx], range: [PLOT_B, PLOT_T] }),
  );

  const isAnyActive = Option.isSome(activeIndex);

  function linePath(record: DataRecord): string {
    const pts = record.values.map((v, i) => {
      const scale = yScales[i];
      const y = scale ? r3(scale(v)) : PLOT_B;
      return `${axX(i)},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  }

  const inactiveLines = records.flatMap((record, ri) => {
    if (Option.isSome(activeIndex) && activeIndex.value === ri) return [];
    return [
      h.path(
        [
          h.D(linePath(record)),
          h.Fill('none'),
          h.Stroke(record.color),
          h.StrokeWidth('1.5'),
          h.Opacity(isAnyActive ? '0.1' : '0.65'),
          h.Style({
            transition: 'opacity 150ms',
            cursor: 'pointer',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
          h.OnMouseEnter(toParentMessage(HoveredRecord({ index: ri }))),
          h.OnMouseLeave(toParentMessage(BlurredRecord({}))),
        ],
        [],
      ),
    ];
  });

  const activeLines = records.flatMap((record, ri) => {
    if (!Option.isSome(activeIndex) || activeIndex.value !== ri) return [];
    return [
      h.path(
        [
          h.D(linePath(record)),
          h.Fill('none'),
          h.Stroke(record.color),
          h.StrokeWidth('2.5'),
          h.Opacity('1'),
          h.Style({
            transition: 'opacity 150ms',
            cursor: 'pointer',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
          h.OnMouseEnter(toParentMessage(HoveredRecord({ index: ri }))),
          h.OnMouseLeave(toParentMessage(BlurredRecord({}))),
        ],
        [],
      ),
    ];
  });

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    // Axes
    h.g(
      [],
      axes.map((axis, i) => {
        const x = axX(i);
        const [mn, mx] = axisDomains[i] ?? [0, 1];
        const fmt = axis.format ?? fmtDefault;
        return h.g(
          [],
          [
            h.line(
              [
                h.X1(String(x)),
                h.Y1(String(PLOT_T)),
                h.X2(String(x)),
                h.Y2(String(PLOT_B)),
                h.Stroke('var(--chart-axis, #3a3a3a)'),
                h.StrokeWidth('1.5'),
              ],
              [],
            ),
            h.text(
              [
                h.X(String(x)),
                h.Y(String(PLOT_T - 5)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'auto',
                  'font-size': '0.58rem',
                  fill: '#94a3b8',
                }),
              ],
              [fmt(mx)],
            ),
            h.text(
              [
                h.X(String(x)),
                h.Y(String(PLOT_B + 5)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '0.58rem',
                  fill: '#94a3b8',
                }),
              ],
              [fmt(mn)],
            ),
            h.text(
              [
                h.X(String(x)),
                h.Y(String(PLOT_B + 20)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '0.68rem',
                  fill: '#475569',
                  'font-weight': '600',
                }),
              ],
              [axis.label],
            ),
          ],
        );
      }),
    ),

    // Lines — inactive behind, active on top
    h.g([], [...inactiveLines, ...activeLines]),

    // Legend
    h.g(
      [h.Transform(`translate(${PLOT_R + 16}, ${PLOT_T})`)],
      records.map((record, ri) => {
        const isActive = Option.isSome(activeIndex) && activeIndex.value === ri;
        return h.g(
          [
            h.Transform(`translate(0, ${ri * 20})`),
            h.OnMouseEnter(toParentMessage(HoveredRecord({ index: ri }))),
            h.OnMouseLeave(toParentMessage(BlurredRecord({}))),
            h.Style({ cursor: 'pointer' }),
          ],
          [
            h.line(
              [
                h.X1('0'),
                h.Y1('6'),
                h.X2('12'),
                h.Y2('6'),
                h.Stroke(record.color),
                h.StrokeWidth(isActive ? '2.5' : '1.5'),
                h.Opacity(isActive ? '1' : '0.65'),
              ],
              [],
            ),
            h.text(
              [
                h.X('16'),
                h.Y('6'),
                h.Style({
                  'dominant-baseline': 'middle',
                  'font-size': '0.62rem',
                  fill: isActive ? '#1e293b' : '#64748b',
                  'font-weight': isActive ? '600' : '400',
                }),
              ],
              [record.label],
            ),
          ],
        );
      }),
    ),
  ]);
}
