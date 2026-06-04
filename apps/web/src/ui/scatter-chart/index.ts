import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { arrowKeyNav, nextIndex, r3, svgRoot, valueTooltip, xLinearGridlines, yGridlines, makeLayout } from '../shared';
import type { Dims, Layout, Margins } from '../shared';

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
    },
    [],
  ];
}

// MESSAGE

export const HoveredPoint = m('HoveredPoint', { index: Schema.Number });
export const BlurredPoint = m('BlurredPoint', {});
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const UpdatedPoints = m('UpdatedPoints', { points: Schema.Unknown });
export const Message = Schema.Union([HoveredPoint, BlurredPoint, PressedKeyNav, UpdatedPoints]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredPoint: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredPoint: () => [{ ...model, activeIndex: Option.none() }, []],
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
  const { dims: { width: W, height: H }, margins: { top: MT, left: ML }, pw: PW, ph: PH } = model.layout;
  const { points, activeIndex, config: cfg } = model;

  const maxX = points.reduce((a, p) => Math.max(a, p.x), 0);
  const maxY = points.reduce((a, p) => Math.max(a, p.y), 0);

  const xDomain: readonly [number, number] = [0, maxX * 1.1];
  const yDomain: readonly [number, number] = [0, maxY * 1.1];

  const xScale = linear({ domain: xDomain, range: [0, PW] });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });

  const xTicks = linearTicks(xDomain, cfg.tickCount);
  const yTicks = linearTicks(yDomain, cfg.tickCount);

  const handleKeyDown = (key: string) =>
    arrowKeyNav(key, (dir) => toParentMessage(PressedKeyNav({ direction: dir })));

  return svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        yGridlines(h, yTicks, (v) => yScale(v), PW),
        xLinearGridlines(h, xTicks, (v) => xScale(v), PH),

        // Axis lines
        h.line([h.X1('0'), h.Y1(String(PH)), h.X2(String(PW)), h.Y2(String(PH)),
          h.Stroke('#d4d4d4'), h.StrokeWidth('1')], []),
        h.line([h.X1('0'), h.Y1('0'), h.X2('0'), h.Y2(String(PH)),
          h.Stroke('#d4d4d4'), h.StrokeWidth('1')], []),

        // Axis labels
        h.text([h.X(String(PW / 2)), h.Y(String(PH + 38)),
          h.Style({ 'text-anchor': 'middle', 'dominant-baseline': 'auto',
            'font-size': '0.7rem', 'font-weight': '600', fill: '#aaa',
            'letter-spacing': '0.05em', 'text-transform': 'uppercase' })],
          [cfg.xLabel]),
        h.text([h.Transform(`translate(${-ML + 12},${PH / 2}) rotate(-90)`),
          h.Style({ 'text-anchor': 'middle', 'dominant-baseline': 'auto',
            'font-size': '0.7rem', 'font-weight': '600', fill: '#aaa',
            'letter-spacing': '0.05em', 'text-transform': 'uppercase' })],
          [cfg.yLabel]),

        // Data points
        h.g(
          [],
          points.map((p, i) => {
            const cx = r3(xScale(p.x));
            const cy = r3(yScale(p.y));
            const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
            const radius = isActive ? cfg.radius + 3 : cfg.radius;
            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredPoint({ index: i }))),
                h.OnMouseLeave(toParentMessage(BlurredPoint({}))),
                h.Style({ cursor: 'pointer' }),
                h.AriaLabel(`${p.label}: (${p.x}, ${p.y})`),
              ],
              [
                h.circle([h.Cx(String(cx)), h.Cy(String(cy)), h.R('14'), h.Fill('transparent')], []),
                h.circle([
                  h.Cx(String(cx)), h.Cy(String(cy)), h.R(String(radius)),
                  h.Fill(isActive ? cfg.activeColor : '#fff'),
                  h.Stroke(isActive ? cfg.activeColor : cfg.color),
                  h.StrokeWidth('2'),
                  h.Style({ transition: 'r 120ms, fill 120ms' }),
                ], []),
                ...(isActive
                  ? [(renderTooltip
                      ? renderTooltip(p, cx, cy)
                      : valueTooltip(h, cx, cy, `${p.label} (${p.x}, ${p.y})`,
                          { color: cfg.activeColor, offsetY: radius + 5, fontSize: '0.72rem' }))]
                  : []),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
};
