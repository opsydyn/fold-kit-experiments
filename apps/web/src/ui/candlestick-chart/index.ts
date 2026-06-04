import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type Candle = Readonly<{
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
}>;

export type Config = Readonly<{
  upColor: string;
  downColor: string;
  tickCount: number;
}>;

export type InitConfig = Readonly<{
  candles: ReadonlyArray<Candle>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

const DEFAULT_CONFIG: Config = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  tickCount: 5,
};

export type Model = Readonly<{
  candles: ReadonlyArray<Candle>;
  activeIndex: Option.Option<number>;
  config: Config;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 15, right: 20, bottom: 30, left: 48, ...cfg.margins },
  );
  return [
    {
      candles: cfg.candles,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredCandle = m('HoveredCandle', { index: Schema.Number });
export const BlurredCandle = m('BlurredCandle', {});

export const Message = Schema.Union([HoveredCandle, BlurredCandle]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCandle: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredCandle: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

const n = (v: number) => String(Math.round(v * 100) / 100);

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Candlestick chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { candles, activeIndex, config: cfg } = model;

  const allLows = candles.map((c) => c.low);
  const allHighs = candles.map((c) => c.high);
  const yMin = Math.min(...allLows);
  const yMax = Math.max(...allHighs);
  const yPad = (yMax - yMin) * 0.08;
  const yDomain: readonly [number, number] = [yMin - yPad, yMax + yPad];

  const xScale = band({
    domain: candles.map((c) => c.label),
    range: [0, PW],
    paddingInner: 0.2,
    paddingOuter: 0.1,
  });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const bodyW = xScale.bandwidth;
  const activeIdx = Option.getOrElse(activeIndex, () => -1);

  const candleElements = candles.map((c, i) => {
    const isUp = c.close >= c.open;
    const color = isUp ? cfg.upColor : cfg.downColor;
    const isActive = i === activeIdx;
    const opacity = activeIdx === -1 || isActive ? '1' : '0.4';

    const cx = xScale.position(c.label) + bodyW / 2;
    const bodyTop = Math.min(yScale(c.open), yScale(c.close));
    const bodyBot = Math.max(yScale(c.open), yScale(c.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);

    return h.g(
      [
        h.Style({ cursor: 'pointer' }),
        h.OnMouseEnter(toParentMessage(HoveredCandle({ index: i }))),
        h.OnMouseLeave(toParentMessage(BlurredCandle({}))),
      ],
      [
        // wick
        h.line(
          [
            h.X1(n(cx)),
            h.Y1(n(yScale(c.high))),
            h.X2(n(cx)),
            h.Y2(n(yScale(c.low))),
            h.Stroke(color),
            h.StrokeWidth('1.5'),
            h.Attribute('opacity', opacity),
          ],
          [],
        ),
        // body
        h.rect(
          [
            h.X(n(cx - bodyW / 2)),
            h.Y(n(bodyTop)),
            h.Width(n(bodyW)),
            h.Height(n(bodyH)),
            h.Fill(isUp ? color : color),
            h.Stroke(color),
            h.StrokeWidth('1'),
            h.Attribute('opacity', opacity),
            h.Attribute('rx', '1'),
          ],
          [],
        ),
      ],
    );
  });

  const tooltip = Option.match(activeIndex, {
    onNone: () => h.g([], []),
    onSome: (i) => {
      const c = candles[i];
      if (!c) return h.g([], []);
      const isUp = c.close >= c.open;
      const color = isUp ? cfg.upColor : cfg.downColor;
      const change = ((c.close - c.open) / c.open) * 100;
      const sign = change >= 0 ? '+' : '';
      const lines = [
        `O ${c.open.toFixed(2)}  H ${c.high.toFixed(2)}`,
        `L ${c.low.toFixed(2)}  C ${c.close.toFixed(2)}`,
        `${sign}${change.toFixed(2)}%`,
      ];
      return h.g(
        [h.Transform(`translate(${ML + 4},${MT + 2})`)],
        lines.map((line, li) =>
          h.text(
            [
              h.X('0'),
              h.Y(String(li * 13)),
              h.Fill(li === 2 ? color : '#64748b'),
              h.Style({ 'font-size': '10px', 'font-family': 'inherit' }),
            ],
            [line],
          ),
        ),
      );
    },
  });

  // X axis: show every 5th label to avoid crowding
  const xLabelStep = Math.ceil(candles.length / 6);

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
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
        // X axis date labels (every nth)
        h.g(
          [],
          candles
            .filter((_, i) => i % xLabelStep === 0 || i === candles.length - 1)
            .map((c) =>
              h.text(
                [
                  h.X(n(xScale.position(c.label) + bodyW / 2)),
                  h.Y(String(PH + 14)),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '9px',
                    fill: '#94a3b8',
                    'font-family': 'inherit',
                  }),
                ],
                [c.label],
              ),
            ),
        ),
        // candles
        h.g([], candleElements),
      ],
    ),
    tooltip,
  ]);
}
