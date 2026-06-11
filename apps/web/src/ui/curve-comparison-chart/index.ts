import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import type { CurveType } from '@opsydyn/foldkit-viz/shape/line';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type InitConfig = Readonly<{
  data: ReadonlyArray<readonly [number, number]>;
  xLabel?: string;
  yLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  data: ReadonlyArray<readonly [number, number]>;
  xLabel: string;
  yLabel: string;
  activeCurve: Option.Option<CurveType>;
  readonly layout: Layout;
}>;

const CURVES: ReadonlyArray<Readonly<{ curve: CurveType; color: string }>> = [
  { curve: 'linear', color: '#94a3b8' },
  { curve: 'basis', color: '#6366f1' },
  { curve: 'cardinal', color: '#f59e0b' },
  { curve: 'catmullRom', color: '#10b981' },
  { curve: 'monotoneX', color: '#ef4444' },
];

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 16, right: 16, bottom: 48, left: 44, ...cfg.margins },
  );
  return [
    {
      data: cfg.data,
      xLabel: cfg.xLabel ?? 'x',
      yLabel: cfg.yLabel ?? 'y',
      activeCurve: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredCurve = m('HoveredCurve', { curve: Schema.String });
export const BlurredCurve = m('BlurredCurve', {});

export const Message = Schema.Union([HoveredCurve, BlurredCurve]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCurve: ({ curve }) => [{ ...model, activeCurve: Option.some(curve as CurveType) }, []],
      BlurredCurve: () => [{ ...model, activeCurve: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Curve comparison chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { data, xLabel, yLabel, activeCurve } = model;

  const active = Option.isSome(activeCurve) ? activeCurve.value : null;

  const xs = data.map(([x]) => x);
  const ys = data.map(([, y]) => y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xPad = (xMax - xMin) * 0.05;
  const yPad = (yMax - yMin) * 0.15;

  const xScale = linear({ domain: [xMin - xPad, xMax + xPad], range: [0, PW] });
  const yScale = linear({ domain: [yMin - yPad, yMax + yPad], range: [PH, 0] });

  const xTicks = linearTicks([xMin - xPad, xMax + xPad], 6);
  const yTicks = linearTicks([yMin - yPad, yMax + yPad], 4);

  const scaled = data.map(([x, y]) => [xScale(x), yScale(y)] as const);

  const legendCols = 3;
  const colW = 88;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // X gridlines + labels
        h.g(
          [],
          xTicks.map((t) => {
            const px = xScale(t);
            return h.g(
              [],
              [
                h.line(
                  [
                    h.X1(String(px)),
                    h.Y1('0'),
                    h.X2(String(px)),
                    h.Y2(String(PH)),
                    h.Stroke('var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(px)),
                    h.Y(String(PH + 12)),
                    h.Style({ 'text-anchor': 'middle', 'font-size': '0.6rem', fill: '#94a3b8' }),
                  ],
                  [String(t)],
                ),
              ],
            );
          }),
        ),

        // Y gridlines + labels
        h.g(
          [],
          yTicks.map((t) => {
            const py = yScale(t);
            return h.g(
              [],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1(String(py)),
                    h.X2(String(PW)),
                    h.Y2(String(py)),
                    h.Stroke('var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X('-6'),
                    h.Y(String(py)),
                    h.Style({
                      'text-anchor': 'end',
                      'dominant-baseline': 'middle',
                      'font-size': '0.6rem',
                      fill: '#94a3b8',
                    }),
                  ],
                  [String(t)],
                ),
              ],
            );
          }),
        ),

        // Axis labels
        h.text(
          [
            h.X(String(PW / 2)),
            h.Y(String(PH + 24)),
            h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
          ],
          [xLabel],
        ),
        h.text(
          [
            h.X('0'),
            h.Y('0'),
            h.Transform(`rotate(-90) translate(${-(PH / 2)}, -32)`),
            h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
          ],
          [yLabel],
        ),

        // Curve lines
        h.g(
          [],
          CURVES.map(({ curve, color }) => {
            const isActive = curve === active;
            const isInactive = active !== null && !isActive;
            const d = line(scaled, { curve, tension: 0.3 });
            if (!d) return h.g([], []);
            return h.path(
              [
                h.D(d),
                h.Fill('none'),
                h.Stroke(color),
                h.StrokeWidth(isActive ? '2.5' : '1.5'),
                h.Opacity(isInactive ? '0.2' : '1'),
                h.Style({ transition: 'stroke-width 80ms, opacity 80ms' }),
                h.OnMouseEnter(toParentMessage(HoveredCurve({ curve }))),
                h.OnMouseLeave(toParentMessage(BlurredCurve({}))),
              ],
              [],
            );
          }),
        ),

        // Data points
        h.g(
          [],
          scaled.map(([px, py]) =>
            h.circle(
              [h.Cx(String(px)), h.Cy(String(py)), h.R('2.5'), h.Fill('#1e293b'), h.Opacity('0.6')],
              [],
            ),
          ),
        ),

        // Legend — 3 across, 2 rows
        h.g(
          [h.Transform(`translate(0, ${PH + 30})`)],
          CURVES.map(({ curve, color }, i) => {
            const col = i % legendCols;
            const row = Math.floor(i / legendCols);
            return h.g(
              [
                h.Transform(`translate(${col * colW}, ${row * 14})`),
                h.OnMouseEnter(toParentMessage(HoveredCurve({ curve }))),
                h.OnMouseLeave(toParentMessage(BlurredCurve({}))),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1('0'),
                    h.X2('16'),
                    h.Y2('0'),
                    h.Stroke(color),
                    h.StrokeWidth(curve === active ? '2.5' : '1.5'),
                    h.Opacity(active !== null && curve !== active ? '0.3' : '1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X('20'),
                    h.Y('0'),
                    h.Style({
                      'dominant-baseline': 'middle',
                      'font-size': '0.58rem',
                      'font-weight': curve === active ? '600' : '400',
                      fill:
                        active !== null && curve !== active
                          ? 'var(--chart-label-muted, #555)'
                          : 'var(--chart-label, #888)',
                    }),
                  ],
                  [curve],
                ),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
}
