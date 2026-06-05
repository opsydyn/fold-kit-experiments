import { divergingScale, interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { format } from '@opsydyn/foldkit-viz/math/format';
import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { rdBu } from '@opsydyn/foldkit-viz/math/schemes';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type Bar = Readonly<{
  label: string;
  value: number; // e.g. YoY return as decimal
}>;

export type InitConfig = Readonly<{
  bars: ReadonlyArray<Bar>;
  xLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  bars: ReadonlyArray<Bar>;
  xLabel: string;
  activeLabel: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 20, right: 16, bottom: 40, left: 48, ...cfg.margins },
  );
  return [{ bars: cfg.bars, xLabel: cfg.xLabel ?? '', activeLabel: Option.none(), layout }, []];
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
      HoveredBar: ({ label }) => [{ ...model, activeLabel: Option.some(label) }, []],
      BlurredBar: () => [{ ...model, activeLabel: Option.none() }, []],
    }),
  );

// VIEW

const fmtPct = format('.1~%');

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Diverging bar chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { bars, xLabel, activeLabel } = model;

  const active = Option.isSome(activeLabel) ? activeLabel.value : null;

  const values = bars.map((b) => b.value);
  const absMax = Math.max(...values.map(Math.abs));
  const domainPad = absMax * 1.2;

  const xScale = linear({ domain: [-domainPad, domainPad], range: [0, PW] });
  const yScale = band({
    domain: bars.map((b) => b.label),
    range: [0, PH],
    paddingInner: 0.2,
    paddingOuter: 0.1,
  });
  const zeroX = xScale(0);

  const xTicks = linearTicks([-domainPad, domainPad], 6);

  // Diverging color: negative → red, 0 → white, positive → blue
  const colorFn = divergingScale({
    domain: [-domainPad, 0, domainPad],
    interpolator: interpolateRgbBasis([...rdBu]),
  });

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // X gridlines + tick labels
        h.g(
          [],
          xTicks.map((t) => {
            const px = xScale(t);
            const isZero = t === 0;
            return h.g(
              [],
              [
                h.line(
                  [
                    h.X1(String(px)),
                    h.Y1('0'),
                    h.X2(String(px)),
                    h.Y2(String(PH)),
                    h.Stroke(isZero ? 'var(--chart-axis, #3a3a3a)' : 'var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth(isZero ? '1.5' : '1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(px)),
                    h.Y(String(PH + 14)),
                    h.Style({ 'text-anchor': 'middle', 'font-size': '0.6rem', fill: '#94a3b8' }),
                  ],
                  [fmtPct(t)],
                ),
              ],
            );
          }),
        ),

        // Bars
        h.g(
          [],
          bars.map((bar) => {
            const py = yScale.position(bar.label);
            const bh = yScale.bandwidth;
            const px = xScale(bar.value);
            const barX = Math.min(px, zeroX);
            const barW = Math.abs(px - zeroX);
            const isActive = bar.label === active;
            const isInactive = active !== null && !isActive;
            const color = colorFn(bar.value);

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredBar({ label: bar.label }))),
                h.OnMouseLeave(toParentMessage(BlurredBar({}))),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.rect(
                  [
                    h.X(String(barX)),
                    h.Y(String(py)),
                    h.Width(String(Math.max(1, barW))),
                    h.Height(String(bh)),
                    h.Fill(color),
                    h.Opacity(isInactive ? '0.3' : '0.9'),
                    h.Style({ transition: 'opacity 80ms' }),
                  ],
                  [],
                ),
                ...(isActive
                  ? [
                      h.text(
                        [
                          h.X(String(bar.value >= 0 ? px + 4 : px - 4)),
                          h.Y(String(py + bh / 2)),
                          h.Style({
                            'text-anchor': bar.value >= 0 ? 'start' : 'end',
                            'dominant-baseline': 'middle',
                            'font-size': '0.62rem',
                            'font-weight': '600',
                            fill: '#1e293b',
                            'pointer-events': 'none',
                          }),
                        ],
                        [fmtPct(bar.value)],
                      ),
                    ]
                  : []),
              ],
            );
          }),
        ),

        // Y axis labels (bar names, left of axis)
        h.g(
          [],
          bars.map((bar) => {
            const py = yScale.position(bar.label);
            const bh = yScale.bandwidth;
            const isActive = bar.label === active;
            return h.text(
              [
                h.X(String(zeroX - 5)),
                h.Y(String(py + bh / 2)),
                h.Style({
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.6rem',
                  'font-weight': isActive ? '600' : '400',
                  fill: isActive ? '#1e293b' : '#64748b',
                }),
              ],
              [bar.label],
            );
          }),
        ),

        // X axis label
        ...(xLabel
          ? [
              h.text(
                [
                  h.X(String(PW / 2)),
                  h.Y(String(PH + 30)),
                  h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', fill: '#64748b' }),
                ],
                [xLabel],
              ),
            ]
          : []),
      ],
    ),
  ]);
}
