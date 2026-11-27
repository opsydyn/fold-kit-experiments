import type { Component, Mount, View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import type {
  AxisTick,
  CartesianLayout,
  HistogramBin,
  ProjectedDatum,
} from '../chart/cartesian.js';
import type { Cell } from '../chart/cells.js';
import { finiteCoordinate } from '../chart/layout.js';
import type { ChartTheme, SeriesStyle } from '../chart/theme.js';
import { hexagonPath, type HexBin } from '../math/bin2d.js';
import { symbolPath } from '../shape/symbol.js';
import { chartKey } from './keyboard-event.js';

export type ChartFrameOptions<M> = Readonly<{
  layout: CartesianLayout;
  title: string;
  description: string;
  theme: ChartTheme;
  interactive?: boolean;
  onMount?: Mount.Issued<M | Component.Noop, never, unknown, never>;
  onKeyDown?: (key: string) => M | undefined;
}>;

const isChartKeyEvent = Schema.is(
  Schema.Struct({
    key: Schema.String,
    ctrl: Schema.Boolean,
    alt: Schema.Boolean,
    meta: Schema.Boolean,
    composing: Schema.Boolean,
    editable: Schema.Boolean,
  }),
);

/** Draw the SVG shell around caller-owned Cartesian layers and interaction. */
export function chartFrame<M>(
  h: Html.H<M>,
  {
    layout: { frame },
    title,
    description,
    theme,
    interactive,
    onMount,
    onKeyDown,
  }: ChartFrameOptions<M>,
  children: ReadonlyArray<View.Input<M>>,
) {
  const svg = h.el('svg').attrs({
    class: 'chart-frame',
    viewBox: `0 0 ${frame.width} ${frame.height}`,
    width: '100%',
    height: String(frame.height),
    role: 'img',
    tabindex: interactive || onKeyDown !== undefined ? '0' : undefined,
    'aria-label': `${title}. ${description}`,
    style: `display:block;background:${theme.background};color:${theme.text};font-family:${theme.fontFamily}`,
  });
  const focusable =
    onKeyDown === undefined
      ? svg
      : svg.on(
          'keydown',
          (payload) => {
            if (!isChartKeyEvent(payload)) return undefined;
            const key = chartKey(payload);
            return key === undefined ? undefined : onKeyDown(key);
          },
          { preventDefault: true },
        );
  const root = onMount === undefined ? focusable : focusable.onMount(onMount);
  return root.children(
    h.el('title').children(title),
    h.el('desc').children(description),
    ...children,
  );
}

const line = <M>(h: Html.H<M>, x1: number, y1: number, x2: number, y2: number, stroke?: string) =>
  h
    .el('line')
    .attrs({ x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke })
    .children();

const text = <M>(
  h: Html.H<M>,
  x: number,
  y: number,
  anchor: string,
  value: string,
  fill?: string,
) =>
  h
    .el('text')
    .attrs({ x: String(x), y: String(y), 'text-anchor': anchor, fill })
    .children(value);

export type GridOptions = Readonly<{
  layout: CartesianLayout;
  xTicks: ReadonlyArray<AxisTick>;
  yTicks: ReadonlyArray<AxisTick>;
  theme: ChartTheme;
}>;

export function grid<M>(h: Html.H<M>, { layout: { plot }, xTicks, yTicks, theme }: GridOptions) {
  return h
    .el('g')
    .attrs({
      class: 'chart-grid',
      stroke: theme.grid,
      'stroke-width': '1',
      'aria-hidden': 'true',
    })
    .children(
      ...xTicks.map(({ position }) => line(h, position, plot.top, position, plot.bottom)),
      ...yTicks.map(({ position }) => line(h, plot.left, position, plot.right, position)),
    );
}

export type AxisOptions = Readonly<{
  layout: CartesianLayout;
  orientation: 'bottom' | 'left';
  ticks: ReadonlyArray<AxisTick>;
  label: string;
  format?: (value: number) => string;
  theme: ChartTheme;
}>;

export function axis<M>(
  h: Html.H<M>,
  { layout: { plot, frame }, orientation, ticks, label, format, theme }: AxisOptions,
) {
  const bottom = orientation === 'bottom';
  return h
    .el('g')
    .attrs({
      class: `chart-axis chart-axis-${orientation}`,
      fill: theme.mutedText,
      'font-size': String(theme.labelSize),
    })
    .children(
      line(
        h,
        plot.left,
        bottom ? plot.bottom : plot.top,
        bottom ? plot.right : plot.left,
        plot.bottom,
        theme.axis,
      ),
      ...ticks.map((tick) =>
        text(
          h,
          bottom ? tick.position : plot.left - 8,
          bottom ? plot.bottom + theme.labelSize + 8 : tick.position + 4,
          bottom ? 'middle' : 'end',
          format?.(tick.value) ?? tick.label ?? String(tick.value),
        ),
      ),
      text(
        h,
        bottom ? (plot.left + plot.right) / 2 : plot.left,
        bottom ? frame.height - 8 : Math.max(theme.labelSize, plot.top - 10),
        bottom ? 'middle' : 'start',
        label,
        theme.text,
      ),
    );
}

export type DataTableOptions = Readonly<{
  caption: string;
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

export function dataTable<M>(h: Html.H<M>, { caption, headers, rows }: DataTableOptions) {
  return h.table
    .class('chart-data-table')
    .children(
      h.caption(caption),
      h.thead(h.tr(...headers.map((header) => h.th.attr('scope', 'col').children(header)))),
      h.tbody(...rows.map((row) => h.tr(...row.map((value) => h.td(value))))),
    );
}

export type LineSeriesOptions = Readonly<{ path: string; style: SeriesStyle }>;

/** Draws a projected line using the resolved series style. */
export function lineSeries<M>(h: Html.H<M>, { path, style }: LineSeriesOptions) {
  return h.el('path').attrs({
    class: 'chart-line-series',
    d: path,
    fill: 'none',
    stroke: style.stroke,
    'stroke-width': String(style.strokeWidth),
    'stroke-dasharray': style.dashPattern,
    opacity: String(style.opacity),
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  });
}

export type PointSeriesOptions<T, M> = Readonly<{
  points: ReadonlyArray<ProjectedDatum<T>>;
  styleFor: (point: ProjectedDatum<T>) => SeriesStyle;
  labelFor: (datum: T) => string;
  activeKey: string | null;
  onInspect?: (key: string) => M;
}>;

/** Draws keyed symbols without creating a tab stop for every datum. */
export function pointSeries<T, M>(
  h: Html.H<M>,
  { points, styleFor, labelFor, activeKey, onInspect }: PointSeriesOptions<T, M>,
) {
  return h
    .el('g')
    .attr('class', 'chart-point-series')
    .children(
      points.map((point) => {
        const style = styleFor(point);
        const active = point.key === activeKey;
        const radius = style.pointRadius + (active ? 2 : 0);
        const path = h
          .el('path')
          .key(point.key)
          .attrs({
            'data-symbol': style.symbol,
            transform: `translate(${point.x},${point.y})`,
            d: symbolPath(style.symbol, Math.PI * radius * radius),
            fill: style.fill,
            stroke: active ? 'currentColor' : style.stroke,
            'stroke-width': String(style.strokeWidth),
            opacity: String(style.opacity),
            'aria-label': labelFor(point.datum),
          });
        if (onInspect === undefined) return path;
        return path
          .attr('style', 'cursor:pointer')
          .on('mouseenter', () => onInspect(point.key))
          .on('click', () => onInspect(point.key));
      }),
    );
}

export type HexSeriesOptions<T> = Readonly<{
  bins: ReadonlyArray<HexBin<T>>;
  radius: number;
  fillFor: (bin: HexBin<T>) => string;
  labelFor: (bin: HexBin<T>) => string;
}>;

/** Draws hexagonal bins at their projected centres with native SVG tooltips. */
export function hexSeries<T, M>(
  h: Html.H<M>,
  { bins, radius, fillFor, labelFor }: HexSeriesOptions<T>,
) {
  const d = hexagonPath(radius);
  return h
    .el('g')
    .attr('class', 'chart-hex-series')
    .children(
      bins.map((bin) => {
        const label = labelFor(bin);
        return h
          .el('path')
          .key(`${bin.x},${bin.y}`)
          .attrs({
            transform: `translate(${bin.x},${bin.y})`,
            d,
            fill: fillFor(bin),
            'aria-label': label,
          })
          .children(h.el('title').children(label));
      }),
    );
}

export type BarSeriesOptions<T> = Readonly<{
  bins: ReadonlyArray<HistogramBin<T>>;
  styleFor: (bin: HistogramBin<T>) => SeriesStyle;
  labelFor: (bin: HistogramBin<T>) => string;
}>;

/** Renders histogram bins with their source interval and count available to the host. */
export function barSeries<T, M>(h: Html.H<M>, { bins, styleFor, labelFor }: BarSeriesOptions<T>) {
  return h
    .el('g')
    .attr('class', 'chart-bar-series')
    .children(
      bins.map((bin) => {
        const style = styleFor(bin);
        return h
          .el('rect')
          .key(bin.key)
          .attrs({
            x: String(bin.x),
            y: String(bin.y),
            width: String(bin.width),
            height: String(bin.height),
            fill: style.fill,
            stroke: style.stroke,
            'stroke-width': String(style.strokeWidth),
            opacity: String(style.opacity),
            'aria-label': labelFor(bin),
          });
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

/** Renders titled heatmap cells and reports the keys of inspected cells. */
export function cellSeries<T, M>(
  h: Html.H<M>,
  { cells, fillFor, labelFor, activeKey, onInspect }: CellSeriesOptions<T, M>,
) {
  return h
    .el('g')
    .attr('class', 'chart-cell-series')
    .children(
      cells.map((cell) => {
        const label = labelFor(cell.datum);
        const active = cell.key === activeKey;
        const rect = h
          .el('rect')
          .key(cell.key)
          .attrs({
            x: String(cell.x),
            y: String(cell.y),
            width: String(cell.width),
            height: String(cell.height),
            fill: fillFor(cell),
            stroke: active ? 'currentColor' : undefined,
            'stroke-width': active ? '2' : undefined,
            'aria-label': label,
          })
          .children(h.el('title').children(label));
        if (onInspect === undefined) return rect;
        return rect
          .on('mouseenter', () => onInspect(cell.key))
          .on('click', () => onInspect(cell.key));
      }),
    );
}

export type AnnotationOptions = Readonly<{
  layout: CartesianLayout;
  axis: 'x' | 'y';
  value: number;
  label: string;
  style: SeriesStyle;
}>;

/** Draws a labelled rule on the same scale as the marks. */
export function annotation<M>(
  h: Html.H<M>,
  { layout, axis, value, label, style }: AnnotationOptions,
) {
  const { plot } = layout;
  const horizontal = axis === 'y';
  const position = finiteCoordinate(horizontal ? layout.y(value) : layout.x(value));
  const x = horizontal ? plot.left : position;
  const y = horizontal ? position : plot.top;

  const rule = h.el('line').attrs({
    x1: String(x),
    y1: String(y),
    x2: String(horizontal ? plot.right : position),
    y2: String(horizontal ? position : plot.bottom),
    stroke: style.stroke,
    'stroke-width': String(style.strokeWidth),
    'stroke-dasharray': style.dashPattern,
    opacity: String(style.opacity),
  });
  const caption = h
    .el('text')
    .attrs({ x: String(x + 4), y: String(y - 6), 'font-size': '12' })
    .children(label);
  return h
    .el('g')
    .attrs({ class: 'chart-annotation', 'aria-label': label, fill: style.stroke })
    .children(rule, caption);
}

export type TooltipContext<T> = Readonly<{ datum: T; x: number; y: number; style: SeriesStyle }>;
export type TooltipOptions<T, M> = Readonly<{
  point: ProjectedDatum<T>;
  style: SeriesStyle;
  theme: ChartTheme;
  render?: (context: TooltipContext<T>, h: Html.H<M>) => View.Content<M>;
}>;

/** Draws an inspected point's tooltip from the original datum. */
export function tooltip<T, M>(h: Html.H<M>, { point, style, theme, render }: TooltipOptions<T, M>) {
  const { datum, x, y, key } = point;
  if (render) return render({ datum, x, y, style }, h);

  const width = Math.max(48, key.length * theme.labelSize * 0.65 + 28);
  const top = y - theme.labelSize - 28;
  const height = theme.labelSize + 16;
  const surface = h.el('rect').attrs({
    x: String(x - width / 2),
    y: String(top),
    width: String(width),
    height: String(height),
    rx: '4',
    fill: theme.tooltipBackground,
  });
  const dot = h.el('circle').attrs({
    cx: String(x - width / 2 + 10),
    cy: String(top + height / 2),
    r: '3',
    fill: style.fill,
    opacity: String(style.opacity),
  });
  const label = h
    .el('text')
    .attrs({
      x: String(x + 6),
      y: String(top + theme.labelSize + 3),
      'text-anchor': 'middle',
      fill: theme.tooltipText,
      'font-size': String(theme.labelSize),
    })
    .children(key);
  return h
    .el('g')
    .attrs({ class: 'chart-tooltip', style: 'pointer-events:none' })
    .children(surface, dot, label);
}

export type LegendEntry = Readonly<{ key: string; label: string; style: SeriesStyle }>;
export type LegendOptions = Readonly<{ entries: ReadonlyArray<LegendEntry>; theme: ChartTheme }>;

/** Renders shape and colour swatches with text labels. */
export function legend<M>(h: Html.H<M>, { entries, theme }: LegendOptions) {
  return h.ul
    .class('chart-legend')
    .style({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      padding: '0',
      margin: '12px 0',
      listStyle: 'none',
      color: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: `${theme.labelSize}px`,
    })
    .children(
      entries.map(({ key, label, style }) => {
        const symbol = h.el('path').attrs({
          'data-symbol': style.symbol,
          d: symbolPath(style.symbol, 64),
          fill: style.fill,
          stroke: style.stroke,
          'stroke-width': String(style.strokeWidth),
          opacity: String(style.opacity),
        });
        const swatch = h
          .el('svg')
          .attrs({
            width: '20',
            height: '20',
            viewBox: '-10 -10 20 20',
            'aria-hidden': 'true',
          })
          .children(symbol);
        return h.li
          .key(key)
          .style({ display: 'flex', alignItems: 'center', gap: '6px' })
          .children(swatch, label);
      }),
    );
}
