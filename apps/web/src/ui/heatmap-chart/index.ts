import { colorScale, interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import { svgRoot } from '../shared';

// MODEL

export type CellDatum = Readonly<{ row: number; col: number; value: number }>;

export type InitConfig = Readonly<{
  data: ReadonlyArray<CellDatum>;
  rowLabels: ReadonlyArray<string>;
  colLabels: ReadonlyArray<string>;
  colors: ReadonlyArray<string>;
  domain?: readonly [number, number];
}>;

// VIEW CONSTANTS

const W = 480;
const H = 265;
const ML = 52;
const MR = 16;
const MT = 8;
const MB = 52;
const PW = W - ML - MR;
const PH = H - MT - MB;
const COLOR_BAR_H = 8;
const COLOR_BAR_STOPS = 40;
const CELL_RX = 3;

type ComputedCell = Readonly<{
  key: string;
  row: number;
  col: number;
  value: number;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}>;

type ComputedColorStop = Readonly<{ x: number; color: string; w: number }>;

type Layout = Readonly<{
  cells: ReadonlyArray<ComputedCell>;
  rowLabels: ReadonlyArray<Readonly<{ y: number; label: string }>>;
  colLabels: ReadonlyArray<Readonly<{ x: number; label: string }>>;
  colorStops: ReadonlyArray<ComputedColorStop>;
  minLabel: string;
  maxLabel: string;
  colorBarY: number;
  colorBarX: number;
  colorBarW: number;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeKey: Option.Option<string>;
}>;

const r1 = (n: number) => Math.round(n * 10) / 10;

function buildLayout(cfg: InitConfig): Layout {
  const { data, rowLabels, colLabels, colors } = cfg;
  const nRows = rowLabels.length;
  const nCols = colLabels.length;

  const values = data.map((d) => d.value);
  const minVal = cfg.domain?.[0] ?? Math.min(...values);
  const maxVal = cfg.domain?.[1] ?? Math.max(...values);

  const interpolator = interpolateRgbBasis(colors);
  const getColor = colorScale({ domain: [minVal, maxVal], interpolator, clamp: true });

  const cellW = r1(PW / nCols);
  const cellH = r1(PH / nRows);

  const cells: ComputedCell[] = data.map((d) => {
    const x = r1(d.col * cellW);
    const y = r1(d.row * cellH);
    return {
      key: `${d.row}-${d.col}`,
      row: d.row,
      col: d.col,
      value: d.value,
      color: getColor(d.value),
      x,
      y,
      w: cellW,
      h: cellH,
      cx: r1(x + cellW / 2),
      cy: r1(y + cellH / 2),
    };
  });

  const computedRowLabels = rowLabels.map((label, i) => ({
    y: r1(i * cellH + cellH / 2),
    label,
  }));

  const computedColLabels = colLabels.map((label, i) => ({
    x: r1(i * cellW + cellW / 2),
    label,
  }));

  // Colour bar positioned below the grid, inside margin
  const colorBarY = PH + 28;
  const colorBarX = 0;
  const colorBarW = PW;
  const stopW = r1(colorBarW / COLOR_BAR_STOPS);

  const colorStops: ComputedColorStop[] = Array.from({ length: COLOR_BAR_STOPS }, (_, i) => ({
    x: r1(i * stopW),
    color: interpolator(i / (COLOR_BAR_STOPS - 1)),
    w: stopW + 0.5,
  }));

  return {
    cells,
    rowLabels: computedRowLabels,
    colLabels: computedColLabels,
    colorStops,
    minLabel: String(minVal),
    maxLabel: String(maxVal),
    colorBarY,
    colorBarX,
    colorBarW,
  };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg), activeKey: Option.none() }, []];
}

// MESSAGE

export const HoveredCell = m('HoveredCell', { key: Schema.String });
export const BlurredCell = m('BlurredCell', {});

export const UpdatedCells = m('UpdatedCells', { cells: Schema.Unknown });
export const Message = Schema.Union([HoveredCell, BlurredCell, UpdatedCells]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCell: ({ key }) => [{ ...model, activeKey: Option.some(key) }, []],
      BlurredCell: () => [{ ...model, activeKey: Option.none() }, []],
      UpdatedCells: ({ cells }) => [{ ...model, cells: cells as ReadonlyArray<ComputedCell> }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Heatmap chart' } = config;
  const { layout, activeKey } = model;
  const {
    cells,
    rowLabels,
    colLabels,
    colorStops,
    minLabel,
    maxLabel,
    colorBarY,
    colorBarX,
    colorBarW,
  } = layout;

  const isAnyActive = Option.isSome(activeKey);
  const activeValue = isAnyActive ? activeKey.value : null;

  const activeCell = activeValue ? cells.find((c) => c.key === activeValue) : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Row labels
        ...rowLabels.map((rl) =>
          h.text(
            [
              h.X('-8'),
              h.Y(String(rl.y)),
              h.Style({
                'text-anchor': 'end',
                'dominant-baseline': 'middle',
                'font-size': '0.58rem',
                fill: '#64748b',
                'pointer-events': 'none',
              }),
            ],
            [rl.label],
          ),
        ),

        // Column labels
        ...colLabels.map((cl) =>
          h.text(
            [
              h.X(String(cl.x)),
              h.Y(String(PH + 14)),
              h.Style({
                'text-anchor': 'middle',
                'font-size': '0.58rem',
                fill: '#64748b',
                'pointer-events': 'none',
              }),
            ],
            [cl.label],
          ),
        ),

        // Cells
        ...cells.map((cell) => {
          const isActive = isAnyActive && cell.key === activeValue;
          const opacity = !isAnyActive ? '1' : isActive ? '1' : '0.55';
          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredCell({ key: cell.key }))),
              h.OnMouseLeave(toParentMessage(BlurredCell())),
              h.Style({ cursor: 'pointer' }),
              h.AriaLabel(`${cell.value}`),
            ],
            [
              h.rect(
                [
                  h.X(String(cell.x)),
                  h.Y(String(cell.y)),
                  h.Width(String(cell.w - 2)),
                  h.Height(String(cell.h - 2)),
                  h.Attribute('rx', String(CELL_RX)),
                  h.Fill(cell.color),
                  h.Style({ opacity, transition: 'opacity 120ms' }),
                ],
                [],
              ),
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String(cell.cx)),
                        h.Y(String(cell.cy)),
                        h.Style({
                          'text-anchor': 'middle',
                          'dominant-baseline': 'middle',
                          'font-size': '0.6rem',
                          'font-weight': '700',
                          fill: '#fff',
                          'pointer-events': 'none',
                          'user-select': 'none',
                        }),
                      ],
                      [String(cell.value)],
                    ),
                  ]
                : []),
            ],
          );
        }),

        // Colour bar
        ...colorStops.map((stop) =>
          h.rect(
            [
              h.X(String(colorBarX + stop.x)),
              h.Y(String(colorBarY)),
              h.Width(String(stop.w)),
              h.Height(String(COLOR_BAR_H)),
              h.Fill(stop.color),
            ],
            [],
          ),
        ),

        // Colour bar outline
        h.rect(
          [
            h.X(String(colorBarX)),
            h.Y(String(colorBarY)),
            h.Width(String(colorBarW)),
            h.Height(String(COLOR_BAR_H)),
            h.Fill('none'),
            h.Stroke('var(--card-border, #1e1e33)'),
            h.StrokeWidth('0.5'),
          ],
          [],
        ),

        // Min label
        h.text(
          [
            h.X(String(colorBarX)),
            h.Y(String(colorBarY + COLOR_BAR_H + 10)),
            h.Style({
              'text-anchor': 'start',
              'font-size': '0.58rem',
              fill: '#94a3b8',
              'pointer-events': 'none',
            }),
          ],
          [minLabel],
        ),

        // Max label
        h.text(
          [
            h.X(String(colorBarX + colorBarW)),
            h.Y(String(colorBarY + COLOR_BAR_H + 10)),
            h.Style({
              'text-anchor': 'end',
              'font-size': '0.58rem',
              fill: '#94a3b8',
              'pointer-events': 'none',
            }),
          ],
          [maxLabel],
        ),

        // Active tooltip
        ...(activeCell
          ? [
              h.text(
                [
                  h.X(String(colorBarW / 2)),
                  h.Y(String(colorBarY + COLOR_BAR_H + 10)),
                  h.Style({
                    'text-anchor': 'middle',
                    'font-size': '0.6rem',
                    'font-weight': '600',
                    fill: '#1e293b',
                    'pointer-events': 'none',
                  }),
                ],
                [String(activeCell.value)],
              ),
            ]
          : []),
      ],
    ),
  ]);
};
