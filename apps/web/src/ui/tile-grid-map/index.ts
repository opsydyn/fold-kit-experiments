import { extent } from '@opsydyn/foldkit-viz/math/array';
import { interpolateRgb } from '@opsydyn/foldkit-viz/math/color';
import { scaleSequential } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — tile grid map (cartogram-style choropleth)
// Each "tile" is a labelled rectangle placed at a grid [col, row] position.
// Color encodes a numeric value via scaleSequential + interpolator.

export type TileCell = Readonly<{
  id: string;
  label: string;
  /** Grid column (0-based) */
  col: number;
  /** Grid row (0-based) */
  row: number;
  /** Encoded data value */
  value: number;
}>;

export type InitConfig = Readonly<{
  cells: ReadonlyArray<TileCell>;
  /** Tile size in pixels (default 36) */
  tileSize?: number;
  /** Color for minimum value */
  colorLow?: string;
  /** Color for maximum value */
  colorHigh?: string;
  /** Label for the color legend */
  legendLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  cells: ReadonlyArray<TileCell>;
  tileSize: number;
  colorLow: string;
  colorHigh: string;
  legendLabel: string;
  valueExtent: readonly [number, number];
  activeId: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const tileSize = cfg.tileSize ?? 36;
  const cols = Math.max(...cfg.cells.map((c) => c.col)) + 1;
  const rows = Math.max(...cfg.cells.map((c) => c.row)) + 1;
  const [lo, hi] = extent(cfg.cells, (c) => c.value) as [number, number];

  const layout = makeLayout(
    { width: cols * tileSize + 80, height: rows * tileSize + 48, ...cfg.dims },
    { top: 8, right: 72, bottom: 40, left: 8, ...cfg.margins },
  );

  return [
    {
      cells: cfg.cells,
      tileSize,
      colorLow: cfg.colorLow ?? '#f0f9ff',
      colorHigh: cfg.colorHigh ?? '#0369a1',
      legendLabel: cfg.legendLabel ?? '',
      valueExtent: [lo ?? 0, hi ?? 1],
      activeId: Option.none(),
      layout,
    },
    [],
  ];
}

// MESSAGE

export const HoveredCell = m('HoveredCell', { id: Schema.String });
export const BlurredCell = m('BlurredCell', {});

export const Message = Schema.Union([HoveredCell, BlurredCell]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCell: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredCell: () => [{ ...model, activeId: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Tile grid map' } = config;
  const { cells, tileSize, colorLow, colorHigh, legendLabel, valueExtent, activeId } = model;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;

  const active = Option.isSome(activeId) ? activeId.value : null;
  const colorScale = scaleSequential(valueExtent, interpolateRgb(colorLow, colorHigh));

  // Legend: gradient bar + min/max labels (right margin)
  const legendH = Math.min(PH - 16, 120);
  const legendX = PW + 8;
  const legendSteps = 20;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Grid tiles
        ...cells.map((cell) => {
          const x = r3(cell.col * tileSize);
          const y = r3(cell.row * tileSize);
          const color = colorScale(cell.value);
          const isActive = cell.id === active;
          const isDimmed = active !== null && !isActive;
          const pad = isActive ? 1 : 2;

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredCell({ id: cell.id }))),
              h.OnMouseLeave(toParentMessage(BlurredCell())),
              h.Style({ cursor: 'default' }),
              h.AriaLabel(`${cell.label}: ${cell.value}`),
            ],
            [
              h.rect(
                [
                  h.X(String(x + pad)),
                  h.Y(String(y + pad)),
                  h.Width(String(tileSize - pad * 2)),
                  h.Height(String(tileSize - pad * 2)),
                  h.Fill(color),
                  h.Opacity(isDimmed ? '0.25' : '1'),
                  h.Attribute('rx', '3'),
                  h.Style({ transition: 'opacity 120ms' }),
                ],
                [],
              ),

              h.text(
                [
                  h.X(String(r3(x + tileSize / 2))),
                  h.Y(String(r3(y + tileSize / 2))),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'middle',
                    'font-size': tileSize >= 36 ? '0.65rem' : '0.55rem',
                    'font-weight': isActive ? '700' : '500',
                    fill: isActive ? 'var(--page-text, #e8e8ff)' : 'var(--chart-label, #888)',
                    'pointer-events': 'none',
                  }),
                ],
                [cell.label],
              ),

              // Value tooltip on hover
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String(r3(x + tileSize / 2))),
                        h.Y(String(r3(y - 4))),
                        h.Style({
                          'text-anchor': 'middle',
                          'dominant-baseline': 'auto',
                          'font-size': '0.6rem',
                          'font-weight': '600',
                          fill: color,
                          'pointer-events': 'none',
                        }),
                      ],
                      [String(cell.value)],
                    ),
                  ]
                : []),
            ],
          );
        }),

        // Colour legend (right of grid)
        h.g(
          [h.Transform(`translate(${legendX},0)`), h.Attribute('aria-hidden', 'true')],
          [
            // Gradient steps
            ...Array.from({ length: legendSteps }, (_, i) => {
              const t = i / (legendSteps - 1);
              const v = valueExtent[0] + t * (valueExtent[1] - valueExtent[0]);
              const y = r3((1 - t) * legendH);
              const stepH = r3(legendH / legendSteps) + 1;
              return h.rect(
                [
                  h.X('0'),
                  h.Y(String(y)),
                  h.Width('10'),
                  h.Height(String(stepH)),
                  h.Fill(colorScale(v)),
                ],
                [],
              );
            }),
            // Min label
            h.text(
              [
                h.X('14'),
                h.Y(String(legendH)),
                h.Style({
                  'font-size': '0.6rem',
                  'dominant-baseline': 'middle',
                  fill: 'var(--chart-label, #888)',
                }),
              ],
              [String(valueExtent[0])],
            ),
            // Max label
            h.text(
              [
                h.X('14'),
                h.Y('0'),
                h.Style({
                  'font-size': '0.6rem',
                  'dominant-baseline': 'middle',
                  fill: 'var(--chart-label, #888)',
                }),
              ],
              [String(valueExtent[1])],
            ),
            // Legend axis label (rotated)
            ...(legendLabel
              ? [
                  h.text(
                    [
                      h.Transform(`translate(-4,${r3(legendH / 2)}) rotate(-90)`),
                      h.Style({
                        'text-anchor': 'middle',
                        'font-size': '0.6rem',
                        fill: 'var(--chart-label-muted, #555)',
                      }),
                    ],
                    [legendLabel],
                  ),
                ]
              : []),
          ],
        ),
      ],
    ),
  ]);
}
