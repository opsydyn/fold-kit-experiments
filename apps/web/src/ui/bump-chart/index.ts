import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — temporal rankings (lower rank = better, rank 1 is top)

export type BumpSeries = Readonly<{
  label: string;
  color: string;
  /** Rank at each time step (1 = best). Length must match xLabels. */
  ranks: ReadonlyArray<number>;
}>;

export type InitConfig = Readonly<{
  series: ReadonlyArray<BumpSeries>;
  xLabels: ReadonlyArray<string>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  series: ReadonlyArray<BumpSeries>;
  xLabels: ReadonlyArray<string>;
  activeLabel: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const n = cfg.series.length;
  const layout = makeLayout(
    { width: 480, height: n * 36 + 48, ...cfg.dims },
    { top: 24, right: 80, bottom: 24, left: 80, ...cfg.margins },
  );
  return [{ series: cfg.series, xLabels: cfg.xLabels, activeLabel: Option.none(), layout }, []];
}

// MESSAGE

export const HoveredSeries = m('HoveredSeries', { label: Schema.String });
export const BlurredSeries = m('BlurredSeries', {});

export const Message = Schema.Union([HoveredSeries, BlurredSeries]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSeries: ({ label }) => [{ ...model, activeLabel: Option.some(label) }, []],
      BlurredSeries: () => [{ ...model, activeLabel: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Bump chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { series, xLabels, activeLabel } = model;

  const nSteps = xLabels.length;
  const nSeries = series.length;
  const active = Option.isSome(activeLabel) ? activeLabel.value : null;

  const xScale = linear({ domain: [0, nSteps - 1], range: [0, PW] });
  // Rank 1 = top → lower y value
  const yScale = linear({ domain: [1, nSeries], range: [0, PH] });

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Column labels (x-axis)
        h.g(
          [],
          xLabels.map((label, i) =>
            h.text(
              [
                h.X(String(r3(xScale(i)))),
                h.Y('-8'),
                h.Style({
                  'text-anchor': 'middle',
                  'font-size': '0.7rem',
                  fill: 'var(--chart-label, #888)',
                }),
              ],
              [label],
            ),
          ),
        ),

        // Series lines + dots
        ...series.map((s) => {
          const isActive = active === s.label;
          const isDimmed = active !== null && !isActive;
          const opacity = isDimmed ? 0.18 : 1;

          const coords: ReadonlyArray<readonly [number, number]> = s.ranks.map((rank, i) => [
            r3(xScale(i)),
            r3(yScale(rank)),
          ]);
          const pathD = line(coords, { curve: 'catmullRom' });
          const strokeW = isActive ? '3' : '2';

          return h.g(
            [
              h.Style({ cursor: 'pointer', opacity: String(opacity), transition: 'opacity 150ms' }),
              h.OnMouseEnter(toParentMessage(HoveredSeries({ label: s.label }))),
              h.OnMouseLeave(toParentMessage(BlurredSeries())),
              h.AriaLabel(`${s.label} rankings`),
            ],
            [
              // Line
              ...(pathD
                ? [
                    h.path(
                      [
                        h.D(pathD),
                        h.Fill('none'),
                        h.Stroke(s.color),
                        h.StrokeWidth(strokeW),
                        h.Style({ 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
                      ],
                      [],
                    ),
                  ]
                : []),

              // Dots at each step
              ...coords.map(([cx, cy]) =>
                h.circle(
                  [
                    h.Cx(String(cx)),
                    h.Cy(String(cy)),
                    h.R(isActive ? '5' : '4'),
                    h.Fill(s.color),
                    h.Stroke('var(--card-bg, #12121f)'),
                    h.StrokeWidth('2'),
                  ],
                  [],
                ),
              ),

              // Start label (left)
              h.text(
                [
                  h.X('-8'),
                  h.Y(String(r3(coords[0]?.[1] ?? 0))),
                  h.Style({
                    'text-anchor': 'end',
                    'dominant-baseline': 'middle',
                    'font-size': isActive ? '0.72rem' : '0.65rem',
                    'font-weight': isActive ? '700' : '400',
                    fill: s.color,
                  }),
                ],
                [s.label],
              ),

              // End rank label (right)
              h.text(
                [
                  h.X(String(PW + 8)),
                  h.Y(String(r3(coords[coords.length - 1]?.[1] ?? 0))),
                  h.Style({
                    'text-anchor': 'start',
                    'dominant-baseline': 'middle',
                    'font-size': '0.65rem',
                    'font-weight': isActive ? '700' : '400',
                    fill: s.color,
                  }),
                ],
                [`#${s.ranks[s.ranks.length - 1]}`],
              ),
            ],
          );
        }),

        // Rank labels on y-axis (right side of plot)
        h.g(
          [],
          Array.from({ length: nSeries }, (_, i) => {
            const rank = i + 1;
            const y = r3(yScale(rank));
            return h.g(
              [h.Transform(`translate(0,${y})`)],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1('0'),
                    h.X2(String(PW)),
                    h.Y2('0'),
                    h.Stroke('var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth('1'),
                    h.Style({ 'stroke-dasharray': '2,4' }),
                  ],
                  [],
                ),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
}
