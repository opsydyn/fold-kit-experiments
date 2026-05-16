import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type Bar = Readonly<{ label: string; value: number }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  paddingInner: number;
  paddingOuter: number;
  tickCount: number;
}>;

export type Model = Readonly<{
  bars: ReadonlyArray<Bar>;
  activeIndex: Option.Option<number>;
  config: Config;
}>;

export type InitConfig = Readonly<{
  bars: ReadonlyArray<Bar>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#6366f1',
  activeColor: '#4338ca',
  paddingInner: 0.25,
  paddingOuter: 0.15,
  tickCount: 5,
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      bars: cfg.bars,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
    },
    [],
  ];
}

// MESSAGE

export const HoveredBar = m('HoveredBar', { index: Schema.Number });
export const BlurredBar = m('BlurredBar', {});
export const ClickedBar = m('ClickedBar', { index: Schema.Number });
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const Message = Schema.Union([HoveredBar, BlurredBar, ClickedBar, PressedKeyNav]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredBar: () => [{ ...model, activeIndex: Option.none() }, []],
      ClickedBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      PressedKeyNav: ({ direction }) => {
        const n = model.bars.length;
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
const MR = 16;
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
  const { model, toParentMessage, ariaLabel = 'Bar chart' } = config;
  const { bars, activeIndex, config: cfg } = model;

  const maxValue = bars.reduce((acc, b) => Math.max(acc, b.value), 0);
  const yDomain: readonly [number, number] = [0, maxValue * 1.1];
  const xDomain = bars.map((b) => b.label);

  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const xScale = band({
    domain: xDomain,
    range: [0, PW],
    paddingInner: cfg.paddingInner,
    paddingOuter: cfg.paddingOuter,
  });
  const ticks = linearTicks(yDomain, cfg.tickCount);

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
          // Y gridlines + ticks
          h.g(
            [],
            ticks.map((tick) => {
              const y = r3(yScale(tick));
              return h.g(
                [h.Transform(`translate(0,${y})`)],
                [
                  h.line(
                    [
                      h.X1('0'),
                      h.Y1('0'),
                      h.X2(String(PW)),
                      h.Y2('0'),
                      h.Stroke('#e5e5e5'),
                      h.StrokeWidth('1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('-8'),
                      h.Y('0'),
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

          // Bars
          h.g(
            [],
            bars.map((bar, i) => {
              const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
              const bx = r3(xScale.position(bar.label));
              const bw = r3(xScale.bandwidth);
              const by = r3(yScale(bar.value));
              const bh = r3(PH - yScale(bar.value));
              return h.g(
                [
                  h.OnMouseEnter(toParentMessage(HoveredBar({ index: i }))),
                  h.OnMouseLeave(toParentMessage(BlurredBar({}))),
                  h.OnClick(toParentMessage(ClickedBar({ index: i }))),
                  h.Style({ cursor: 'pointer' }),
                  h.AriaLabel(`${bar.label}: ${bar.value}`),
                ],
                [
                  h.rect(
                    [
                      h.X(String(bx)),
                      h.Y(String(by)),
                      h.Width(String(bw)),
                      h.Height(String(bh)),
                      h.Fill(isActive ? cfg.activeColor : cfg.color),
                      h.Style({ transition: 'fill 120ms' }),
                    ],
                    [],
                  ),
                  ...(isActive
                    ? [
                        h.text(
                          [
                            h.X(String(r3(bx + bw / 2))),
                            h.Y(String(r3(by - 6))),
                            h.Style({
                              'text-anchor': 'middle',
                              'dominant-baseline': 'auto',
                              'font-size': '0.75rem',
                              'font-weight': '600',
                              fill: cfg.activeColor,
                            }),
                          ],
                          [String(bar.value)],
                        ),
                      ]
                    : []),
                ],
              );
            }),
          ),

          // X axis line
          h.line(
            [
              h.X1('0'),
              h.Y1(String(PH)),
              h.X2(String(PW)),
              h.Y2(String(PH)),
              h.Stroke('#d4d4d4'),
              h.StrokeWidth('1'),
            ],
            [],
          ),

          // X axis labels
          h.g(
            [h.Transform(`translate(0,${PH})`)],
            bars.map((bar) =>
              h.text(
                [
                  h.X(String(r3(xScale.position(bar.label) + xScale.bandwidth / 2))),
                  h.Y('16'),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '0.75rem',
                    fill: '#555',
                  }),
                ],
                [bar.label],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};
