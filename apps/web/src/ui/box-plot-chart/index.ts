import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import type { BoxStats } from '@opsydyn/foldkit-viz/math/stats';
import { boxStats } from '@opsydyn/foldkit-viz/math/stats';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type Series = Readonly<{ label: string; values: readonly number[] }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  yLabel: string;
  tickCount: number;
}>;

export type InitConfig = Readonly<{
  series: ReadonlyArray<Series>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#6366f1',
  activeColor: '#4f46e5',
  yLabel: '',
  tickCount: 5,
};

export type Model = Readonly<{
  series: ReadonlyArray<Series>;
  stats: ReadonlyArray<BoxStats>;
  activeIndex: Option.Option<number>;
  config: Config;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      series: cfg.series,
      stats: cfg.series.map((sr) => boxStats(sr.values)),
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
    },
    [],
  ];
}

// MESSAGE

export const HoveredBox = m('HoveredBox', { index: Schema.Number });
export const BlurredBox = m('BlurredBox', {});

export const Message = Schema.Union([HoveredBox, BlurredBox]);
export type Message = typeof Message.Type;

// UPDATE

export function update(model: Model, msg: Message): readonly [Model, readonly []] {
  return Match.value(msg).pipe(
    Match.withReturnType<readonly [Model, readonly []]>(),
    Match.tagsExhaustive({
      HoveredBox: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredBox: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );
}

// VIEW

const W = 480;
const H = 265;
const MT = 15;
const MR = 20;
const MB = 35;
const ML = 48;
const PW = W - ML - MR;
const PH = H - MT - MB;

const n = (v: number) => String(Math.round(v * 100) / 100);

function tint(hex: string, t: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const rv = Number.parseInt(h.slice(0, 2), 16);
  const gv = Number.parseInt(h.slice(2, 4), 16);
  const bv = Number.parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(rv)},${mix(gv)},${mix(bv)})`;
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Box plot chart' } = config;
  const { series, stats, activeIndex, config: cfg } = model;

  const allValues = stats.flatMap((st) => [st.fenceLow, st.fenceHigh, ...st.outliers]);
  const yMax = allValues.reduce((a, v) => Math.max(a, v), 0) * 1.1;
  const yDomain: readonly [number, number] = [0, yMax];

  const xScale = band({
    domain: series.map((sr) => sr.label),
    range: [0, PW],
    paddingInner: 0.35,
    paddingOuter: 0.2,
  });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const boxW = xScale.bandwidth;
  const capW = boxW * 0.4;
  const activeIdx = Option.getOrElse(activeIndex, () => -1);

  const boxes = stats.map((st, i) => {
    const label = series[i]?.label ?? '';
    const cx = xScale.position(label) + boxW / 2;
    const isActive = i === activeIdx;
    const fillColor = isActive ? cfg.activeColor : cfg.color;
    const boxFill = tint(fillColor, isActive ? 0 : 0.25);
    const strokeColor = fillColor;

    const yQ1 = yScale(st.q1);
    const yQ3 = yScale(st.q3);
    const yMed = yScale(st.median);
    const yLow = yScale(st.fenceLow);
    const yHigh = yScale(st.fenceHigh);
    const x1 = cx - boxW / 2;
    const bh = Math.max(1, yQ1 - yQ3);

    return h.g(
      [
        h.Style({ cursor: 'pointer' }),
        h.OnMouseEnter(toParentMessage(HoveredBox({ index: i }))),
        h.OnMouseLeave(toParentMessage(BlurredBox({}))),
      ],
      [
        // whisker centre line
        h.line(
          [
            h.X1(n(cx)),
            h.Y1(n(yLow)),
            h.X2(n(cx)),
            h.Y2(n(yHigh)),
            h.Stroke(strokeColor),
            h.StrokeWidth('1.5'),
          ],
          [],
        ),
        // lower whisker cap
        h.line(
          [
            h.X1(n(cx - capW / 2)),
            h.Y1(n(yLow)),
            h.X2(n(cx + capW / 2)),
            h.Y2(n(yLow)),
            h.Stroke(strokeColor),
            h.StrokeWidth('1.5'),
          ],
          [],
        ),
        // upper whisker cap
        h.line(
          [
            h.X1(n(cx - capW / 2)),
            h.Y1(n(yHigh)),
            h.X2(n(cx + capW / 2)),
            h.Y2(n(yHigh)),
            h.Stroke(strokeColor),
            h.StrokeWidth('1.5'),
          ],
          [],
        ),
        // IQR box
        h.rect(
          [
            h.X(n(x1)),
            h.Y(n(yQ3)),
            h.Width(n(boxW)),
            h.Height(n(bh)),
            h.Fill(boxFill),
            h.Stroke(strokeColor),
            h.StrokeWidth('1.5'),
            h.Attribute('rx', '2'),
          ],
          [],
        ),
        // median line
        h.line(
          [
            h.X1(n(x1)),
            h.Y1(n(yMed)),
            h.X2(n(x1 + boxW)),
            h.Y2(n(yMed)),
            h.Stroke(strokeColor),
            h.StrokeWidth('2.5'),
          ],
          [],
        ),
        // outlier dots
        ...st.outliers.map((v) =>
          h.circle(
            [
              h.Cx(n(cx)),
              h.Cy(n(yScale(v))),
              h.R('3'),
              h.Fill('none'),
              h.Stroke(strokeColor),
              h.StrokeWidth('1.5'),
            ],
            [],
          ),
        ),
      ],
    );
  });

  const tooltip = Option.match(activeIndex, {
    onNone: () => h.g([], []),
    onSome: (i) => {
      const st = stats[i];
      if (!st) return h.g([], []);
      const lines = [
        `Median  ${st.median.toFixed(0)}`,
        `Q1 – Q3  ${st.q1.toFixed(0)} – ${st.q3.toFixed(0)}`,
        `Range  ${st.fenceLow.toFixed(0)} – ${st.fenceHigh.toFixed(0)}`,
      ];
      return h.g(
        [h.Transform(`translate(${ML + 4},${MT + 2})`)],
        lines.map((line, li) =>
          h.text(
            [
              h.X('0'),
              h.Y(String(li * 14)),
              h.Fill('#64748b'),
              h.Style({ 'font-size': '10px', 'font-family': 'inherit' }),
            ],
            [line],
          ),
        ),
      );
    },
  });

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
          // Y gridlines + tick labels
          h.g(
            [],
            yTicks.map((tick) => {
              const y = n(yScale(tick));
              return h.g(
                [],
                [
                  h.line(
                    [
                      h.X1('0'),
                      h.Y1(y),
                      h.X2(String(PW)),
                      h.Y2(y),
                      h.Stroke('#e2e8f0'),
                      h.StrokeWidth('1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('-6'),
                      h.Y(y),
                      h.Style({
                        'text-anchor': 'end',
                        'dominant-baseline': 'middle',
                        'font-size': '10px',
                        fill: '#94a3b8',
                        'font-family': 'inherit',
                      }),
                    ],
                    [String(tick)],
                  ),
                ],
              );
            }),
          ),
          // X axis category labels
          h.g(
            [],
            series.map((sr) => {
              const cx = n(xScale.position(sr.label) + boxW / 2);
              return h.text(
                [
                  h.X(cx),
                  h.Y(String(PH + 18)),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '11px',
                    fill: '#64748b',
                    'font-family': 'inherit',
                  }),
                ],
                [sr.label],
              );
            }),
          ),
          // Y axis label
          ...(cfg.yLabel
            ? [
                h.text(
                  [
                    h.Transform(`translate(${-ML + 12},${PH / 2}) rotate(-90)`),
                    h.Style({
                      'text-anchor': 'middle',
                      'font-size': '10px',
                      fill: '#94a3b8',
                      'font-family': 'inherit',
                    }),
                  ],
                  [cfg.yLabel],
                ),
              ]
            : []),
          // boxes
          h.g([], boxes),
        ],
      ),
      tooltip,
    ],
  );
}
