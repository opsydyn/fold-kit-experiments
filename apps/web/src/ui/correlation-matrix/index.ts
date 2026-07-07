import { interpolateLab } from '@opsydyn/foldkit-viz/math/color';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — pairwise Pearson correlation matrix

export type CorrelationMatrix = {
  readonly labels: ReadonlyArray<string>;
  /** Row-major flat array of correlation values [-1..1], length = labels.length² */
  readonly values: ReadonlyArray<number>;
};

export type InitConfig = Readonly<{
  matrix: CorrelationMatrix;
  /** Color for strong negative correlation (default deep red) */
  colorNeg?: string;
  /** Color for zero correlation (default near-white) */
  colorMid?: string;
  /** Color for strong positive correlation (default deep blue) */
  colorPos?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  matrix: CorrelationMatrix;
  colorNeg: string;
  colorMid: string;
  colorPos: string;
  activeCell: Option.Option<readonly [number, number]>;
  readonly layout: Layout;
}>;

/** Compute Pearson correlations from a column-major data matrix */
export function pearsonMatrix(
  labels: ReadonlyArray<string>,
  data: ReadonlyArray<ReadonlyArray<number>>,
): CorrelationMatrix {
  const n = labels.length;
  const len = data[0]?.length ?? 0;
  const means = data.map((col) => col.reduce((s, v) => s + v, 0) / len);
  const stds = data.map((col, i) => {
    const mu = means[i] ?? 0;
    return Math.sqrt(col.reduce((s, v) => s + (v - mu) ** 2, 0) / len);
  });
  const values: number[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r === c) {
        values.push(1);
        continue;
      }
      const mu_r = means[r] ?? 0;
      const mu_c = means[c] ?? 0;
      const std_r = stds[r] ?? 1;
      const std_c = stds[c] ?? 1;
      const colR = data[r] ?? [];
      const colC = data[c] ?? [];
      let cov = 0;
      for (let i = 0; i < len; i++) {
        cov += ((colR[i] ?? 0) - mu_r) * ((colC[i] ?? 0) - mu_c);
      }
      values.push(Math.max(-1, Math.min(1, cov / len / (std_r * std_c))));
    }
  }
  return { labels, values };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const n = cfg.matrix.labels.length;
  const cellSize = Math.min(48, Math.floor(340 / n));
  const layout = makeLayout(
    { width: n * cellSize + 120, height: n * cellSize + 80, ...cfg.dims },
    { top: 80, right: 16, bottom: 16, left: 110, ...cfg.margins },
  );
  return [
    {
      matrix: cfg.matrix,
      colorNeg: cfg.colorNeg ?? '#b91c1c',
      colorMid: cfg.colorMid ?? '#f8fafc',
      colorPos: cfg.colorPos ?? '#1d4ed8',
      activeCell: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredCell = m('HoveredCell', { row: Schema.Number, col: Schema.Number });
export const BlurredCell = m('BlurredCell', {});

export const Message = Schema.Union([HoveredCell, BlurredCell]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCell: ({ row, col }) => [
        { ...model, activeCell: Option.some([row, col] as const) },
        [],
      ],
      BlurredCell: () => [{ ...model, activeCell: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Correlation matrix' } = config;
  const { matrix, colorNeg, colorMid, colorPos, activeCell } = model;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
  } = model.layout;

  const n = matrix.labels.length;
  const cellSize = Math.floor(PW / n);

  const [activeRow, activeCol] = Option.isSome(activeCell) ? activeCell.value : [-1, -1];

  // Colour scale: -1 → colorNeg, 0 → colorMid, +1 → colorPos
  // Use two-segment interpolation through mid
  const colorScale = (v: number): string => {
    if (v <= 0) {
      return interpolateLab(colorNeg, colorMid)((v + 1) / 1);
    }
    return interpolateLab(colorMid, colorPos)(v);
  };

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Column labels (rotated, top)
        h.g(
          [],
          matrix.labels.map((label, ci) => {
            const x = r3(ci * cellSize + cellSize / 2);
            return h.text(
              [
                h.Transform(`translate(${x},-8) rotate(-45)`),
                h.Style({
                  'text-anchor': 'start',
                  'dominant-baseline': 'middle',
                  'font-size': '0.65rem',
                  'font-weight': ci === activeCol ? '700' : '400',
                  fill:
                    ci === activeCol
                      ? 'var(--chart-label, #888)'
                      : 'var(--chart-label-muted, #555)',
                }),
              ],
              [label],
            );
          }),
        ),

        // Row labels (left)
        h.g(
          [],
          matrix.labels.map((label, ri) => {
            const y = r3(ri * cellSize + cellSize / 2);
            return h.text(
              [
                h.X('-8'),
                h.Y(String(y)),
                h.Style({
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.65rem',
                  'font-weight': ri === activeRow ? '700' : '400',
                  fill:
                    ri === activeRow
                      ? 'var(--chart-label, #888)'
                      : 'var(--chart-label-muted, #555)',
                }),
              ],
              [label],
            );
          }),
        ),

        // Matrix cells
        h.g(
          [],
          Array.from({ length: n * n }, (_, idx) => {
            const ri = Math.floor(idx / n);
            const ci = idx % n;
            const val = matrix.values[idx] ?? 0;
            const isActive = ri === activeRow && ci === activeCol;
            const isHighlighted = ri === activeRow || ci === activeCol;
            const opacity = activeRow >= 0 && !isHighlighted ? 0.4 : 1;

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredCell({ row: ri, col: ci }))),
                h.OnMouseLeave(toParentMessage(BlurredCell())),
                h.Style({ cursor: 'default' }),
                h.AriaLabel(`${matrix.labels[ri]} vs ${matrix.labels[ci]}: ${val.toFixed(2)}`),
              ],
              [
                h.rect(
                  [
                    h.X(String(r3(ci * cellSize))),
                    h.Y(String(r3(ri * cellSize))),
                    h.Width(String(cellSize - 1)),
                    h.Height(String(cellSize - 1)),
                    h.Fill(colorScale(val)),
                    h.Opacity(String(r3(opacity))),
                    ...(isActive
                      ? [h.Stroke('var(--chart-axis, #555)'), h.StrokeWidth('1.5')]
                      : []),
                    h.Style({ transition: 'opacity 100ms' }),
                  ],
                  [],
                ),
                // Show value text only in larger cells or active
                ...(cellSize >= 36 || isActive
                  ? [
                      h.text(
                        [
                          h.X(String(r3(ci * cellSize + cellSize / 2))),
                          h.Y(String(r3(ri * cellSize + cellSize / 2))),
                          h.Style({
                            'text-anchor': 'middle',
                            'dominant-baseline': 'middle',
                            'font-size': isActive ? '0.72rem' : '0.6rem',
                            'font-weight': ri === ci ? '700' : '400',
                            fill: Math.abs(val) > 0.5 ? '#fff' : 'var(--chart-label, #555)',
                            'pointer-events': 'none',
                          }),
                        ],
                        [val.toFixed(ri === ci ? 0 : 2)],
                      ),
                    ]
                  : []),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
}
