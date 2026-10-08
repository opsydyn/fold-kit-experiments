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
import { Effect, Option, Queue, Schema, Stream } from 'effect';
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
  brushGestureWidth: number;
  svgBounds: Option.Option<SvgBounds>;
  brushDragStart: Option.Option<
    Readonly<{ anchorClientX: number; anchorScreenX: number; lastScreenX: number }>
  >;
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
      brushGestureWidth: layout.pw,
      svgBounds: Option.none(),
      brushDragStart: Option.none(),
    },
  };
}

// MESSAGE

const MeasuredBounds = Schema.Struct({ clientLeft: Schema.Number, renderedPW: Schema.Number });

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
    bounds: Schema.optionalKey(MeasuredBounds),
  },
  MovedHistogramBrush: { screenX: Schema.Number, bounds: Schema.optionalKey(MeasuredBounds) },
  EndedHistogramBrush: { screenX: Schema.Number, bounds: Schema.optionalKey(MeasuredBounds) },
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

type BrushMountMessage = Extract<
  Message,
  {
    _tag:
      | 'RecordedSvgBounds'
      | 'StartedHistogramBrush'
      | 'MovedHistogramBrush'
      | 'EndedHistogramBrush';
  }
>;

export const CaptureSvgBounds = Mount.defineStream('CaptureSvgBounds', {
  messages: [
    Message.RecordedSvgBounds,
    Message.StartedHistogramBrush,
    Message.MovedHistogramBrush,
    Message.EndedHistogramBrush,
  ],
  execute: ({ element }) =>
    Stream.callback<BrushMountMessage>((queue) => {
      const acquire = Effect.sync(() => {
        const readBounds = () => {
          const rect = element.getBoundingClientRect();
          return { clientLeft: rect.left, renderedPW: rect.width };
        };
        const onPointer = (event: Event) => {
          if (!(event instanceof PointerEvent)) return;
          const bounds = readBounds();
          const { screenX, clientX } = event;
          const message =
            event.type === 'pointerdown'
              ? Message.StartedHistogramBrush({ screenX, clientX, bounds })
              : event.type === 'pointermove'
                ? Message.MovedHistogramBrush({ screenX, bounds })
                : Message.EndedHistogramBrush({ screenX, bounds });
          Queue.offerUnsafe(queue, message);
        };
        for (const type of ['pointerdown', 'pointermove', 'pointerup'])
          element.addEventListener(type, onPointer);
        Queue.offerUnsafe(queue, Message.RecordedSvgBounds(readBounds()));
        return onPointer;
      });
      return Effect.acquireRelease(acquire, (onPointer) =>
        Effect.sync(() => {
          for (const type of ['pointerdown', 'pointermove', 'pointerup'])
            element.removeEventListener(type, onPointer);
        }),
      ).pipe(
        // Keep the listeners until the owning chart Mount is disposed.
        // oxlint-disable-next-line linteffect/no-effect-never
        Effect.andThen(Effect.never),
      );
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

function rebaseBrushDrag(model: Model): Model {
  if (!model.brush.active || Option.isNone(model.svgBounds) || model.layout.pw <= 0) return model;
  const { clientLeft, renderedPW } = model.svgBounds.value;
  const toClientX = linear({
    domain: [0, model.layout.pw],
    range: [clientLeft, clientLeft + renderedPW],
  });
  return {
    ...model,
    brushDragStart: Option.map(model.brushDragStart, ({ lastScreenX }) => ({
      anchorClientX: toClientX(model.brush.extent),
      anchorScreenX: lastScreenX,
      lastScreenX,
    })),
  };
}

function applyBrushBounds(model: Model, bounds?: SvgBounds): Model | undefined {
  if (bounds === undefined) return model;
  if (
    !Number.isFinite(bounds.clientLeft) ||
    !Number.isFinite(bounds.renderedPW) ||
    bounds.renderedPW <= 0
  )
    return undefined;
  if (
    Option.isSome(model.svgBounds) &&
    model.svgBounds.value.clientLeft === bounds.clientLeft &&
    model.svgBounds.value.renderedPW === bounds.renderedPW
  )
    return model;
  return rebaseBrushDrag({ ...model, svgBounds: Option.some(bounds) });
}

function resizeBrush(brush: BrushState, fromWidth: number, toWidth: number): BrushState {
  const resizeX = linear({ domain: [0, fromWidth], range: [0, toWidth] });
  return { ...brush, anchor: resizeX(brush.anchor), extent: resizeX(brush.extent) };
}

// Evaluate the brush helper's minimum gesture distance in the original gesture's coordinates.
function brushAtGestureWidth(model: Model): BrushState {
  return resizeBrush(model.brush, model.layout.pw, model.brushGestureWidth);
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
      const layout = layoutFor({ ...model.layout.dims, width }, model.layout.margins);
      if (!Number.isFinite(layout.pw) || layout.pw <= 0) return { model };
      if (model.layout.pw <= 0) return { model: { ...model, layout } };
      // Brush coordinates are plot pixels; preserve their domain positions before rebasing the drag.
      return {
        model: rebaseBrushDrag({
          ...model,
          layout,
          brush: resizeBrush(model.brush, model.layout.pw, layout.pw),
        }),
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
    RecordedSvgBounds: ({ clientLeft, renderedPW }) => {
      return { model: applyBrushBounds(model, { clientLeft, renderedPW }) ?? model };
    },
    StartedHistogramBrush: ({ screenX, clientX, bounds }) => {
      const measured = applyBrushBounds(model, bounds);
      if (measured === undefined) return { model };
      const plotX = computePlotX(measured.svgBounds, measured.layout.pw, clientX);
      return {
        model: {
          ...measured,
          brush: brushUpdate(model.brush, StartedBrush(plotX)),
          brushGestureWidth: model.layout.pw,
          brushDragStart: Option.some({
            anchorClientX: clientX,
            anchorScreenX: screenX,
            lastScreenX: screenX,
          }),
        },
      };
    },
    MovedHistogramBrush: ({ screenX, bounds }) => {
      if (!model.brush.active) return { model: model };
      const measured = applyBrushBounds(model, bounds);
      if (measured === undefined) return { model };
      const plotX = computeMovePlotX(measured, screenX);
      return {
        model: {
          ...measured,
          brush: brushUpdate(model.brush, MovedBrush(plotX)),
          brushDragStart: Option.map(measured.brushDragStart, (drag) => ({
            ...drag,
            lastScreenX: screenX,
          })),
        },
      };
    },
    EndedHistogramBrush: ({ screenX, bounds }) => {
      if (!model.brush.active) return { model };
      const measured = applyBrushBounds(model, bounds);
      if (measured === undefined) return { model };
      const plotX = computeMovePlotX(measured, screenX);
      return {
        model: {
          ...measured,
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
  const domainMin = model.bins[0]?.x0 ?? 0;
  const domainMax = model.bins[model.bins.length - 1]?.x1 ?? 1;
  const xScale = linearInvertible({
    domain: [domainMin, domainMax],
    range: [0, model.brushGestureWidth],
  });
  const domain = brushDomain(brushAtGestureWidth(model), xScale.invert);
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
  const gestureExtent = enableBrush ? brushExtent(brushAtGestureWidth(model)) : null;
  const fromGestureX = linear({ domain: [0, model.brushGestureWidth], range: [0, PW] });
  const ext =
    gestureExtent === null
      ? null
      : ([fromGestureX(gestureExtent[0]), fromGestureX(gestureExtent[1])] as const);
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
