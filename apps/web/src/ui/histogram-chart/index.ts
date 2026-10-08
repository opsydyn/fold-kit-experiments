import { type Bin, bin } from '@opsydyn/foldkit-viz/math/bin';
import {
  BRUSH_IDLE,
  type BrushState,
  brushDomain,
  brushExtent,
  brushUpdate,
  ClearedBrush,
  EndedBrush,
  MovedBrush,
  StartedBrush,
} from '@opsydyn/foldkit-viz/math/brush';
import { linear, linearInvertible, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Effect, Option, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { withOutMessage } from 'foldkit/update';
import type { Return as UpdateReturn, ReturnWithOutMessage } from 'foldkit/update';

import {
  type Dims,
  type Layout,
  type Margins,
  arrowKeyNav,
  layoutFor,
  nextIndex,
  r3,
  svgRoot,
  valueTooltip,
  withAccessibleTable,
  withAriaLive,
  yGridlines,
} from '../shared';
import { widthChanges } from '../shared/plot-events';

// MODEL

export type HistogramDatum = Readonly<{ value: number; label?: string }>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<HistogramDatum>;
  binCount?: number;
  color?: string;
  xLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
  enableBrush?: boolean;
}>;

export type ComputedBin = Readonly<{
  x0: number;
  x1: number;
  count: number;
}>;

export type SvgBounds = Readonly<{ clientLeft: number; renderedPW: number }>;

export type Model = Readonly<{
  bins: ReadonlyArray<ComputedBin>;
  totalCount: number;
  color: string;
  xLabel: string;
  activeBin: Option.Option<number>;
  readonly layout: Layout;
  enableBrush: boolean;
  brush: BrushState;
  svgBounds: Option.Option<SvgBounds>;
  brushDragStart: Option.Option<Readonly<{ anchorClientX: number; anchorScreenX: number }>>;
}>;

export function init(cfg: InitConfig): UpdateReturn<Model, Message> {
  const binCount = cfg.binCount ?? 10;
  const rawBins: ReadonlyArray<Bin<HistogramDatum>> = bin(cfg.data, {
    value: (d) => d.value,
    thresholds: binCount,
  });

  const bins: ReadonlyArray<ComputedBin> = rawBins.map((b) => ({
    x0: b.x0,
    x1: b.x1,
    count: b.count,
  }));
  const layout = layoutFor(
    { width: 480, height: 265, ...cfg.dims },
    { top: 24, right: 20, bottom: 48, left: 44, ...cfg.margins },
  );

  return {
    model: {
      bins,
      totalCount: cfg.data.length,
      color: cfg.color ?? '#6366f1',
      xLabel: cfg.xLabel ?? '',
      activeBin: Option.none(),
      layout,
      enableBrush: cfg.enableBrush ?? false,
      brush: BRUSH_IDLE,
      svgBounds: Option.none(),
      brushDragStart: Option.none(),
    },
  };
}

// MESSAGE

export const Message = defineMessageUnion({
  PressedKeyNav: { direction: Schema.String },
  RecordedChartWidth: { width: Schema.Number },
  HoveredBin: { index: Schema.Number },
  BlurredBin: {},
  RecordedSvgBounds: {
    clientLeft: Schema.Number,
    renderedPW: Schema.Number,
  },
  StartedHistogramBrush: {
    screenX: Schema.Number,
    clientX: Schema.Number,
  },
  MovedHistogramBrush: { screenX: Schema.Number },
  EndedHistogramBrush: { screenX: Schema.Number },
  ClearedHistogramBrush: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  InspectedRange: {
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
    includeEnd: Schema.Boolean,
  },
  ClearedInspection: {},
});
export type OutMessage = typeof OutMessage.Type;

// MOUNT

export const CaptureSvgBounds = Mount.define('CaptureSvgBounds', {
  messages: [Message.RecordedSvgBounds],
  execute: ({ element }) =>
    Effect.sync(() => {
      const rect = element.getBoundingClientRect();
      return Message.RecordedSvgBounds({ clientLeft: rect.left, renderedPW: rect.width });
    }),
});

export const ObserveChartWidth = Mount.defineStream('ObserveHistogramChartWidth', {
  messages: [Message.RecordedChartWidth],
  execute: ({ element }) =>
    widthChanges(element).pipe(Stream.map((width) => Message.RecordedChartWidth({ width }))),
});

// UPDATE

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

function computePlotX(svgBounds: Option.Option<SvgBounds>, PW: number, clientX: number): number {
  return Option.match(svgBounds, {
    onNone: () => 0,
    onSome: ({ clientLeft, renderedPW }) =>
      Math.max(0, Math.min(PW, (clientX - clientLeft) * (PW / renderedPW))),
  });
}

function computeMovePlotX(model: Model, screenX: number): number {
  return Option.match(model.brushDragStart, {
    onNone: () => model.brush.extent,
    onSome: ({ anchorClientX, anchorScreenX }) =>
      computePlotX(model.svgBounds, model.layout.pw, anchorClientX + (screenX - anchorScreenX)),
  });
}

export const update = (model: Model, msg: Message): Return =>
  Message.match<Return>(msg, {
    PressedKeyNav: ({ direction }) => {
      if (model.bins.length === 0) return { model };
      const current = Option.getOrElse(model.activeBin, () => -1);
      return update(
        model,
        Message.HoveredBin({ index: nextIndex(model.bins.length, current, direction) }),
      );
    },
    RecordedChartWidth: ({ width }) => {
      if (!Number.isFinite(width) || width <= 0 || width === model.layout.dims.width)
        return { model };
      return {
        model: {
          ...model,
          layout: layoutFor({ ...model.layout.dims, width }, model.layout.margins),
        },
      };
    },
    HoveredBin: ({ index }) => {
      const selected = model.bins[index];
      if (selected === undefined)
        return withOutMessage<Model, Message, OutMessage>(
          { model: { ...model, activeBin: Option.none() } },
          OutMessage.ClearedInspection(),
        );
      return withOutMessage<Model, Message, OutMessage>(
        { model: { ...model, activeBin: Option.some(index) } },
        OutMessage.InspectedRange({
          domain: [selected.x0, selected.x1],
          includeEnd: index === model.bins.length - 1,
        }),
      );
    },
    BlurredBin: () =>
      withOutMessage<Model, Message, OutMessage>(
        { model: { ...model, activeBin: Option.none() } },
        OutMessage.ClearedInspection(),
      ),
    RecordedSvgBounds: ({ clientLeft, renderedPW }) => ({
      model: { ...model, svgBounds: Option.some({ clientLeft, renderedPW }) },
    }),
    StartedHistogramBrush: ({ screenX, clientX }) => {
      const plotX = computePlotX(model.svgBounds, model.layout.pw, clientX);
      return {
        model: {
          ...model,
          brush: brushUpdate(model.brush, StartedBrush(plotX)),
          brushDragStart: Option.some({ anchorClientX: clientX, anchorScreenX: screenX }),
        },
      };
    },
    MovedHistogramBrush: ({ screenX }) => {
      if (!model.brush.active) return { model: model };
      const plotX = computeMovePlotX(model, screenX);
      return { model: { ...model, brush: brushUpdate(model.brush, MovedBrush(plotX)) } };
    },
    EndedHistogramBrush: ({ screenX }) => {
      const plotX = computeMovePlotX(model, screenX);
      return {
        model: {
          ...model,
          brush: brushUpdate(model.brush, EndedBrush(plotX)),
          brushDragStart: Option.none(),
        },
      };
    },
    ClearedHistogramBrush: () => ({
      model: {
        ...model,
        brush: brushUpdate(model.brush, ClearedBrush()),
        brushDragStart: Option.none(),
      },
    }),
  });

// QUERY

/** Returns the brush selection as domain [lo, hi] values, or Option.none() if no selection. */
export function getBrushDomain(model: Model): Option.Option<readonly [number, number]> {
  if (!model.enableBrush || model.bins.length === 0) return Option.none();
  const ext = brushExtent(model.brush);
  if (ext === null) return Option.none();
  const domainMin = model.bins[0]?.x0 ?? 0;
  const domainMax = model.bins[model.bins.length - 1]?.x1 ?? 1;
  const xScale = linearInvertible({ domain: [domainMin, domainMax], range: [0, model.layout.pw] });
  const domain = brushDomain(model.brush, xScale.invert);
  return domain === null ? Option.none() : Option.some(domain);
}

// VIEW

export function view<M>(
  config: {
    model: Model;
    toParentMessage: (msg: Message) => M;
    ariaLabel?: string;
    highlightedBins?: ReadonlyArray<number>;
    renderTooltip?: (datum: ComputedBin, x: number, y: number) => Html;
  },
  h: HtmlBuilder<M>,
): Html {
  const { model, toParentMessage, ariaLabel = 'Histogram', renderTooltip } = config;
  const highlightedBins = new Set(config.highlightedBins);
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { bins, color, xLabel, activeBin, enableBrush } = model;

  const maxCount = Math.max(0, ...bins.map((b) => b.count));
  const domainMin = bins[0]?.x0 ?? 0;
  const domainMax = bins[bins.length - 1]?.x1 ?? 1;

  const xScale = linear({ domain: [domainMin, domainMax], range: [0, PW] });
  const yScale = linear({ domain: [0, maxCount * 1.1], range: [PH, 0] });
  const yTicks = linearTicks([0, maxCount * 1.1], 5);

  const activeIdx = Option.isSome(activeBin) ? activeBin.value : -1;
  const ext = enableBrush ? brushExtent(model.brush) : null;
  const active = bins[activeIdx];
  const liveText = active ? `${xLabel}: ${active.x0} to ${active.x1}, ${active.count} points` : '';
  const handleKeyDown = (key: string) =>
    arrowKeyNav(key, (direction) => toParentMessage(Message.PressedKeyNav({ direction })));

  return h.div(
    [h.OnMount(Mount.mapMessage(ObserveChartWidth(), toParentMessage))],
    [
      withAccessibleTable(
        h,
        withAriaLive(
          h,
          svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, [
            h.g(
              [h.Transform(`translate(${ML},${MT})`)],
              [
                yGridlines(h, yTicks, (v) => yScale(v), PW, {
                  gridColor: 'var(--chart-grid, #2d2d2d)',
                  labelColor: '#94a3b8',
                  labelSize: '0.65rem',
                  format: (v) => String(Math.round(v)),
                }),

                // Brush selection background (rendered before bars so bars appear on top)
                ...(ext !== null
                  ? [
                      h.rect(
                        [
                          h.X(String(r3(ext[0]))),
                          h.Y('0'),
                          h.Width(String(r3(ext[1] - ext[0]))),
                          h.Height(String(PH)),
                          h.Fill('rgba(99, 102, 241, 0.15)'),
                          h.Stroke('#6366f1'),
                          h.StrokeWidth('1'),
                          h.Style({ 'pointer-events': 'none' }),
                        ],
                        [],
                      ),
                    ]
                  : []),

                // Bars
                h.g(
                  [],
                  bins.map((b, i) => {
                    const x = r3(xScale(b.x0));
                    const barW = r3(Math.max(0, xScale(b.x1) - xScale(b.x0) - 1));
                    const barH = r3(PH - yScale(b.count));
                    const barY = r3(yScale(b.count));
                    const isActive = i === activeIdx;

                    const isInBrush =
                      ext !== null ? xScale(b.x1) >= ext[0] && xScale(b.x0) <= ext[1] : null;
                    const opacity =
                      isInBrush !== null ? (isInBrush ? '1' : '0.25') : isActive ? '1' : '0.75';

                    return h.g(
                      [
                        ...(!enableBrush
                          ? [
                              h.OnMouseEnter(toParentMessage(Message.HoveredBin({ index: i }))),
                              h.OnMouseLeave(toParentMessage(Message.BlurredBin())),
                            ]
                          : []),
                        h.Style({ cursor: 'default' }),
                      ],
                      [
                        h.rect(
                          [
                            h.X(String(x)),
                            h.Y(String(barY)),
                            h.Width(String(barW)),
                            h.Height(String(barH)),
                            h.Fill(color),
                            h.Opacity(opacity),
                            ...(highlightedBins.has(i)
                              ? [
                                  h.DataAttribute('linked-highlight', 'true'),
                                  h.Stroke('var(--chart-axis, #3a3a3a)'),
                                  h.StrokeWidth('2'),
                                  h.Attribute('stroke-dasharray', '4 2'),
                                ]
                              : []),
                            h.Style({ transition: 'opacity 80ms' }),
                          ],
                          [],
                        ),
                        ...(!enableBrush && isActive && b.count > 0
                          ? [
                              renderTooltip
                                ? renderTooltip(b, x + barW / 2, barY)
                                : valueTooltip(h, x + barW / 2, barY, String(b.count), {
                                    color,
                                    offsetY: 5,
                                  }),
                            ]
                          : []),
                      ],
                    );
                  }),
                ),

                // X axis
                h.line(
                  [
                    h.X1('0'),
                    h.Y1(String(PH)),
                    h.X2(String(PW)),
                    h.Y2(String(PH)),
                    h.Stroke('var(--chart-axis, #3a3a3a)'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),

                // X tick labels — min, mid, max
                h.g(
                  [h.Transform(`translate(0,${PH})`)],
                  [domainMin, (domainMin + domainMax) / 2, domainMax].map((tick) =>
                    h.text(
                      [
                        h.X(String(r3(xScale(tick)))),
                        h.Y('14'),
                        h.Style({
                          'text-anchor': 'middle',
                          'dominant-baseline': 'hanging',
                          'font-size': '0.65rem',
                          fill: '#94a3b8',
                        }),
                      ],
                      [String(Math.round(tick))],
                    ),
                  ),
                ),

                ...(xLabel
                  ? [
                      h.text(
                        [
                          h.X(String(PW / 2)),
                          h.Y(String(PH + 36)),
                          h.Style({
                            'text-anchor': 'middle',
                            'dominant-baseline': 'hanging',
                            'font-size': '0.65rem',
                            fill: '#64748b',
                          }),
                        ],
                        [xLabel],
                      ),
                    ]
                  : []),

                // Brush pointer-capture overlay (on top to intercept all pointer events)
                ...(enableBrush
                  ? [
                      h.rect(
                        [
                          h.X('0'),
                          h.Y('0'),
                          h.Width(String(PW)),
                          h.Height(String(PH)),
                          h.Fill('transparent'),
                          h.Style({ cursor: 'crosshair', 'user-select': 'none' }),
                          h.OnMount(Mount.mapMessage(CaptureSvgBounds(), toParentMessage)),
                          h.OnPointerDown(
                            (_pointerType, _button, screenX, _screenY, _ts, clientX) =>
                              Option.some(
                                toParentMessage(
                                  Message.StartedHistogramBrush({ screenX, clientX }),
                                ),
                              ),
                          ),
                          h.OnPointerMove((screenX, _screenY, _pointerType) =>
                            model.brush.active
                              ? Option.some(
                                  toParentMessage(Message.MovedHistogramBrush({ screenX })),
                                )
                              : Option.none(),
                          ),
                          h.OnPointerUp((screenX, _screenY, _pointerType, _ts) =>
                            Option.some(toParentMessage(Message.EndedHistogramBrush({ screenX }))),
                          ),
                        ],
                        [],
                      ),
                    ]
                  : []),
              ],
            ),
          ]),
          liveText,
        ),
        ariaLabel,
        [xLabel || 'Range', 'Count'],
        bins.map((b, index) => [
          `[${b.x0}, ${b.x1}${index === bins.length - 1 ? ']' : ')'}`,
          String(b.count),
        ]),
      ),
    ],
  );
}
