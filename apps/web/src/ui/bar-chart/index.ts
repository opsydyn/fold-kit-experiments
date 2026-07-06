import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Effect, Match, Option, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import {
  arrowKeyNav,
  makeLayout,
  nearestIndex,
  nextIndex,
  r3,
  svgRoot,
  valueTooltip,
  withAccessibleTable,
  withAriaLive,
  xCategoryAxis,
  yGridlines,
} from '../shared';

// MODEL

export type Bar = Readonly<{ label: string; value: number }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  paddingInner: number;
  paddingOuter: number;
  tickCount: number;
}>;

type ChartBounds = Readonly<{ screenLeft: number; renderedPW: number }>;

export type Model = Readonly<{
  bars: ReadonlyArray<Bar>;
  activeIndex: Option.Option<number>;
  config: Config;
  readonly layout: Layout;
  svgBounds: Option.Option<ChartBounds>;
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
      svgBounds: Option.none(),
    },
    [],
  ];
}

// MESSAGE

export const HoveredBar = m('HoveredBar', { index: Schema.Number });
export const BlurredBar = m('BlurredBar', {});
export const ClickedBar = m('ClickedBar', { index: Schema.Number });
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });
export const RecordedChartBounds = m('RecordedChartBounds', {
  screenLeft: Schema.Number,
  renderedPW: Schema.Number,
});

export const UpdatedBars = m('UpdatedBars', { bars: Schema.Unknown });
export const Message = Schema.Union([
  HoveredBar,
  BlurredBar,
  ClickedBar,
  PressedKeyNav,
  RecordedChartBounds,
  UpdatedBars,
]);
export type Message = typeof Message.Type;

// MOUNT

export const CaptureChartBounds = Mount.define(
  'CaptureChartBounds',
  RecordedChartBounds,
)((element) =>
  Effect.sync(() => {
    const rect = element.getBoundingClientRect();
    return RecordedChartBounds({ screenLeft: rect.left + window.screenX, renderedPW: rect.width });
  }),
);

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredBar: () => [{ ...model, activeIndex: Option.none() }, []],
      ClickedBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      RecordedChartBounds: ({ screenLeft, renderedPW }) => [
        { ...model, svgBounds: Option.some({ screenLeft, renderedPW }) },
        [],
      ],
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
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
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

  const activeBar = Option.isSome(activeIndex) ? bars[activeIndex.value] : undefined;
  const liveText = activeBar ? `${activeBar.label}: ${activeBar.value}` : '';
  const barCenters = bars.map((bar) => r3(xScale.position(bar.label) + xScale.bandwidth / 2));

  return withAccessibleTable(
    h,
    withAriaLive(
      h,
      svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, [
        h.g(
          [h.Transform(`translate(${ML},${MT})`)],
          [
            yGridlines(h, ticks, (v) => yScale(v), PW),

            // Bars (visual only — pointer events handled by overlay)
            h.g(
              [],
              bars.map((bar, i) => {
                const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
                const bx = r3(xScale.position(bar.label));
                const bw = r3(xScale.bandwidth);
                const by = r3(yScale(bar.value));
                const bh = r3(PH - yScale(bar.value));
                return h.g(
                  [h.Style({ cursor: 'pointer' }), h.AriaLabel(`${bar.label}: ${bar.value}`)],
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
                  ],
                );
              }),
            ),

            // Active bar tooltip
            ...Option.match(activeIndex, {
              onNone: () => [],
              onSome: ({ value: i }) => {
                const bar = bars[i];
                if (bar === undefined) return [];
                const bx = r3(xScale.position(bar.label));
                const bw = r3(xScale.bandwidth);
                const by = r3(yScale(bar.value));
                return [
                  renderTooltip
                    ? renderTooltip(bar, bx + bw / 2, by)
                    : valueTooltip(h, bx + bw / 2, by, String(bar.value), {
                        color: cfg.activeColor,
                      }),
                ];
              },
            }),

            // Cursor-tracking overlay — single hit rect, nearestIndex finds the active bar
            h.rect(
              [
                h.X('0'),
                h.Y('0'),
                h.Width(String(PW)),
                h.Height(String(PH)),
                h.Fill('transparent'),
                h.Style({ cursor: 'pointer' }),
                h.OnMount(Mount.mapMessage(CaptureChartBounds(), toParentMessage)),
                h.OnPointerMove((screenX, _screenY, _pointerType) => {
                  if (Option.isNone(model.svgBounds)) return Option.none();
                  const { screenLeft, renderedPW: rPW } = model.svgBounds.value;
                  const plotX = (screenX - screenLeft) * (PW / rPW);
                  const idx = nearestIndex(barCenters, plotX);
                  return idx >= 0
                    ? Option.some(toParentMessage(HoveredBar({ index: idx })))
                    : Option.none();
                }),
                h.OnPointerLeave((_pointerType) => Option.some(toParentMessage(BlurredBar()))),
                h.OnClick(
                  Option.isSome(activeIndex)
                    ? toParentMessage(ClickedBar({ index: activeIndex.value }))
                    : toParentMessage(BlurredBar()),
                ),
              ],
              [],
            ),

            xCategoryAxis(h, xDomain, (l) => xScale.position(l), xScale.bandwidth, PH, PW),
          ],
        ),
      ]),
      liveText,
    ),
    ariaLabel,
    ['Label', 'Value'],
    bars.map((b) => [b.label, String(b.value)]),
  );
};
