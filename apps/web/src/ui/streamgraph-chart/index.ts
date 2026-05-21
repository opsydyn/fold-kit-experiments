import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { area } from '@opsydyn/foldkit-viz/shape/area';
import { stack } from '@opsydyn/foldkit-viz/shape/stack';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type SeriesMeta = Readonly<{ key: string; label: string; color: string }>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<Readonly<Record<string, number>>>;
  xLabels: ReadonlyArray<string>;
  series: ReadonlyArray<SeriesMeta>;
}>;

// VIEW CONSTANTS (needed in both buildLayout and view)

const W = 480;
const H = 280;
const MT = 16;
const MR = 16;
const MB = 28;
const ML = 16;
const PW = W - ML - MR;
const PH = H - MT - MB;

const r2 = (n: number) => Math.round(n * 100) / 100;

type ComputedSeries = Readonly<{
  key: string;
  index: number;
  color: string;
  label: string;
  pathD: string;
  labelX: number;
  labelY: number;
  showLabel: boolean;
}>;

type ComputedXLabel = Readonly<{ x: number; label: string; anchor: string }>;

type Layout = Readonly<{
  series: ReadonlyArray<ComputedSeries>;
  xLabels: ReadonlyArray<ComputedXLabel>;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeKey: Option.Option<string>;
}>;

function buildLayout(cfg: InitConfig): Layout {
  const { data, xLabels, series } = cfg;
  const keys = series.map((s) => s.key);
  const stacked = stack(data, { keys, order: 'insideOut', offset: 'wiggle' });

  let yMin = 0;
  let yMax = 0;
  for (const s of stacked) {
    for (const b of s.bands) {
      if (b.y0 < yMin) yMin = b.y0;
      if (b.y1 > yMax) yMax = b.y1;
    }
  }

  const xScale = linear({ domain: [0, data.length - 1], range: [0, PW] });
  const yScale = linear({ domain: [yMin, yMax], range: [PH, 0] });

  const sorted = [...stacked].sort((a, b) => a.index - b.index);

  const computedSeries: ComputedSeries[] = sorted.map((s) => {
    const meta = series.find((m) => m.key === s.key);
    const topline = s.bands.map((b, i) => [r2(xScale(i)), r2(yScale(b.y1))] as const);
    const baseline = s.bands.map((b, i) => [r2(xScale(i)), r2(yScale(b.y0))] as const);
    const pathD = area(topline, baseline, { curve: 'catmullRom' }) ?? '';

    let bestI = 0;
    let bestH = 0;
    for (let i = 0; i < s.bands.length; ++i) {
      const b = s.bands[i];
      if (!b) continue;
      const bh = b.y1 - b.y0;
      if (bh > bestH) {
        bestH = bh;
        bestI = i;
      }
    }
    const band = s.bands[bestI];
    const showLabel = !!band && bestH >= 4;
    const labelX = band ? r2(xScale(bestI)) : 0;
    const labelY = band ? r2(yScale((band.y0 + band.y1) / 2)) : 0;

    return {
      key: s.key,
      index: s.index,
      color: meta?.color ?? '#94a3b8',
      label: meta?.label ?? s.key,
      pathD,
      labelX,
      labelY,
      showLabel,
    };
  });

  const computedXLabels: ComputedXLabel[] = [];
  for (let i = 0; i < xLabels.length; ++i) {
    if (i % 2 !== 0 && i !== xLabels.length - 1) continue;
    const label = xLabels[i];
    if (label === undefined) continue;
    computedXLabels.push({
      x: r2(xScale(i)),
      label,
      anchor: i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle',
    });
  }

  return { series: computedSeries, xLabels: computedXLabels };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg), activeKey: Option.none() }, []];
}

// MESSAGE

export const HoveredSeries = m('HoveredSeries', { key: Schema.String });
export const BlurredSeries = m('BlurredSeries', {});

export const Message = Schema.Union([HoveredSeries, BlurredSeries]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSeries: ({ key }) => [{ ...model, activeKey: Option.some(key) }, []],
      BlurredSeries: () => [{ ...model, activeKey: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Streamgraph' } = config;
  const { layout, activeKey } = model;
  const { series, xLabels } = layout;

  const isAnyActive = Option.isSome(activeKey);
  const activeValue = isAnyActive ? activeKey.value : null;

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
          ...series.map((s) => {
            const isActive = isAnyActive && s.key === activeValue;
            const opacity = !isAnyActive ? '0.85' : isActive ? '1' : '0.2';
            return h.path(
              [
                h.D(s.pathD),
                h.Fill(s.color),
                h.Stroke(s.color),
                h.StrokeWidth(isActive ? '1.5' : '0.5'),
                h.Style({ opacity, transition: 'opacity 150ms', cursor: 'pointer' }),
                h.OnMouseEnter(toParentMessage(HoveredSeries({ key: s.key }))),
                h.OnMouseLeave(toParentMessage(BlurredSeries({}))),
              ],
              [],
            );
          }),

          ...series.map((s) => {
            if (!s.showLabel) return h.g([], []);
            const isActive = isAnyActive && s.key === activeValue;
            return h.text(
              [
                h.X(String(s.labelX)),
                h.Y(String(s.labelY)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'middle',
                  'font-size': '0.62rem',
                  'font-weight': '700',
                  fill: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                  'pointer-events': 'none',
                  'user-select': 'none',
                }),
              ],
              [s.label],
            );
          }),

          h.g(
            [],
            xLabels.map((xl) =>
              h.text(
                [
                  h.X(String(xl.x)),
                  h.Y(String(PH + 18)),
                  h.Style({
                    'text-anchor': xl.anchor,
                    'font-size': '0.62rem',
                    fill: '#94a3b8',
                  }),
                ],
                [xl.label],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};
