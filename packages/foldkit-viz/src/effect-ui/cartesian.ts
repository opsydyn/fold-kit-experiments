import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import type { AxisTick, CartesianLayout, ProjectedDatum } from '../chart/cartesian.js';
import type { ChartTheme, SeriesStyle } from '../chart/theme.js';
import { hexagonPath, type HexBin } from '../math/bin2d.js';
import { symbolPath } from '../shape/symbol.js';
import { chartKey } from './keyboard-event.js';

type FrameOptions<M> = Readonly<{
  layout: CartesianLayout;
  title: string;
  description: string;
  theme: ChartTheme;
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
  { layout: { frame }, title, description, theme, onKeyDown }: FrameOptions<M>,
  children: ReadonlyArray<View.Input<M>>,
) {
  const svg = h.el('svg').attrs({
    class: 'chart-frame',
    viewBox: `0 0 ${frame.width} ${frame.height}`,
    width: '100%',
    height: String(frame.height),
    role: 'img',
    'aria-label': `${title}. ${description}`,
    style: `display:block;background:${theme.background};color:${theme.text};font-family:${theme.fontFamily}`,
  });
  const focusable =
    onKeyDown === undefined
      ? svg
      : svg.attr('tabindex', '0').on(
          'keydown',
          (payload) => {
            if (!isChartKeyEvent(payload)) return undefined;
            const key = chartKey(payload);
            return key === undefined ? undefined : onKeyDown(key);
          },
          { preventDefault: true },
        );
  return focusable.children(
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

type GridOptions = Readonly<{
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

type AxisOptions = Readonly<{
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

type TableOptions = Readonly<{
  caption: string;
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

export function dataTable<M>(h: Html.H<M>, { caption, headers, rows }: TableOptions) {
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
