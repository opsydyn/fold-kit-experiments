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
import { Effect, Match, Option, Schema } from 'effect';
import { Mount } from 'foldkit';
import { type Html, html } from 'foldkit/html';
import { m } from 'foldkit/message';
import {
  type Dims,
  type Layout,
  type Margins,
  makeLayout,
  r3,
  svgRoot,
  valueTooltip,
  yGridlines,
} from '../shared';

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

export function init(cfg: InitConfig): readonly [Model, readonly []] {
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
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 24, right: 20, bottom: 48, left: 44, ...cfg.margins },
  );

  return [
    {
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
    [],
  ];
}

// MESSAGE

export const HoveredBin = m('HoveredBin', { index: Schema.Number });
export const BlurredBin = m('BlurredBin', {});
export const RecordedSvgBounds = m('RecordedSvgBounds', {
  clientLeft: Schema.Number,
  renderedPW: Schema.Number,
});
export const StartedHistogramBrush = m('StartedHistogramBrush', {
  screenX: Schema.Number,
  clientX: Schema.Number,
});
export const MovedHistogramBrush = m('MovedHistogramBrush', { screenX: Schema.Number });
export const EndedHistogramBrush = m('EndedHistogramBrush', { screenX: Schema.Number });
export const ClearedHistogramBrush = m('ClearedHistogramBrush', {});

export const Message = Schema.Union([
  HoveredBin,
  BlurredBin,
  RecordedSvgBounds,
  StartedHistogramBrush,
  MovedHistogramBrush,
  EndedHistogramBrush,
  ClearedHistogramBrush,
]);
export type Message = typeof Message.Type;

// MOUNT

export const CaptureSvgBounds = Mount.define(
  'CaptureSvgBounds',
  RecordedSvgBounds,
)((element) =>
  Effect.sync(() => {
    const rect = element.getBoundingClientRect();
    return RecordedSvgBounds({ clientLeft: rect.left, renderedPW: rect.width });
  }),
);

// UPDATE

type Return = readonly [Model, readonly []];

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
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBin: ({ index }) => [{ ...model, activeBin: Option.some(index) }, []],
      BlurredBin: () => [{ ...model, activeBin: Option.none() }, []],
      RecordedSvgBounds: ({ clientLeft, renderedPW }) => [
        { ...model, svgBounds: Option.some({ clientLeft, renderedPW }) },
        [],
      ],
      StartedHistogramBrush: ({ screenX, clientX }) => {
        const plotX = computePlotX(model.svgBounds, model.layout.pw, clientX);
        return [
          {
            ...model,
            brush: brushUpdate(model.brush, StartedBrush(plotX)),
            brushDragStart: Option.some({ anchorClientX: clientX, anchorScreenX: screenX }),
          },
          [],
        ];
      },
      MovedHistogramBrush: ({ screenX }) => {
        if (!model.brush.active) return [model, []];
        const plotX = computeMovePlotX(model, screenX);
        return [{ ...model, brush: brushUpdate(model.brush, MovedBrush(plotX)) }, []];
      },
      EndedHistogramBrush: ({ screenX }) => {
        const plotX = computeMovePlotX(model, screenX);
        return [
          {
            ...model,
            brush: brushUpdate(model.brush, EndedBrush(plotX)),
            brushDragStart: Option.none(),
          },
          [],
        ];
      },
      ClearedHistogramBrush: () => [
        {
          ...model,
          brush: brushUpdate(model.brush, ClearedBrush()),
          brushDragStart: Option.none(),
        },
        [],
      ],
    }),
  );

// QUERY

/** Returns the brush selection as domain [lo, hi] values, or null if no selection. */
export function getBrushDomain(model: Model): readonly [number, number] | null {
  if (!model.enableBrush || model.bins.length === 0) return null;
  const ext = brushExtent(model.brush);
  // biome-ignore lint: public API query — null is the absence sentinel, callers guard before use
  if (ext === null) return null;
  const domainMin = model.bins[0]?.x0 ?? 0;
  const domainMax = model.bins[model.bins.length - 1]?.x1 ?? 1;
  const xScale = linearInvertible({ domain: [domainMin, domainMax], range: [0, model.layout.pw] });
  return brushDomain(model.brush, xScale.invert);
}

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
  renderTooltip?: (datum: ComputedBin, x: number, y: number) => Html;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Histogram', renderTooltip } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { bins, color, xLabel, activeBin, enableBrush } = model;

  if (bins.length === 0) return h.svg([h.ViewBox(`0 0 ${W} ${H}`), h.Width('100%')], []);

  const maxCount = Math.max(...bins.map((b) => b.count));
  const domainMin = bins[0]?.x0 ?? 0;
  const domainMax = bins[bins.length - 1]?.x1 ?? 1;

  const xScale = linear({ domain: [domainMin, domainMax], range: [0, PW] });
  const yScale = linear({ domain: [0, maxCount * 1.1], range: [PH, 0] });
  const yTicks = linearTicks([0, maxCount * 1.1], 5);

  const activeIdx = Option.isSome(activeBin) ? activeBin.value : -1;
  const ext = enableBrush ? brushExtent(model.brush) : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
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
                      h.OnMouseEnter(toParentMessage(HoveredBin({ index: i }))),
                      h.OnMouseLeave(toParentMessage(BlurredBin())),
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
                  h.OnPointerDown((_pointerType, _button, screenX, _screenY, _ts, clientX) =>
                    Option.some(toParentMessage(StartedHistogramBrush({ screenX, clientX }))),
                  ),
                  h.OnPointerMove((screenX, _screenY, _pointerType) =>
                    model.brush.active
                      ? Option.some(toParentMessage(MovedHistogramBrush({ screenX })))
                      : Option.none(),
                  ),
                  h.OnPointerUp((screenX, _screenY, _pointerType, _ts) =>
                    Option.some(toParentMessage(EndedHistogramBrush({ screenX }))),
                  ),
                ],
                [],
              ),
            ]
          : []),
      ],
    ),
  ]);
}
