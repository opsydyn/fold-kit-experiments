import { type Bin, bin } from '@opsydyn/foldkit-viz/math/bin';
import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot, valueTooltip, yGridlines } from '../shared';

// MODEL

export type HistogramDatum = Readonly<{ value: number; label?: string }>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<HistogramDatum>;
  binCount?: number;
  color?: string;
  xLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type ComputedBin = Readonly<{
  x0: number;
  x1: number;
  count: number;
}>;

export type Model = Readonly<{
  bins: ReadonlyArray<ComputedBin>;
  totalCount: number;
  color: string;
  xLabel: string;
  activeBin: Option.Option<number>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const binCount = cfg.binCount ?? 10;
  const rawBins: ReadonlyArray<Bin<HistogramDatum>> = bin(cfg.data, {
    value: (d) => d.value,
    thresholds: binCount,
  });

  const bins: ReadonlyArray<ComputedBin> = rawBins.map((b) => ({
    x0: b.x0,
    x1: b.x1,
    count: b.count,
  }));
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 24, right: 20, bottom: 48, left: 44, ...cfg.margins },
  );

  return [
    {
      bins,
      totalCount: cfg.data.length,
      color: cfg.color ?? '#6366f1',
      xLabel: cfg.xLabel ?? '',
      activeBin: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredBin = m('HoveredBin', { index: Schema.Number });
export const BlurredBin = m('BlurredBin', {});

export const Message = Schema.Union([HoveredBin, BlurredBin]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredBin: ({ index }) => [{ ...model, activeBin: Option.some(index) }, []],
      BlurredBin: () => [{ ...model, activeBin: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
  renderTooltip?: (datum: ComputedBin, x: number, y: number) => Html;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Histogram', renderTooltip } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { bins, color, xLabel, activeBin } = model;

  if (bins.length === 0) return h.svg([h.ViewBox(`0 0 ${W} ${H}`), h.Width('100%')], []);

  const maxCount = Math.max(...bins.map((b) => b.count));
  const domainMin = bins[0]?.x0 ?? 0;
  const domainMax = bins[bins.length - 1]?.x1 ?? 1;

  const xScale = linear({ domain: [domainMin, domainMax], range: [0, PW] });
  const yScale = linear({ domain: [0, maxCount * 1.1], range: [PH, 0] });
  const yTicks = linearTicks([0, maxCount * 1.1], 5);

  const activeIdx = Option.isSome(activeBin) ? activeBin.value : -1;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        yGridlines(h, yTicks, (v) => yScale(v), PW, {
          gridColor: 'var(--chart-grid, #2d2d2d)',
          labelColor: '#94a3b8',
          labelSize: '0.65rem',
          format: (v) => String(Math.round(v)),
        }),

        // Bars
        h.g(
          [],
          bins.map((b, i) => {
            const x = r3(xScale(b.x0));
            const barW = r3(Math.max(0, xScale(b.x1) - xScale(b.x0) - 1));
            const barH = r3(PH - yScale(b.count));
            const barY = r3(yScale(b.count));
            const isActive = i === activeIdx;

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredBin({ index: i }))),
                h.OnMouseLeave(toParentMessage(BlurredBin({}))),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.rect(
                  [
                    h.X(String(x)),
                    h.Y(String(barY)),
                    h.Width(String(barW)),
                    h.Height(String(barH)),
                    h.Fill(color),
                    h.Opacity(isActive ? '1' : '0.75'),
                    h.Style({ transition: 'opacity 80ms' }),
                  ],
                  [],
                ),
                ...(isActive && b.count > 0
                  ? [
                      renderTooltip
                        ? renderTooltip(b, x + barW / 2, barY)
                        : valueTooltip(h, x + barW / 2, barY, String(b.count), {
                            color,
                            offsetY: 5,
                          }),
                    ]
                  : []),
              ],
            );
          }),
        ),

        // X axis
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

        // X tick labels — min, mid, max
        h.g(
          [h.Transform(`translate(0,${PH})`)],
          [domainMin, (domainMin + domainMax) / 2, domainMax].map((tick) =>
            h.text(
              [
                h.X(String(r3(xScale(tick)))),
                h.Y('14'),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '0.65rem',
                  fill: '#94a3b8',
                }),
              ],
              [String(Math.round(tick))],
            ),
          ),
        ),

        ...(xLabel
          ? [
              h.text(
                [
                  h.X(String(PW / 2)),
                  h.Y(String(PH + 36)),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '0.65rem',
                    fill: '#64748b',
                  }),
                ],
                [xLabel],
              ),
            ]
          : []),
      ],
    ),
  ]);
}
