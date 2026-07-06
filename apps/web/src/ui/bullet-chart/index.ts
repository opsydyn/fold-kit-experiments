import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL

export type BulletDatum = Readonly<{
  label: string;
  /** Actual measured value */
  value: number;
  /** Target / goal marker */
  target: number;
  /** Background ranges [poor, satisfactory, good] — each is the upper bound */
  ranges: readonly [number, number, number];
}>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<BulletDatum>;
  /** Color for the actual value bar */
  color?: string;
  /** Color for the target marker */
  targetColor?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  data: ReadonlyArray<BulletDatum>;
  color: string;
  targetColor: string;
  activeIndex: Option.Option<number>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: cfg.data.length * 56 + 16, ...cfg.dims },
    { top: 16, right: 24, bottom: 8, left: 120, ...cfg.margins },
  );
  return [
    {
      data: cfg.data,
      color: cfg.color ?? '#1e40af',
      targetColor: cfg.targetColor ?? 'var(--page-text, #e8e8ff)',
      activeIndex: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredRow = m('HoveredRow', { index: Schema.Number });
export const BlurredRow = m('BlurredRow', {});

export const Message = Schema.Union([HoveredRow, BlurredRow]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredRow: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredRow: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

const RANGE_VARS = [
  'var(--chart-range-1, #1a1a2e)',
  'var(--chart-range-2, #1e1e33)',
  'var(--chart-range-3, #252540)',
] as const;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Bullet chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { data, color, targetColor, activeIndex } = model;

  const rowH = Math.floor(PH / data.length);
  const barH = Math.round(rowH * 0.3);
  const targetW = 3;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      data.map((d, i) => {
        const maxVal = d.ranges[2];
        const xScale = linear({ domain: [0, maxVal * 1.05], range: [0, PW] });
        const y = i * rowH;
        const midY = y + rowH / 2;
        const isActive = Option.isSome(activeIndex) && activeIndex.value === i;

        return h.g(
          [
            h.OnMouseEnter(toParentMessage(HoveredRow({ index: i }))),
            h.OnMouseLeave(toParentMessage(BlurredRow())),
            h.Style({ cursor: 'default' }),
            h.AriaLabel(`${d.label}: ${d.value} of ${d.target} target`),
          ],
          [
            // Row label
            h.text(
              [
                h.X('-8'),
                h.Y(String(r3(midY))),
                h.Style({
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.72rem',
                  'font-weight': isActive ? '600' : '400',
                  fill: isActive ? 'var(--chart-label, #555)' : 'var(--chart-label-muted, #888)',
                }),
              ],
              [d.label],
            ),

            // Background range bands (poor → satisfactory → good)
            ...[d.ranges[0], d.ranges[1], d.ranges[2]].map((bound, ri) => {
              const prev = ri === 0 ? 0 : ri === 1 ? d.ranges[0] : d.ranges[1];
              const bw = r3(xScale(bound) - xScale(prev));
              const bx = r3(xScale(prev));
              return h.rect(
                [
                  h.X(String(bx)),
                  h.Y(String(r3(y + rowH * 0.1))),
                  h.Width(String(bw)),
                  h.Height(String(r3(rowH * 0.8))),
                  h.Fill(RANGE_VARS[ri] ?? 'var(--chart-range-1, #1a1a2e)'),
                  h.Style({ transition: 'fill 120ms' }),
                ],
                [],
              );
            }),

            // Actual value bar (centred vertically)
            h.rect(
              [
                h.X('0'),
                h.Y(String(r3(midY - barH / 2))),
                h.Width(String(r3(xScale(d.value)))),
                h.Height(String(barH)),
                h.Fill(color),
                h.Opacity(isActive ? '1' : '0.85'),
                h.Style({ transition: 'opacity 120ms' }),
              ],
              [],
            ),

            // Target marker line
            h.rect(
              [
                h.X(String(r3(xScale(d.target) - targetW / 2))),
                h.Y(String(r3(midY - rowH * 0.3))),
                h.Width(String(targetW)),
                h.Height(String(r3(rowH * 0.6))),
                h.Fill(targetColor),
              ],
              [],
            ),

            // Value label (when active)
            ...(isActive
              ? [
                  h.text(
                    [
                      h.X(String(r3(xScale(d.value) + 4))),
                      h.Y(String(r3(midY))),
                      h.Style({
                        'dominant-baseline': 'middle',
                        'font-size': '0.65rem',
                        'font-weight': '600',
                        fill: color,
                      }),
                    ],
                    [String(d.value)],
                  ),
                ]
              : []),
          ],
        );
      }),
    ),
  ]);
}
