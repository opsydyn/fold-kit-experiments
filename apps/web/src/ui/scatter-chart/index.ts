import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Effect, Match, Option, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import {
  arrowKeyNav,
  makeLayout,
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

// MODEL

export type Point = Readonly<{ x: number; y: number; label: string }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  radius: number;
  tickCount: number;
  xLabel: string;
  yLabel: string;
}>;

type ChartBounds = Readonly<{
  screenLeft: number;
  screenTop: number;
  renderedPW: number;
  renderedPH: number;
}>;

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
  color: '#f97316',
  activeColor: '#ea580c',
  radius: 5,
  tickCount: 5,
  xLabel: 'X',
  yLabel: 'Y',
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 260, ...cfg.dims },
    { top: 24, right: 20, bottom: 52, left: 52, ...cfg.margins },
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
  screenTop: Schema.Number,
  renderedPW: Schema.Number,
  renderedPH: Schema.Number,
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
    const chromeH = window.outerHeight - window.innerHeight;
    return RecordedChartBounds({
      screenLeft: rect.left + window.screenX,
      screenTop: rect.top + window.screenY + chromeH,
      renderedPW: rect.width,
      renderedPH: rect.height,
    });
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
      RecordedChartBounds: ({ screenLeft, screenTop, renderedPW, renderedPH }) => [
        { ...model, svgBounds: Option.some({ screenLeft, screenTop, renderedPW, renderedPH }) },
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
  const { model, toParentMessage, ariaLabel = 'Scatter chart', renderTooltip } = config;
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
    arrowKeyNav(key, (dir) => toParentMessage(PressedKeyNav({ direction: dir })));

  const activePoint = Option.isSome(activeIndex) ? points[activeIndex.value] : undefined;
  const liveText = activePoint
    ? `${activePoint.label}: ${cfg.xLabel} ${activePoint.x}, ${cfg.yLabel} ${activePoint.y}`
    : '';

  return withAccessibleTable(
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
                const radius = isActive ? cfg.radius + 3 : cfg.radius;
                return h.circle(
                  [
                    h.Cx(String(cx)),
                    h.Cy(String(cy)),
                    h.R(String(radius)),
                    h.Fill(isActive ? cfg.activeColor : 'var(--card-bg, #12121f)'),
                    h.Stroke(isActive ? cfg.activeColor : cfg.color),
                    h.StrokeWidth('2'),
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
              onSome: ({ value: i }) => {
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
                h.OnMount(Mount.mapMessage(CaptureChartBounds(), toParentMessage)),
                h.OnPointerMove((screenX, screenY, _pointerType) => {
                  if (Option.isNone(model.svgBounds)) return Option.none();
                  const {
                    screenLeft,
                    screenTop,
                    renderedPW: rPW,
                    renderedPH: rPH,
                  } = model.svgBounds.value;
                  const plotX = (screenX - screenLeft) * (PW / rPW);
                  const plotY = (screenY - screenTop) * (PH / rPH);
                  const idx = nearestPoint(coords, plotX, plotY);
                  return idx >= 0
                    ? Option.some(toParentMessage(HoveredPoint({ index: idx })))
                    : Option.none();
                }),
                h.OnPointerLeave((_pointerType) => Option.some(toParentMessage(BlurredPoint({})))),
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
  );
};
