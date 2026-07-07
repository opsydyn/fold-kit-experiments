import { format } from '@opsydyn/foldkit-viz/math/format';
import { log, logTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type Point = Readonly<{
  label: string;
  x: number; // weekly downloads
  y: number; // GitHub stars
  category: string;
}>;

export type InitConfig = Readonly<{
  points: ReadonlyArray<Point>;
  categories: ReadonlyArray<Readonly<{ name: string; color: string }>>;
  xLabel?: string;
  yLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  points: ReadonlyArray<Point>;
  categories: ReadonlyArray<Readonly<{ name: string; color: string }>>;
  xLabel: string;
  yLabel: string;
  activeLabel: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 16, right: 24, bottom: 40, left: 56, ...cfg.margins },
  );
  return [
    {
      points: cfg.points,
      categories: cfg.categories,
      xLabel: cfg.xLabel ?? 'Weekly downloads',
      yLabel: cfg.yLabel ?? 'GitHub stars',
      activeLabel: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredPoint = m('HoveredPoint', { label: Schema.String });
export const BlurredPoint = m('BlurredPoint', {});

export const Message = Schema.Union([HoveredPoint, BlurredPoint]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredPoint: ({ label }) => [{ ...model, activeLabel: Option.some(label) }, []],
      BlurredPoint: () => [{ ...model, activeLabel: Option.none() }, []],
    }),
  );

// VIEW

const fmtSI = format('~s');

function categoryCols(
  categories: ReadonlyArray<Readonly<{ name: string; color: string }>>,
): ReadonlyMap<string, string> {
  return new Map(categories.map((c) => [c.name, c.color]));
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Log scatter chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { points, categories, xLabel, yLabel, activeLabel } = model;

  const colMap = categoryCols(categories);
  const active = Option.isSome(activeLabel) ? activeLabel.value : null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xDomain = [xMin * 0.5, xMax * 2] as const;
  const yDomain = [yMin * 0.5, yMax * 2] as const;

  const xScale = log({ domain: xDomain, range: [0, PW] });
  const yScale = log({ domain: yDomain, range: [PH, 0] });

  const xTicks = logTicks(xDomain);
  const yTicks = logTicks(yDomain);

  const legendItemWidth = 100;

  return svgRoot(h, { width: W, height: H, ariaLabel, style: { overflow: 'visible' } }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // X grid lines + labels
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
                    h.Y(String(PH + 14)),
                    h.Style({ 'text-anchor': 'middle', 'font-size': '0.6rem', fill: '#94a3b8' }),
                  ],
                  [fmtSI(t)],
                ),
              ],
            );
          }),
        ),

        // Y grid lines + labels
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
                  [fmtSI(t)],
                ),
              ],
            );
          }),
        ),

        // Axis labels
        h.text(
          [
            h.X(String(PW / 2)),
            h.Y(String(PH + 30)),
            h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
          ],
          [xLabel],
        ),
        h.text(
          [
            h.X('0'),
            h.Y('0'),
            h.Transform(`rotate(-90) translate(${-(PH / 2)}, -44)`),
            h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
          ],
          [yLabel],
        ),

        // Plot frame
        h.rect(
          [
            h.X('0'),
            h.Y('0'),
            h.Width(String(PW)),
            h.Height(String(PH)),
            h.Fill('none'),
            h.Stroke('var(--card-border, #1e1e33)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        // Points
        h.g(
          [],
          points.map((pt) => {
            const px = xScale(pt.x);
            const py = yScale(pt.y);
            const isActive = pt.label === active;
            const isInactive = active !== null && !isActive;
            const color = colMap.get(pt.category) ?? '#6366f1';

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredPoint({ label: pt.label }))),
                h.OnMouseLeave(toParentMessage(BlurredPoint())),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.circle(
                  [
                    h.Cx(String(px)),
                    h.Cy(String(py)),
                    h.R(isActive ? '6' : '4'),
                    h.Fill(color),
                    h.Opacity(isInactive ? '0.2' : '0.85'),
                    h.Style({ transition: 'r 80ms, opacity 80ms' }),
                  ],
                  [],
                ),
                ...(isActive
                  ? [
                      h.text(
                        [
                          h.X(String(px + 8)),
                          h.Y(String(py - 6)),
                          h.Style({
                            'font-size': '0.6rem',
                            'font-weight': '600',
                            fill: color,
                            'pointer-events': 'none',
                          }),
                        ],
                        [pt.label],
                      ),
                    ]
                  : []),
              ],
            );
          }),
        ),

        // Legend
        h.g(
          [h.Transform(`translate(0, ${PH + 8})`)],
          categories.map((cat, i) =>
            h.g(
              [h.Transform(`translate(${i * legendItemWidth}, 0)`)],
              [
                h.circle(
                  [h.Cx('5'), h.Cy('0'), h.R('3.5'), h.Fill(cat.color), h.Opacity('0.85')],
                  [],
                ),
                h.text(
                  [
                    h.X('13'),
                    h.Y('0'),
                    h.Style({
                      'dominant-baseline': 'middle',
                      'font-size': '0.58rem',
                      fill: '#64748b',
                    }),
                  ],
                  [cat.name],
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  ]);
}
