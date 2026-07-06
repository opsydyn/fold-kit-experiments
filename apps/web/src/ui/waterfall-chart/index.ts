import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type EntryType = 'total' | 'delta';

export type WaterfallEntry = Readonly<{
  label: string;
  value: number;
  type: EntryType;
}>;

type ComputedBar = Readonly<{
  label: string;
  type: EntryType;
  value: number;
  base: number;
  top: number;
  runningAfter: number;
}>;

export type Config = Readonly<{
  upColor: string;
  downColor: string;
  totalColor: string;
  tickCount: number;
}>;

export type InitConfig = Readonly<{
  entries: ReadonlyArray<WaterfallEntry>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

const DEFAULT_CONFIG: Config = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  totalColor: '#6366f1',
  tickCount: 5,
};

function computeBars(entries: ReadonlyArray<WaterfallEntry>): ReadonlyArray<ComputedBar> {
  let running = 0;
  return entries.map((e) => {
    if (e.type === 'total') {
      running = e.value;
      return {
        label: e.label,
        type: e.type,
        value: e.value,
        base: 0,
        top: e.value,
        runningAfter: e.value,
      };
    }
    const base = running;
    running += e.value;
    return {
      label: e.label,
      type: e.type,
      value: e.value,
      base,
      top: running,
      runningAfter: running,
    };
  });
}

export type Model = Readonly<{
  entries: ReadonlyArray<WaterfallEntry>;
  bars: ReadonlyArray<ComputedBar>;
  activeIndex: Option.Option<number>;
  config: Config;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 15, right: 20, bottom: 35, left: 48, ...cfg.margins },
  );
  return [
    {
      entries: cfg.entries,
      bars: computeBars(cfg.entries),
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredBar = m('HoveredBar', { index: Schema.Number });
export const BlurredBar = m('BlurredBar', {});

export const Message = Schema.Union([HoveredBar, BlurredBar]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredBar: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

const p = (v: number) => String(Math.round(v * 100) / 100);

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Waterfall chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { bars, activeIndex, config: cfg } = model;

  const allY = bars.flatMap((b) => [b.base, b.top, 0]);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const yPad = (yMax - yMin) * 0.08;
  const yDomain: readonly [number, number] = [Math.min(0, yMin - yPad), yMax + yPad];

  const xScale = band({
    domain: bars.map((b) => b.label),
    range: [0, PW],
    paddingInner: 0.2,
    paddingOuter: 0.1,
  });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const bw = xScale.bandwidth;
  const step = xScale.step;
  const activeIdx = Option.getOrElse(activeIndex, () => -1);

  const barColor = (b: ComputedBar) =>
    b.type === 'total' ? cfg.totalColor : b.value >= 0 ? cfg.upColor : cfg.downColor;

  const barElements = bars.map((b, i) => {
    const x = xScale.position(b.label);
    const yTop = yScale(Math.max(b.base, b.top));
    const yBot = yScale(Math.min(b.base, b.top));
    const bh = Math.max(1, yBot - yTop);
    const color = barColor(b);
    const opacity = activeIdx === -1 || i === activeIdx ? '1' : '0.35';

    // connector to next bar: horizontal line at runningAfter level
    const connector =
      i < bars.length - 1
        ? h.line(
            [
              h.X1(p(x + bw)),
              h.Y1(p(yScale(b.runningAfter))),
              h.X2(p(x + step)),
              h.Y2(p(yScale(b.runningAfter))),
              h.Stroke('#94a3b8'),
              h.StrokeWidth('1'),
              h.Attribute('stroke-dasharray', '3 2'),
              h.Attribute('opacity', '0.6'),
            ],
            [],
          )
        : h.g([], []);

    return h.g(
      [
        h.Style({ cursor: 'pointer' }),
        h.OnMouseEnter(toParentMessage(HoveredBar({ index: i }))),
        h.OnMouseLeave(toParentMessage(BlurredBar())),
      ],
      [
        connector,
        h.rect(
          [
            h.X(p(x)),
            h.Y(p(yTop)),
            h.Width(p(bw)),
            h.Height(p(bh)),
            h.Fill(color),
            h.Stroke(color),
            h.StrokeWidth('0.5'),
            h.Attribute('opacity', opacity),
            h.Attribute('rx', '2'),
          ],
          [],
        ),
      ],
    );
  });

  const tooltip = Option.match(activeIndex, {
    onNone: () => h.g([], []),
    onSome: (i) => {
      const b = bars[i];
      if (!b) return h.g([], []);
      const sign = b.value >= 0 ? '+' : '';
      const isTotal = b.type === 'total';
      const color = barColor(b);
      const lines = isTotal
        ? [`${b.label}  ${b.value.toFixed(0)}`]
        : [`${b.label}  ${sign}${b.value.toFixed(0)}`, `Running  ${b.runningAfter.toFixed(0)}`];
      return h.g(
        [h.Transform(`translate(${ML + 4},${MT + 2})`)],
        lines.map((line, li) =>
          h.text(
            [
              h.X('0'),
              h.Y(String(li * 13)),
              h.Fill(li === 0 ? color : '#64748b'),
              h.Style({ 'font-size': '10px', 'font-family': 'inherit' }),
            ],
            [line],
          ),
        ),
      );
    },
  });

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Y gridlines + tick labels
        h.g(
          [],
          yTicks.map((tick) => {
            const y = p(yScale(tick));
            return h.g(
              [],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1(y),
                    h.X2(String(PW)),
                    h.Y2(y),
                    h.Stroke('var(--chart-grid, #2d2d2d)'),
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
        // zero baseline
        h.line(
          [
            h.X1('0'),
            h.Y1(p(yScale(0))),
            h.X2(String(PW)),
            h.Y2(p(yScale(0))),
            h.Stroke('var(--chart-axis, #3a3a3a)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),
        // X category labels
        h.g(
          [],
          bars.map((b) =>
            h.text(
              [
                h.X(p(xScale.position(b.label) + bw / 2)),
                h.Y(String(PH + 16)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '9.5px',
                  fill: '#64748b',
                  'font-family': 'inherit',
                }),
              ],
              [b.label],
            ),
          ),
        ),
        // bars + connectors
        h.g([], barElements),
      ],
    ),
    tooltip,
  ]);
}
