import { cumsum } from '@opsydyn/foldkit-viz/math/array';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot, yGridlines } from '../shared';

// MODEL — Likert-scale diverging stacked bar
// Negative responses stack left of centre; positive stack right.

export type LikertCategory = Readonly<{
  label: string;
  /** Negative weight: -1 = strongly negative, 0 = neutral anchor */
  weight: number;
  color: string;
}>;

export type LikertRow = Readonly<{
  label: string;
  /** Counts per category, same order as `categories` */
  counts: ReadonlyArray<number>;
}>;

export type InitConfig = Readonly<{
  categories: ReadonlyArray<LikertCategory>;
  rows: ReadonlyArray<LikertRow>;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  categories: ReadonlyArray<LikertCategory>;
  rows: ReadonlyArray<LikertRow>;
  activeRow: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: cfg.rows.length * 44 + 56, ...cfg.dims },
    { top: 28, right: 80, bottom: 36, left: 140, ...cfg.margins },
  );
  return [{ categories: cfg.categories, rows: cfg.rows, activeRow: Option.none(), layout }, []];
}

// MESSAGE

export const HoveredRow = m('HoveredRow', { label: Schema.String });
export const BlurredRow = m('BlurredRow', {});

export const Message = Schema.Union([HoveredRow, BlurredRow]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredRow: ({ label }) => [{ ...model, activeRow: Option.some(label) }, []],
      BlurredRow: () => [{ ...model, activeRow: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Diverging stacked bar chart' } = config;
  const { categories, rows, activeRow } = model;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, right: MR, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;

  const active = Option.isSome(activeRow) ? activeRow.value : null;
  const n = rows.length;
  const rowH = Math.floor(PH / n);
  const barH = Math.round(rowH * 0.55);

  // Total per row (for percentages)
  const totals = rows.map((r) => r.counts.reduce((s, c) => s + c, 0));

  // Find maximum half-width (determines scale domain)
  let maxHalf = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const total = totals[ri] ?? 1;
    if (!row) continue;
    let negSum = 0;
    let posSum = 0;
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      const count = row.counts[ci] ?? 0;
      const pct = count / total;
      if (!cat) continue;
      if (cat.weight < 0) negSum += pct;
      else posSum += pct;
    }
    if (negSum > maxHalf) maxHalf = negSum;
    if (posSum > maxHalf) maxHalf = posSum;
  }
  const domain = maxHalf * 1.1;
  const xScale = linear({ domain: [-domain, domain], range: [0, PW] });
  const zeroX = r3(xScale(0));

  // X-axis ticks
  const tickValues = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].filter((t) => Math.abs(t) <= domain);

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // X gridlines + labels
        yGridlines(h, [], () => 0, PW), // empty — we'll do custom x-ticks below
        h.g(
          [],
          tickValues.map((t) => {
            const x = r3(xScale(t));
            return h.g(
              [h.Transform(`translate(${x},0)`)],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1('0'),
                    h.X2('0'),
                    h.Y2(String(PH)),
                    h.Stroke(t === 0 ? 'var(--chart-axis, #555)' : 'var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth(t === 0 ? '1.5' : '1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X('0'),
                    h.Y(String(PH + 14)),
                    h.Style({
                      'text-anchor': 'middle',
                      'font-size': '0.65rem',
                      fill: 'var(--chart-label, #888)',
                    }),
                  ],
                  [`${Math.round(Math.abs(t) * 100)}%`],
                ),
              ],
            );
          }),
        ),

        // Category legend (top)
        h.g(
          [h.Transform(`translate(0,-18)`)],
          categories.map((cat, ci) => {
            const x = zeroX + (ci - categories.length / 2) * 72;
            return h.g(
              [h.Transform(`translate(${r3(x)},0)`)],
              [
                h.rect([h.X('0'), h.Y('-5'), h.Width('10'), h.Height('8'), h.Fill(cat.color)], []),
                h.text(
                  [
                    h.X('14'),
                    h.Y('0'),
                    h.Style({
                      'dominant-baseline': 'middle',
                      'font-size': '0.6rem',
                      fill: 'var(--chart-label, #888)',
                    }),
                  ],
                  [cat.label],
                ),
              ],
            );
          }),
        ),

        // Rows
        ...rows.map((row, ri) => {
          const total = totals[ri] ?? 1;
          const isActive = active === row.label;
          const isDimmed = active !== null && !isActive;
          const y = ri * rowH + (rowH - barH) / 2;

          // Split into negative (left) and positive (right) segments
          const negCats = categories
            .map((c, i) => ({ cat: c, pct: (row.counts[i] ?? 0) / total }))
            .filter((x) => x.cat.weight < 0)
            .reverse(); // stack from centre outward
          const posCats = categories
            .map((c, i) => ({ cat: c, pct: (row.counts[i] ?? 0) / total }))
            .filter((x) => x.cat.weight >= 0);

          const negWidths = negCats.map((x) => x.pct);
          const posWidths = posCats.map((x) => x.pct);
          const negOffsets = cumsum([0, ...negWidths]).slice(0, negWidths.length);
          const posOffsets = cumsum([0, ...posWidths]).slice(0, posWidths.length);
          const negTotal = negCats.reduce((s, x) => s + x.pct, 0);
          const posTotal = posCats.reduce((s, x) => s + x.pct, 0);
          const net = posTotal - negTotal;

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredRow({ label: row.label }))),
              h.OnMouseLeave(toParentMessage(BlurredRow())),
              h.Style({
                cursor: 'default',
                opacity: isDimmed ? '0.35' : '1',
                transition: 'opacity 150ms',
              }),
              h.AriaLabel(`${row.label}`),
            ],
            [
              // Row label
              h.text(
                [
                  h.X('-8'),
                  h.Y(String(r3(y + barH / 2))),
                  h.Style({
                    'text-anchor': 'end',
                    'dominant-baseline': 'middle',
                    'font-size': '0.68rem',
                    'font-weight': isActive ? '600' : '400',
                    fill: 'var(--chart-label, #888)',
                  }),
                ],
                [row.label],
              ),

              // Negative segments (left of centre)
              ...negCats.map(({ cat, pct }, si) => {
                const offset = negOffsets[si] ?? 0;
                const bx = r3(xScale(-(offset + pct)));
                const bw = r3(xScale(pct) - xScale(0));
                return h.rect(
                  [
                    h.X(String(bx)),
                    h.Y(String(r3(y))),
                    h.Width(String(Math.max(0, bw))),
                    h.Height(String(barH)),
                    h.Fill(cat.color),
                    h.Style({ transition: 'opacity 120ms' }),
                  ],
                  [],
                );
              }),

              // Positive segments (right of centre)
              ...posCats.map(({ cat, pct }, si) => {
                const offset = posOffsets[si] ?? 0;
                const bx = r3(xScale(offset));
                const bw = r3(xScale(pct) - xScale(0));
                return h.rect(
                  [
                    h.X(String(bx)),
                    h.Y(String(r3(y))),
                    h.Width(String(Math.max(0, bw))),
                    h.Height(String(barH)),
                    h.Fill(cat.color),
                    h.Style({ transition: 'opacity 120ms' }),
                  ],
                  [],
                );
              }),

              // Net score label (right margin)
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String(PW + MR - 4)),
                        h.Y(String(r3(y + barH / 2))),
                        h.Style({
                          'text-anchor': 'end',
                          'dominant-baseline': 'middle',
                          'font-size': '0.65rem',
                          'font-weight': '600',
                          fill: net >= 0 ? '#22c55e' : '#ef4444',
                        }),
                      ],
                      [`${net >= 0 ? '+' : ''}${Math.round(net * 100)}%`],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ],
    ),
  ]);
}
