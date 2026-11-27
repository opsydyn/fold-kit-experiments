import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import type { AxisTick, CartesianLayout } from '../chart/cartesian.js';
import type { ChartTheme } from '../chart/theme.js';

type FrameOptions<M> = Readonly<{
  layout: CartesianLayout;
  title: string;
  description: string;
  theme: ChartTheme;
  onKeyDown?: (key: string) => M | undefined;
}>;

const isKeyEvent = Schema.is(Schema.Struct({ key: Schema.String }));

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
      : svg
          .attr('tabindex', '0')
          .on('keydown', (payload) => (isKeyEvent(payload) ? onKeyDown(payload.key) : undefined), {
            preventDefault: true,
          });
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
