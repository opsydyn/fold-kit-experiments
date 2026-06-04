import { linear, linearTicks, point } from '@opsydyn/foldkit-viz/math/scale';
import { boxStats, kde, silvermanBandwidth } from '@opsydyn/foldkit-viz/math/stats';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot, makeLayout } from '../shared';
import type { Dims, Layout, Margins } from '../shared';

// MODEL

export type ViolinSeries = Readonly<{
  label: string;
  values: ReadonlyArray<number>;
}>;

export type InitConfig = Readonly<{
  series: ReadonlyArray<ViolinSeries>;
  yLabel?: string;
  colors?: ReadonlyArray<string>;
  kdePoints?: number;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

type DensityPoint = Readonly<{ value: number; density: number }>;

type ComputedViolin = Readonly<{
  label: string;
  density: ReadonlyArray<DensityPoint>;
  maxDensity: number;
  q1: number;
  median: number;
  q3: number;
  color: string;
}>;

export type Model = Readonly<{
  violins: ReadonlyArray<ComputedViolin>;
  yDomain: readonly [number, number];
  yLabel: string;
  activeLabel: Option.Option<string>;
  labels: ReadonlyArray<string>;
  readonly layout: Layout;
}>;

const DEFAULT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const colors = cfg.colors ?? DEFAULT_COLORS;
  const kdePoints = cfg.kdePoints ?? 48;

  const allValues = cfg.series.flatMap((s) => s.values);
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yPad = (yMax - yMin) * 0.06;
  const yDomain: readonly [number, number] = [yMin - yPad, yMax + yPad];

  const thresholds = Array.from(
    { length: kdePoints },
    (_, i) => yDomain[0] + (i / (kdePoints - 1)) * (yDomain[1] - yDomain[0]),
  );

  const violins: ComputedViolin[] = cfg.series.map((s, i) => {
    const bw = silvermanBandwidth(s.values);
    const density = kde(s.values, thresholds, bw);
    const maxDensity = Math.max(...density.map((d) => d.density));
    const stats = boxStats([...s.values].sort((a, b) => a - b));
    return {
      label: s.label,
      density,
      maxDensity,
      q1: stats.q1,
      median: stats.median,
      q3: stats.q3,
      color: colors[i % colors.length] as string,
    };
  });

  const layout = makeLayout(
    { width: 480, height: 300, ...cfg.dims },
    { top: 24, right: 20, bottom: 44, left: 52, ...cfg.margins },
  );

  return [
    {
      violins,
      yDomain,
      yLabel: cfg.yLabel ?? '',
      activeLabel: Option.none(),
      labels: cfg.series.map((s) => s.label),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredViolin = m('HoveredViolin', { label: Schema.String });
export const BlurredViolin = m('BlurredViolin', {});

export const Message = Schema.Union([HoveredViolin, BlurredViolin]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredViolin: ({ label }) => [{ ...model, activeLabel: Option.some(label) }, []],
      BlurredViolin: () => [{ ...model, activeLabel: Option.none() }, []],
    }),
  );

// VIEW

function violinPath(
  density: ReadonlyArray<DensityPoint>,
  maxDensity: number,
  cx: number,
  halfWidth: number,
  yScale: (v: number) => number,
): string {
  if (density.length === 0 || maxDensity === 0) return '';
  const scale = halfWidth / maxDensity;
  const pts = density.map((d) => ({
    x: r3(d.density * scale),
    y: r3(yScale(d.value)),
  }));

  const left = pts.map((p) => `${r3(cx - p.x)},${p.y}`);
  const right = [...pts].reverse().map((p) => `${r3(cx + p.x)},${p.y}`);
  return `M${left[0]} L${left.slice(1).join(' L')} L${right[0]} L${right.slice(1).join(' L')}Z`;
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Violin plot' } = config;
  const { dims: { width: W, height: H }, margins: { top: MT, left: ML }, pw: PW, ph: PH } = model.layout;
  const { violins, yDomain, yLabel, activeLabel, labels } = model;

  const xScale = point({ domain: labels, range: [0, PW], padding: 0.5 });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, 5);
  const halfWidth = xScale.step * 0.38;
  const activeStr = Option.isSome(activeLabel) ? activeLabel.value : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
      h.g(
        [h.Transform(`translate(${ML},${MT})`)],
        [
          // Y gridlines + labels
          h.g(
            [],
            yTicks.map((tick) => {
              const y = r3(yScale(tick));
              return h.g(
                [h.Transform(`translate(0,${y})`)],
                [
                  h.line(
                    [
                      h.X1('0'),
                      h.Y1('0'),
                      h.X2(String(PW)),
                      h.Y2('0'),
                      h.Stroke('#e5e7eb'),
                      h.StrokeWidth('1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('-8'),
                      h.Y('0'),
                      h.Style({
                        'text-anchor': 'end',
                        'dominant-baseline': 'middle',
                        'font-size': '0.62rem',
                        fill: '#94a3b8',
                      }),
                    ],
                    [String(Math.round(tick))],
                  ),
                ],
              );
            }),
          ),

          // Y axis label
          ...(yLabel
            ? [
                h.text(
                  [
                    h.Transform(`rotate(-90) translate(${-(PH / 2)}, -34)`),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'hanging',
                      'font-size': '0.65rem',
                      fill: '#64748b',
                    }),
                  ],
                  [yLabel],
                ),
              ]
            : []),

          // Violins
          h.g(
            [],
            violins.map((v) => {
              const cx = r3(xScale.position(v.label));
              const isActive = v.label === activeStr;
              const opacity = activeStr === null ? 0.8 : isActive ? 1 : 0.2;
              const path = violinPath(v.density, v.maxDensity, cx, halfWidth, yScale);

              const iqrTop = r3(yScale(v.q3));
              const iqrBot = r3(yScale(v.q1));
              const medY = r3(yScale(v.median));

              return h.g(
                [
                  h.OnMouseEnter(toParentMessage(HoveredViolin({ label: v.label }))),
                  h.OnMouseLeave(toParentMessage(BlurredViolin({}))),
                  h.Style({ cursor: 'default' }),
                ],
                [
                  // Violin shape
                  h.path(
                    [
                      h.D(path),
                      h.Fill(v.color),
                      h.Opacity(String(opacity)),
                      h.Style({ transition: 'opacity 80ms' }),
                    ],
                    [],
                  ),
                  // IQR bar
                  h.line(
                    [
                      h.X1(String(cx)),
                      h.Y1(String(iqrTop)),
                      h.X2(String(cx)),
                      h.Y2(String(iqrBot)),
                      h.Stroke('#fff'),
                      h.StrokeWidth('2'),
                      h.Opacity(String(opacity)),
                    ],
                    [],
                  ),
                  // Median dot
                  h.circle(
                    [
                      h.Cx(String(cx)),
                      h.Cy(String(medY)),
                      h.R('3'),
                      h.Fill('#fff'),
                      h.Stroke(v.color),
                      h.StrokeWidth('1.5'),
                      h.Opacity(String(opacity)),
                    ],
                    [],
                  ),
                ],
              );
            }),
          ),

          // X axis labels
          h.g(
            [h.Transform(`translate(0,${PH})`)],
            violins.map((v) => {
              const cx = r3(xScale.position(v.label));
              const isActive = v.label === activeStr;
              return h.text(
                [
                  h.X(String(cx)),
                  h.Y('14'),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': '0.65rem',
                    'font-weight': isActive ? '600' : '400',
                    fill: isActive ? '#1e293b' : '#64748b',
                    transition: 'font-weight 80ms',
                  }),
                ],
                [v.label],
              );
            }),
          ),
        ],
      ),
    ],
  );
}
