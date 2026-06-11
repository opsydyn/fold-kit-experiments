import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { area } from '@opsydyn/foldkit-viz/shape/area';
import { line } from '@opsydyn/foldkit-viz/shape/line';
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
  xLinearAxis,
  yGridlines,
} from '../shared';

// MODEL

export type Point = Readonly<{ label: string; value: number }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  areaColor: string;
  tickCount: number;
  curve: 'linear' | 'catmullRom' | 'monotoneX';
}>;

type ChartBounds = Readonly<{ screenLeft: number; renderedPW: number }>;

export type Model = Readonly<{
  points: ReadonlyArray<Point>;
  activeIndex: Option.Option<number>;
  config: Config;
  readonly layout: Layout;
  svgBounds: Option.Option<ChartBounds>;
}>;

export type InitConfig = Readonly<{
  points: ReadonlyArray<Point>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#6366f1',
  activeColor: '#4338ca',
  areaColor: 'rgba(99,102,241,0.08)',
  tickCount: 5,
  curve: 'catmullRom',
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 260, ...cfg.dims },
    { top: 24, right: 20, bottom: 44, left: 44, ...cfg.margins },
  );
  return [
    {
      points: cfg.points,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
      layout,
      svgBounds: Option.none(),
    },
    [],
  ];
}

// MESSAGE

export const HoveredPoint = m('HoveredPoint', { index: Schema.Number });
export const BlurredPoint = m('BlurredPoint', {});
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });
export const RecordedChartBounds = m('RecordedChartBounds', {
  screenLeft: Schema.Number,
  renderedPW: Schema.Number,
});

export const UpdatedPoints = m('UpdatedPoints', { points: Schema.Unknown });
export const Message = Schema.Union([
  HoveredPoint,
  BlurredPoint,
  PressedKeyNav,
  RecordedChartBounds,
  UpdatedPoints,
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
      HoveredPoint: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredPoint: () => [{ ...model, activeIndex: Option.none() }, []],
      RecordedChartBounds: ({ screenLeft, renderedPW }) => [
        { ...model, svgBounds: Option.some({ screenLeft, renderedPW }) },
        [],
      ],
      UpdatedPoints: ({ points }) => [{ ...model, points: points as ReadonlyArray<Point> }, []],
      PressedKeyNav: ({ direction }) => {
        const n = model.points.length;
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
  renderTooltip?: (datum: Point, x: number, y: number) => Html;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Line chart', renderTooltip } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { points, activeIndex, config: cfg } = model;

  const maxValue = points.reduce((acc, p) => Math.max(acc, p.value), 0);
  const yDomain: readonly [number, number] = [0, maxValue * 1.1];
  const xDomain: readonly [number, number] = [0, points.length - 1];

  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const coords: ReadonlyArray<readonly [number, number]> = points.map((p, i) => [
    r3(xScale(i)),
    r3(yScale(p.value)),
  ]);

  const linePath = line(coords, { curve: cfg.curve });
  const areaPath = area(coords, PH, { curve: cfg.curve });

  const handleKeyDown = (key: string) =>
    arrowKeyNav(key, (dir) => toParentMessage(PressedKeyNav({ direction: dir })));

  const activePoint = Option.isSome(activeIndex) ? points[activeIndex.value] : undefined;
  const liveText = activePoint ? `${activePoint.label}: ${activePoint.value}` : '';

  return withAccessibleTable(
    h,
    withAriaLive(
      h,
      svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, [
        h.g(
          [h.Transform(`translate(${ML},${MT})`)],
          [
            yGridlines(h, yTicks, (v) => yScale(v), PW),

            ...(areaPath
              ? [h.path([h.D(areaPath), h.Fill(`${cfg.color}22`), h.Stroke('none')], [])]
              : []),

            ...(linePath
              ? [
                  h.path(
                    [
                      h.D(linePath),
                      h.Fill('none'),
                      h.Stroke(cfg.color),
                      h.StrokeWidth('2'),
                      h.Style({ 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
                    ],
                    [],
                  ),
                ]
              : []),

            // Data points (visual only — pointer events handled by overlay)
            h.g(
              [],
              points.map((p, i) => {
                const [cx, cy] = coords[i] ?? [0, 0];
                const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
                return h.circle(
                  [
                    h.Cx(String(cx)),
                    h.Cy(String(cy)),
                    h.R(isActive ? '5' : '3'),
                    h.Fill(isActive ? cfg.activeColor : cfg.color),
                    h.Stroke('var(--card-bg, #12121f)'),
                    h.StrokeWidth('2'),
                    h.Style({ transition: 'r 120ms' }),
                    h.AriaLabel(`${p.label}: ${p.value}`),
                  ],
                  [],
                );
              }),
            ),

            // Active point tooltip
            ...(Option.isSome(activeIndex) && points[activeIndex.value] !== undefined
              ? (() => {
                  const i = activeIndex.value;
                  const p = points[i];
                  if (p === undefined) return [];
                  const [cx, cy] = coords[i] ?? [0, 0];
                  return [
                    renderTooltip
                      ? renderTooltip(p, cx, cy)
                      : valueTooltip(h, cx, cy, String(p.value), {
                          color: cfg.activeColor,
                          offsetY: 12,
                        }),
                  ];
                })()
              : []),

            // Cursor-tracking overlay — single hit rect, nearestIndex finds the active point
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
                  const xCoords = coords.map((c) => c[0]);
                  const idx = nearestIndex(xCoords, plotX);
                  return idx >= 0
                    ? Option.some(toParentMessage(HoveredPoint({ index: idx })))
                    : Option.none();
                }),
                h.OnPointerLeave((_pointerType) => Option.some(toParentMessage(BlurredPoint({})))),
              ],
              [],
            ),

            xLinearAxis(
              h,
              points.map((p) => p.label),
              (i) => xScale(i),
              PH,
              PW,
            ),
          ],
        ),
      ]),
      liveText,
    ),
    ariaLabel,
    ['Label', 'Value'],
    points.map((p) => [p.label, String(p.value)]),
  );
};
