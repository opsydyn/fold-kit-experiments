import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Option, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { withOutMessage } from 'foldkit/update';
import type { Return as UpdateReturn, ReturnWithOutMessage } from 'foldkit/update';

import type { Dims, Layout, Margins } from '../shared';
import {
  arrowKeyNav,
  layoutFor,
  nearestPoint,
  nextIndex,
  r3,
  svgRoot,
  valueTooltip,
  withAccessibleTable,
  withAriaLive,
  xLinearGridlines,
  yGridlines,
} from '../shared';
import { pointerPositions, widthChanges } from '../shared/plot-events';

// MODEL

export type Point = Readonly<{ id?: string; x: number; y: number; label: string }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  radius: number;
  tickCount: number;
  xLabel: string;
  yLabel: string;
}>;

export type Model = Readonly<{
  points: ReadonlyArray<Point>;
  activeIndex: Option.Option<number>;
  config: Config;
  readonly layout: Layout;
}>;

export type InitConfig = Readonly<{
  points: ReadonlyArray<Point>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#f97316',
  activeColor: '#ea580c',
  radius: 5,
  tickCount: 5,
  xLabel: 'X',
  yLabel: 'Y',
};

export function init(cfg: InitConfig): UpdateReturn<Model, Message> {
  const layout = layoutFor(
    { width: 480, height: 260, ...cfg.dims },
    { top: 24, right: 20, bottom: 52, left: 52, ...cfg.margins },
  );
  return {
    model: {
      points: cfg.points,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
      layout,
    },
  };
}

// MESSAGE

export const Message = defineMessageUnion({
  MovedPlotPointer: {
    clientX: Schema.Number,
    clientY: Schema.Number,
    left: Schema.Number,
    top: Schema.Number,
    width: Schema.Number,
    height: Schema.Number,
  },
  RecordedChartWidth: { width: Schema.Number },
  HoveredPoint: { index: Schema.Number },
  BlurredPoint: {},
  PressedKeyNav: { direction: Schema.String },
  UpdatedPoints: { points: Schema.Unknown },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  InspectedPoint: { key: Schema.String, x: Schema.Number, y: Schema.Number },
  ClearedInspection: {},
});
export type OutMessage = typeof OutMessage.Type;

// MOUNT

export const ObservePlotPointer = Mount.defineStream('ObserveScatterPlotPointer', {
  messages: [Message.MovedPlotPointer],
  execute: ({ element }) => pointerPositions(element).pipe(Stream.map(Message.MovedPlotPointer)),
});

export const ObserveChartWidth = Mount.defineStream('ObserveScatterChartWidth', {
  messages: [Message.RecordedChartWidth],
  execute: ({ element }) =>
    widthChanges(element).pipe(Stream.map((width) => Message.RecordedChartWidth({ width }))),
});

// UPDATE

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

function inspected(model: Model, index: number): Return {
  const point = model.points[index];
  if (point === undefined)
    return withOutMessage<Model, Message, OutMessage>(
      { model: { ...model, activeIndex: Option.none() } },
      OutMessage.ClearedInspection(),
    );
  return withOutMessage<Model, Message, OutMessage>(
    { model: { ...model, activeIndex: Option.some(index) } },
    OutMessage.InspectedPoint({ key: point.id ?? point.label, x: point.x, y: point.y }),
  );
}

export const update = (model: Model, msg: Message): Return =>
  Message.match<Return>(msg, {
    MovedPlotPointer: ({ clientX, clientY, left, top, width, height }) => {
      if (
        ![clientX, clientY, left, top, width, height].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0 ||
        model.points.length === 0
      )
        return { model };
      const { pw, ph } = model.layout;
      const maxX = model.points.reduce((max, point) => Math.max(max, point.x), 0);
      const maxY = model.points.reduce((max, point) => Math.max(max, point.y), 0);
      const xScale = linear({ domain: [0, maxX * 1.1], range: [0, pw] });
      const yScale = linear({ domain: [0, maxY * 1.1], range: [ph, 0] });
      const coords = model.points.map((point): readonly [number, number] => [
        r3(xScale(point.x)),
        r3(yScale(point.y)),
      ]);
      return inspected(
        model,
        nearestPoint(coords, ((clientX - left) * pw) / width, ((clientY - top) * ph) / height),
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
    HoveredPoint: ({ index }) => inspected(model, index),
    BlurredPoint: () =>
      withOutMessage<Model, Message, OutMessage>(
        { model: { ...model, activeIndex: Option.none() } },
        OutMessage.ClearedInspection(),
      ),
    UpdatedPoints: ({ points }) => ({
      // SAFETY: The app model and message contracts establish this value before the assertion.
      model: { ...model, points: points as ReadonlyArray<Point> },
    }),
    PressedKeyNav: ({ direction }) => {
      const n = model.points.length;
      if (n === 0) return { model };
      const current = Option.isSome(model.activeIndex) ? model.activeIndex.value : -1;
      return inspected(model, nextIndex(n, current, direction));
    },
  });

// VIEW

export const view = <M>(
  config: {
    model: Model;
    toParentMessage: (msg: Message) => M;
    ariaLabel?: string;
    highlightedKeys?: ReadonlyArray<string>;
    renderTooltip?: (datum: Point, x: number, y: number) => Html;
  },
  h: HtmlBuilder<M>,
): Html => {
  const { model, toParentMessage, ariaLabel = 'Scatter chart', renderTooltip } = config;
  const highlightedKeys = new Set(config.highlightedKeys);
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { points, activeIndex, config: cfg } = model;

  const maxX = points.reduce((a, p) => Math.max(a, p.x), 0);
  const maxY = points.reduce((a, p) => Math.max(a, p.y), 0);

  const xDomain: readonly [number, number] = [0, maxX * 1.1];
  const yDomain: readonly [number, number] = [0, maxY * 1.1];

  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });

  const xTicks = linearTicks(xDomain, cfg.tickCount);
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const coords: ReadonlyArray<readonly [number, number]> = points.map((p) => [
    r3(xScale(p.x)),
    r3(yScale(p.y)),
  ]);

  const handleKeyDown = (key: string) =>
    arrowKeyNav(key, (dir) => toParentMessage(Message.PressedKeyNav({ direction: dir })));

  const activePoint = Option.isSome(activeIndex) ? points[activeIndex.value] : undefined;
  const liveText = activePoint
    ? `${activePoint.label}: ${cfg.xLabel} ${activePoint.x}, ${cfg.yLabel} ${activePoint.y}`
    : '';

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
                yGridlines(h, yTicks, (v) => yScale(v), PW),
                xLinearGridlines(h, xTicks, (v) => xScale(v), PH),

                // Axis lines
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
                h.line(
                  [
                    h.X1('0'),
                    h.Y1('0'),
                    h.X2('0'),
                    h.Y2(String(PH)),
                    h.Stroke('var(--chart-axis, #3a3a3a)'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),

                // Axis labels
                h.text(
                  [
                    h.X(String(PW / 2)),
                    h.Y(String(PH + 38)),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'auto',
                      'font-size': '0.7rem',
                      'font-weight': '600',
                      fill: '#aaa',
                      'letter-spacing': '0.05em',
                      'text-transform': 'uppercase',
                    }),
                  ],
                  [cfg.xLabel],
                ),
                h.text(
                  [
                    h.Transform(`translate(${-ML + 12},${PH / 2}) rotate(-90)`),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'auto',
                      'font-size': '0.7rem',
                      'font-weight': '600',
                      fill: '#aaa',
                      'letter-spacing': '0.05em',
                      'text-transform': 'uppercase',
                    }),
                  ],
                  [cfg.yLabel],
                ),

                // Data points (visual only — pointer events handled by overlay)
                h.g(
                  [],
                  points.map((p, i) => {
                    const [cx, cy] = coords[i] ?? [0, 0];
                    const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
                    const isLinked = highlightedKeys.has(p.id ?? p.label);
                    const radius = isActive ? cfg.radius + 3 : cfg.radius;
                    return h.circle(
                      [
                        h.Cx(String(cx)),
                        h.Cy(String(cy)),
                        h.R(String(radius)),
                        h.Fill(isActive ? cfg.activeColor : 'var(--card-bg, #12121f)'),
                        h.Stroke(isActive ? cfg.activeColor : cfg.color),
                        h.StrokeWidth(isLinked ? '3' : '2'),
                        ...(isLinked
                          ? [
                              h.DataAttribute('linked-highlight', 'true'),
                              h.Attribute('stroke-dasharray', '3 2'),
                            ]
                          : []),
                        h.Style({ transition: 'r 120ms, fill 120ms' }),
                        h.AriaLabel(`${p.label}: (${p.x}, ${p.y})`),
                      ],
                      [],
                    );
                  }),
                ),

                // Active point tooltip
                ...Option.match(activeIndex, {
                  onNone: () => [],
                  onSome: (i) => {
                    const p = points[i];
                    if (p === undefined) return [];
                    const [cx, cy] = coords[i] ?? [0, 0];
                    const radius = cfg.radius + 3;
                    return [
                      renderTooltip
                        ? renderTooltip(p, cx, cy)
                        : valueTooltip(h, cx, cy, `${p.label} (${p.x}, ${p.y})`, {
                            color: cfg.activeColor,
                            offsetY: radius + 5,
                            fontSize: '0.72rem',
                          }),
                    ];
                  },
                }),

                // Cursor-tracking overlay — nearestPoint finds closest datum in 2D
                h.rect(
                  [
                    h.X('0'),
                    h.Y('0'),
                    h.Width(String(PW)),
                    h.Height(String(PH)),
                    h.Fill('transparent'),
                    h.Style({ cursor: 'pointer' }),
                    h.OnMount(Mount.mapMessage(ObservePlotPointer(), toParentMessage)),
                    h.OnPointerLeave((_pointerType) =>
                      Option.some(toParentMessage(Message.BlurredPoint())),
                    ),
                  ],
                  [],
                ),
              ],
            ),
          ]),
          liveText,
        ),
        ariaLabel,
        ['Label', cfg.xLabel, cfg.yLabel],
        points.map((p) => [p.label, String(p.x), String(p.y)]),
      ),
    ],
  );
};
