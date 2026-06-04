import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { arrowKeyNav, nextIndex, r3, svgRoot, valueTooltip, xCategoryAxis, yGridlines, makeLayout } from '../shared';
import type { Dims, Layout, Margins } from '../shared';

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
  readonly layout: Layout;
}>;

export type InitConfig = Readonly<{
  bars: ReadonlyArray<Bar>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#6366f1',
  activeColor: '#4338ca',
  paddingInner: 0.25,
  paddingOuter: 0.15,
  tickCount: 5,
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 280, ...cfg.dims },
    { top: 24, right: 16, bottom: 44, left: 44, ...cfg.margins },
  );
  return [
    {
      bars: cfg.bars,
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
export const ClickedBar = m('ClickedBar', { index: Schema.Number });
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const UpdatedBars = m('UpdatedBars', { bars: Schema.Unknown });
export const Message = Schema.Union([HoveredBar, BlurredBar, ClickedBar, PressedKeyNav, UpdatedBars]);
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
      UpdatedBars: ({ bars }) => [{ ...model, bars: bars as ReadonlyArray<Bar> }, []],
      PressedKeyNav: ({ direction }) => {
        const n = model.bars.length;
        const current = Option.isSome(model.activeIndex) ? model.activeIndex.value : -1;
        return [{ ...model, activeIndex: Option.some(nextIndex(n, current, direction)) }, []];
      },
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
  renderTooltip?: (datum: Bar, x: number, y: number) => Html;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Bar chart', renderTooltip } = config;
  const { dims: { width: W, height: H }, margins: { top: MT, left: ML }, pw: PW, ph: PH } = model.layout;
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

  const handleKeyDown = (key: string) =>
    arrowKeyNav(key, (dir) => toParentMessage(PressedKeyNav({ direction: dir })));

  return svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        yGridlines(h, ticks, (v) => yScale(v), PW),

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
                    h.X(String(bx)), h.Y(String(by)),
                    h.Width(String(bw)), h.Height(String(bh)),
                    h.Fill(isActive ? cfg.activeColor : cfg.color),
                    h.Style({ transition: 'fill 120ms' }),
                  ],
                  [],
                ),
                ...(isActive
                  ? [(renderTooltip
                      ? renderTooltip(bar, bx + bw / 2, by)
                      : valueTooltip(h, bx + bw / 2, by, String(bar.value), { color: cfg.activeColor }))]
                  : []),
              ],
            );
          }),
        ),

        xCategoryAxis(h, xDomain, (l) => xScale.position(l), xScale.bandwidth, PH, PW),
      ],
    ),
  ]);
};
