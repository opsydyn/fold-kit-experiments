import { arc } from '@opsydyn/foldkit-viz/shape/arc';
import { Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type Threshold = Readonly<{ at: number; color: string }>;

export type GaugeEntry = Readonly<{
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  thresholds: ReadonlyArray<Threshold>;
}>;

export type Config = Readonly<{
  trackColor: string;
}>;

export type InitConfig = Readonly<{
  entries: ReadonlyArray<GaugeEntry>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  trackColor: '#e2e8f0',
};

export type Model = Readonly<{
  entries: ReadonlyArray<GaugeEntry>;
  config: Config;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      entries: cfg.entries,
      config: { ...DEFAULT_CONFIG, ...cfg.config },
    },
    [],
  ];
}

// MESSAGE — gauge is a display-only component; NoOp satisfies the TEA contract

export const NoOp = m('NoOp', {});
export const Message = Schema.Union([NoOp]);
export type Message = typeof Message.Type;

export function update(model: Model, _msg: Message): readonly [Model, readonly []] {
  return [model, []];
}

// VIEW

// 270° arc: from -3π/4 (lower-left) clockwise to 3π/4 (lower-right), open at the bottom
const GAUGE_START = (-3 * Math.PI) / 4;
const GAUGE_END = (3 * Math.PI) / 4;
const GAUGE_SPAN = GAUGE_END - GAUGE_START;

function fillColor(
  value: number,
  min: number,
  max: number,
  thresholds: ReadonlyArray<Threshold>,
): string {
  const pct = (value - min) / (max - min);
  let color = thresholds[0]?.color ?? '#6366f1';
  for (const t of thresholds) {
    const tPct = (t.at - min) / (max - min);
    if (pct >= tPct) color = t.color;
  }
  return color;
}

const W = 480;
const H = 265;

// Layout: up to 3 gauges side-by-side. Single gauge centred.
function gaugeLayout(
  count: number,
): ReadonlyArray<{ cx: number; cy: number; outerR: number; innerR: number }> {
  if (count === 1) return [{ cx: 240, cy: 148, outerR: 115, innerR: 78 }];
  if (count === 2)
    return [
      { cx: 130, cy: 148, outerR: 100, innerR: 66 },
      { cx: 350, cy: 148, outerR: 100, innerR: 66 },
    ];
  return [
    { cx: 82, cy: 155, outerR: 72, innerR: 48 },
    { cx: 240, cy: 155, outerR: 72, innerR: 48 },
    { cx: 398, cy: 155, outerR: 72, innerR: 48 },
  ];
}

// D3 angle convention (0 = top, clockwise): sin gives x, -cos gives y
function arcCapPos(
  cx: number,
  cy: number,
  midR: number,
  angle: number,
): readonly [number, number] {
  return [cx + midR * Math.sin(angle), cy - midR * Math.cos(angle)];
}

function renderGauge<M>(
  h: ReturnType<typeof html<M>>,
  entry: GaugeEntry,
  layout: { cx: number; cy: number; outerR: number; innerR: number },
  cfg: Config,
): Html {
  const { label, sublabel, value, min, max, thresholds } = entry;
  const { cx, cy, outerR, innerR } = layout;

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillEnd = GAUGE_START + t * GAUGE_SPAN;
  const color = fillColor(value, min, max, thresholds);
  const midR = (outerR + innerR) / 2;
  const capR = (outerR - innerR) / 2;

  // cornerRadius must be 0 — non-zero causes NaN in cornerTangents when padAngle=0
  const trackPath = arc({
    innerRadius: innerR,
    outerRadius: outerR,
    startAngle: GAUGE_START,
    endAngle: GAUGE_END,
  });

  const fillPath =
    t > 0
      ? arc({
          innerRadius: innerR,
          outerRadius: outerR,
          startAngle: GAUGE_START,
          endAngle: fillEnd,
        })
      : null;

  // Rounded end-caps: circles at midR on the fill arc endpoints
  const [capStartX, capStartY] = arcCapPos(cx, cy, midR, GAUGE_START);
  const [capEndX, capEndY] = arcCapPos(cx, cy, midR, fillEnd);

  // tick marks at 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const angle = GAUGE_START + pct * GAUGE_SPAN;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const r0 = outerR + 4;
    const r1 = outerR + 11;
    return h.line(
      [
        h.X1(String(Math.round((cx + r0 * sin) * 10) / 10)),
        h.Y1(String(Math.round((cy - r0 * cos) * 10) / 10)),
        h.X2(String(Math.round((cx + r1 * sin) * 10) / 10)),
        h.Y2(String(Math.round((cy - r1 * cos) * 10) / 10)),
        h.Stroke('#cbd5e1'),
        h.StrokeWidth('1.5'),
        h.Attribute('stroke-linecap', 'round'),
      ],
      [],
    );
  });

  const valueFontSize = outerR >= 100 ? '2.4rem' : outerR >= 80 ? '1.8rem' : '1.3rem';
  const labelFontSize = outerR >= 100 ? '0.75rem' : '0.65rem';

  return h.g(
    [],
    [
      // track
      h.path([h.D(trackPath), h.Fill(cfg.trackColor), h.Transform(`translate(${cx},${cy})`)], []),
      // fill + rounded end-caps
      ...(fillPath
        ? [
            h.path([h.D(fillPath), h.Fill(color), h.Transform(`translate(${cx},${cy})`)], []),
            h.circle(
              [h.Cx(String(capStartX)), h.Cy(String(capStartY)), h.R(String(capR)), h.Fill(color)],
              [],
            ),
            h.circle(
              [h.Cx(String(capEndX)), h.Cy(String(capEndY)), h.R(String(capR)), h.Fill(color)],
              [],
            ),
          ]
        : []),
      // ticks
      h.g([], ticks),
      // value label
      h.text(
        [
          h.X(String(cx)),
          h.Y(String(cy)),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': valueFontSize,
            'font-weight': '700',
            fill: color,
            'font-family': 'inherit',
          }),
        ],
        [String(value)],
      ),
      // title label
      h.text(
        [
          h.X(String(cx)),
          h.Y(String(cy + outerR * 0.28)),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'hanging',
            'font-size': labelFontSize,
            'font-weight': '600',
            fill: '#475569',
            'font-family': 'inherit',
          }),
        ],
        [label],
      ),
      // sublabel
      h.text(
        [
          h.X(String(cx)),
          h.Y(String(cy + outerR * 0.28 + (outerR >= 100 ? 16 : 13))),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'hanging',
            'font-size': outerR >= 100 ? '0.65rem' : '0.6rem',
            fill: '#94a3b8',
            'font-family': 'inherit',
          }),
        ],
        [sublabel],
      ),
      // min label
      h.text(
        [
          h.X(String(Math.round(cx + (outerR + 14) * Math.sin(GAUGE_START)))),
          h.Y(String(Math.round(cy - (outerR + 14) * Math.cos(GAUGE_START)))),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '9px',
            fill: '#94a3b8',
            'font-family': 'inherit',
          }),
        ],
        [String(min)],
      ),
      // max label
      h.text(
        [
          h.X(String(Math.round(cx + (outerR + 14) * Math.sin(GAUGE_END)))),
          h.Y(String(Math.round(cy - (outerR + 14) * Math.cos(GAUGE_END)))),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '9px',
            fill: '#94a3b8',
            'font-family': 'inherit',
          }),
        ],
        [String(max)],
      ),
    ],
  );
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, ariaLabel = 'Gauge chart' } = config;
  const { entries, config: cfg } = model;

  const layouts = gaugeLayout(entries.length);

  return svgRoot(h, { width: W, height: H, ariaLabel }, null,
    entries.map((entry, i) => {
      const layout = layouts[i] ?? layouts[0];
      return layout ? renderGauge(h, entry, layout, cfg) : h.g([], []);
    }),
  );
}
