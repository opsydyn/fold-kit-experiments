import type { Html, HtmlBuilder } from 'foldkit/html';

import type { HistogramBin, ProjectedDatum } from '../chart/cartesian.js';
import type { Cell } from '../chart/cells.js';
import type { SeriesStyle } from '../chart/theme.js';
import { hexagonPath } from '../math/bin2d.js';
import type { HexBin } from '../math/bin2d.js';
import { symbolPath } from '../shape/symbol.js';

export type LineSeriesOptions = Readonly<{ path: string; style: SeriesStyle }>;
export function lineSeries<M>(h: HtmlBuilder<M>, options: LineSeriesOptions): Html {
  const { style } = options;
  return h.path(
    [
      h.Class('chart-line-series'),
      h.D(options.path),
      h.Fill('none'),
      h.Stroke(style.stroke),
      h.StrokeWidth(String(style.strokeWidth)),
      h.StrokeDasharray(style.dashPattern),
      h.Opacity(String(style.opacity)),
      h.Style({ 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ],
    [],
  );
}
export type PointSeriesOptions<T, M> = Readonly<{
  points: ReadonlyArray<ProjectedDatum<T>>;
  styleFor: (point: ProjectedDatum<T>) => SeriesStyle;
  labelFor: (datum: T) => string;
  activeKey: string | null;
  onInspect?: (key: string) => M;
}>;
export function pointSeries<T, M>(h: HtmlBuilder<M>, options: PointSeriesOptions<T, M>): Html {
  return h.g(
    [h.Class('chart-point-series')],
    options.points.map((point) => {
      const style = options.styleFor(point);
      const active = point.key === options.activeKey;
      const radius = style.pointRadius + (active ? 2 : 0);
      return h.path(
        [
          h.Key(point.key),
          h.DataAttribute('symbol', style.symbol),
          h.Transform(`translate(${point.x},${point.y})`),
          h.D(symbolPath(style.symbol, Math.PI * radius * radius)),
          h.Fill(style.fill),
          h.Stroke(active ? 'currentColor' : style.stroke),
          h.StrokeWidth(String(style.strokeWidth)),
          h.Opacity(String(style.opacity)),
          h.AriaLabel(options.labelFor(point.datum)),
          ...(options.onInspect
            ? [
                h.OnMouseEnter(options.onInspect(point.key)),
                h.OnClick(options.onInspect(point.key)),
                h.Style({ cursor: 'pointer' }),
              ]
            : []),
        ],
        [],
      );
    }),
  );
}
export type BarSeriesOptions<T> = Readonly<{
  bins: ReadonlyArray<HistogramBin<T>>;
  styleFor: (bin: HistogramBin<T>) => SeriesStyle;
  labelFor: (bin: HistogramBin<T>) => string;
}>;
export function barSeries<T, M>(h: HtmlBuilder<M>, options: BarSeriesOptions<T>): Html {
  return h.g(
    [h.Class('chart-bar-series')],
    options.bins.map((bin) => {
      const style = options.styleFor(bin);
      return h.rect(
        [
          h.Key(bin.key),
          h.X(String(bin.x)),
          h.Y(String(bin.y)),
          h.Width(String(bin.width)),
          h.Height(String(bin.height)),
          h.Fill(style.fill),
          h.Stroke(style.stroke),
          h.StrokeWidth(String(style.strokeWidth)),
          h.Opacity(String(style.opacity)),
          h.AriaLabel(options.labelFor(bin)),
        ],
        [],
      );
    }),
  );
}
export type CellSeriesOptions<T, M> = Readonly<{
  cells: ReadonlyArray<Cell<T>>;
  fillFor: (cell: Cell<T>) => string;
  labelFor: (datum: T) => string;
  activeKey?: string | null;
  onInspect?: (key: string) => M;
}>;
/** Heatmap cells from `cellGeometry`, each naming itself in a native tooltip. */
export function cellSeries<T, M>(h: HtmlBuilder<M>, options: CellSeriesOptions<T, M>): Html {
  return h.g(
    [h.Class('chart-cell-series')],
    options.cells.map((cell) => {
      const label = options.labelFor(cell.datum);
      return h.rect(
        [
          h.Key(cell.key),
          h.X(String(cell.x)),
          h.Y(String(cell.y)),
          h.Width(String(cell.width)),
          h.Height(String(cell.height)),
          h.Fill(options.fillFor(cell)),
          ...(cell.key === options.activeKey ? [h.Stroke('currentColor'), h.StrokeWidth('2')] : []),
          h.AriaLabel(label),
          ...(options.onInspect
            ? [h.OnMouseEnter(options.onInspect(cell.key)), h.OnClick(options.onInspect(cell.key))]
            : []),
        ],
        [h.title([], [label])],
      );
    }),
  );
}
export type HexSeriesOptions<T> = Readonly<{
  bins: ReadonlyArray<HexBin<T>>;
  radius: number;
  fillFor: (bin: HexBin<T>) => string;
  labelFor: (bin: HexBin<T>) => string;
}>;
/** Hexagons from `hexbin`, drawn at each bin's centre in plot coordinates. */
export function hexSeries<T, M>(h: HtmlBuilder<M>, options: HexSeriesOptions<T>): Html {
  const d = hexagonPath(options.radius);
  return h.g(
    [h.Class('chart-hex-series')],
    options.bins.map((bin) => {
      const label = options.labelFor(bin);
      return h.path(
        [
          h.Key(`${bin.x},${bin.y}`),
          h.Transform(`translate(${bin.x},${bin.y})`),
          h.D(d),
          h.Fill(options.fillFor(bin)),
          h.AriaLabel(label),
        ],
        [h.title([], [label])],
      );
    }),
  );
}
