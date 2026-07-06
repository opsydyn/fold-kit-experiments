import { threshold } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type Endpoint = Readonly<{
  label: string;
  ms: number;
}>;

export type InitConfig = Readonly<{
  endpoints: ReadonlyArray<Endpoint>;
  title?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  endpoints: ReadonlyArray<Endpoint>;
  title: string;
  hovered: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 20, right: 56, bottom: 36, left: 140, ...cfg.margins },
  );
  return [{ endpoints: cfg.endpoints, title: cfg.title ?? '', hovered: Option.none(), layout }, []];
}

// MESSAGE

export const HoveredBar = m('HoveredBar', { label: Schema.String });
export const BlurredBar = m('BlurredBar', {});

export const Message = Schema.Union([HoveredBar, BlurredBar]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBar: ({ label }) => [{ ...model, hovered: Option.some(label) }, []],
      BlurredBar: () => [{ ...model, hovered: Option.none() }, []],
    }),
  );

// VIEW

// Threshold scale: < 100ms green, 100–500ms amber, ≥ 500ms red
const colorFn = threshold<string>([100, 500], ['#10b981', '#f59e0b', '#ef4444']);
const LEGEND = [
  { label: '< 100 ms', color: '#10b981' },
  { label: '100–500 ms', color: '#f59e0b' },
  { label: '≥ 500 ms', color: '#ef4444' },
];

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Threshold bar chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { endpoints, title, hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;
  const maxMs = Math.max(...endpoints.map((e) => e.ms)) * 1.15;

  const barH = Math.floor(PH / endpoints.length) - 4;
  const barStep = PH / endpoints.length;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Title
        ...(title
          ? [
              h.text(
                [
                  h.X(String(PW / 2)),
                  h.Y('-8'),
                  h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
                ],
                [title],
              ),
            ]
          : []),

        // Bars
        h.g(
          [],
          endpoints.map((ep, idx) => {
            const py = idx * barStep + (barStep - barH) / 2;
            const bw = (ep.ms / maxMs) * PW;
            const col = colorFn(ep.ms) ?? '#64748b';
            const isActive = ep.label === active;
            const isInactive = active !== null && !isActive;

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredBar({ label: ep.label }))),
                h.OnMouseLeave(toParentMessage(BlurredBar())),
                h.Style({ cursor: 'default' }),
              ],
              [
                // Endpoint label
                h.text(
                  [
                    h.X('-8'),
                    h.Y(String(py + barH / 2)),
                    h.Style({
                      'text-anchor': 'end',
                      'dominant-baseline': 'middle',
                      'font-size': '0.6rem',
                      'font-weight': isActive ? '600' : '400',
                      fill: isActive ? '#1e293b' : '#64748b',
                    }),
                  ],
                  [ep.label],
                ),
                // Bar
                h.rect(
                  [
                    h.X('0'),
                    h.Y(String(py)),
                    h.Width(String(Math.max(2, bw))),
                    h.Height(String(barH)),
                    h.Fill(col),
                    h.Opacity(isInactive ? '0.25' : '0.85'),
                    h.Style({ transition: 'opacity 80ms' }),
                  ],
                  [],
                ),
                // Value label
                h.text(
                  [
                    h.X(String(Math.max(2, bw) + 4)),
                    h.Y(String(py + barH / 2)),
                    h.Style({
                      'dominant-baseline': 'middle',
                      'font-size': '0.6rem',
                      'font-weight': isActive ? '600' : '400',
                      fill: isActive ? col : '#94a3b8',
                      'pointer-events': 'none',
                    }),
                  ],
                  [`${ep.ms} ms`],
                ),
              ],
            );
          }),
        ),

        // X axis baseline
        h.line(
          [
            h.X1('0'),
            h.Y1(String(PH)),
            h.X2(String(PW)),
            h.Y2(String(PH)),
            h.Stroke('var(--chart-grid, #2d2d2d)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        // Legend
        h.g(
          [h.Transform(`translate(0,${PH + 20})`)],
          LEGEND.map((item, i) =>
            h.g(
              [h.Transform(`translate(${i * 105},0)`)],
              [
                h.rect(
                  [
                    h.X('0'),
                    h.Y('-6'),
                    h.Width('10'),
                    h.Height('8'),
                    h.Fill(item.color),
                    h.Opacity('0.85'),
                  ],
                  [],
                ),
                h.text(
                  [h.X('14'), h.Y('0'), h.Style({ 'font-size': '0.58rem', fill: '#64748b' })],
                  [item.label],
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  ]);
}
