import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { wedge } from '@opsydyn/foldkit-viz/shape/areaRadial';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — Wind rose / polar bar chart
// Each segment = one directional/categorical bin with a magnitude.

export type WindRoseSegment = Readonly<{
  label: string;
  /** Magnitude — determines the outer radius */
  value: number;
  color: string;
}>;

export type InitConfig = Readonly<{
  segments: ReadonlyArray<WindRoseSegment>;
  /** Hole radius as fraction of total (0 = solid, default 0.15) */
  innerRatio?: number;
  /** Label for the centre (e.g. compass "N") */
  centerLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  segments: ReadonlyArray<WindRoseSegment>;
  innerRatio: number;
  centerLabel: string;
  activeIndex: Option.Option<number>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const size = Math.min(cfg.dims?.width ?? 300, cfg.dims?.height ?? 300);
  const layout = makeLayout(
    { width: size, height: size, ...cfg.dims },
    { top: 20, right: 20, bottom: 20, left: 20, ...cfg.margins },
  );
  return [
    {
      segments: cfg.segments,
      innerRatio: cfg.innerRatio ?? 0.15,
      centerLabel: cfg.centerLabel ?? '',
      activeIndex: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredSegment = m('HoveredSegment', { index: Schema.Number });
export const BlurredSegment = m('BlurredSegment', {});

export const Message = Schema.Union([HoveredSegment, BlurredSegment]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSegment: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredSegment: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Wind rose chart' } = config;
  const { segments, innerRatio, centerLabel, activeIndex } = model;
  const {
    dims: { width: W, height: H },
    pw: PW,
    ph: PH,
  } = model.layout;

  const n = segments.length;
  if (n === 0) return svgRoot(h, { width: W, height: H, ariaLabel }, null, []);

  const cx = r3(PW / 2);
  const cy = r3(PH / 2);
  const maxR = r3(Math.min(PW, PH) / 2 - 4);
  const innerR = r3(maxR * innerRatio);

  const maxValue = segments.reduce((m, s) => Math.max(m, s.value), 0);
  const rScale = linear({ domain: [0, maxValue], range: [innerR, maxR] });

  const angleStep = (2 * Math.PI) / n;
  // Small gap between segments (0.04 radians ≈ 2.3°)
  const gap = Math.min(0.04, angleStep * 0.1);

  const active = Option.isSome(activeIndex) ? activeIndex.value : -1;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [
        h.Transform(
          `translate(${cx + model.layout.margins.left},${cy + model.layout.margins.top})`,
        ),
      ],
      [
        // Reference rings at 25%, 50%, 75%, 100% of maxValue
        h.g(
          [h.Attribute('aria-hidden', 'true')],
          [0.25, 0.5, 0.75, 1.0].map((frac) => {
            const r = r3(rScale(maxValue * frac));
            return h.circle(
              [
                h.Cx('0'),
                h.Cy('0'),
                h.R(String(r)),
                h.Fill('none'),
                h.Stroke('var(--chart-grid, #2d2d2d)'),
                h.StrokeWidth('1'),
                h.Style({ 'stroke-dasharray': '3,4' }),
              ],
              [],
            );
          }),
        ),

        // Spokes
        h.g(
          [h.Attribute('aria-hidden', 'true')],
          segments.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return h.line(
              [
                h.X1('0'),
                h.Y1('0'),
                h.X2(String(r3(maxR * Math.cos(angle)))),
                h.Y2(String(r3(maxR * Math.sin(angle)))),
                h.Stroke('var(--chart-grid, #2d2d2d)'),
                h.StrokeWidth('1'),
                h.Opacity('0.5'),
              ],
              [],
            );
          }),
        ),

        // Wedge segments
        ...segments.map((seg, i) => {
          const startAngle = i * angleStep - Math.PI / 2 + gap / 2;
          const endAngle = (i + 1) * angleStep - Math.PI / 2 - gap / 2;
          const outerR = r3(rScale(seg.value));
          const isActive = i === active;
          const isDimmed = active >= 0 && !isActive;
          const pathD = wedge(startAngle, endAngle, outerR, innerR);
          if (!pathD) return h.g([], []);

          // Label position: midpoint of arc, just outside maxR
          const midAngle = (startAngle + endAngle) / 2;
          const labelR = maxR + 14;
          const lx = r3(labelR * Math.cos(midAngle));
          const ly = r3(labelR * Math.sin(midAngle));

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredSegment({ index: i }))),
              h.OnMouseLeave(toParentMessage(BlurredSegment({}))),
              h.Style({ cursor: 'pointer' }),
              h.AriaLabel(`${seg.label}: ${seg.value}`),
            ],
            [
              h.path(
                [
                  h.D(pathD),
                  h.Fill(seg.color),
                  h.Opacity(isDimmed ? '0.2' : isActive ? '1' : '0.8'),
                  h.Style({ transition: 'opacity 150ms' }),
                ],
                [],
              ),

              // Segment label
              h.text(
                [
                  h.X(String(lx)),
                  h.Y(String(ly)),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'middle',
                    'font-size': isActive ? '0.7rem' : '0.62rem',
                    'font-weight': isActive ? '700' : '400',
                    fill: isDimmed ? 'var(--chart-label-muted, #555)' : 'var(--chart-label, #888)',
                    transition: 'font-size 80ms',
                  }),
                ],
                [seg.label],
              ),

              // Value label (inside wedge when active)
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String(r3(((outerR + innerR) / 2) * Math.cos(midAngle)))),
                        h.Y(String(r3(((outerR + innerR) / 2) * Math.sin(midAngle)))),
                        h.Style({
                          'text-anchor': 'middle',
                          'dominant-baseline': 'middle',
                          'font-size': '0.62rem',
                          'font-weight': '700',
                          fill: '#fff',
                          'pointer-events': 'none',
                        }),
                      ],
                      [String(seg.value)],
                    ),
                  ]
                : []),
            ],
          );
        }),

        // Centre label
        ...(centerLabel
          ? [
              h.text(
                [
                  h.X('0'),
                  h.Y('0'),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'middle',
                    'font-size': '0.72rem',
                    'font-weight': '600',
                    fill: 'var(--chart-label, #888)',
                  }),
                ],
                [centerLabel],
              ),
            ]
          : []),
      ],
    ),
  ]);
}
