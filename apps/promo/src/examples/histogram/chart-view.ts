import type { Html } from '@effect/ui/html';

import { chartTheme, type histogramGeometry, seriesStyle } from './chart';

export const histogramChart = <M>(h: Html.H<M>, geometry: ReturnType<typeof histogramGeometry>) => {
  const { cartesian, total, yTicks } = geometry;
  const {
    layout: { frame, plot },
    xTicks,
    bins,
  } = cartesian;
  const title = 'Illustrative histogram';
  const description = `${total} observations. Intervals include the lower edge and the final upper edge.`;
  const line = (x1: number, y1: number, x2: number, y2: number, stroke?: string) =>
    h
      .el('line')
      .attrs({ x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke })
      .children();
  const text = (x: number, y: number, anchor: string, label: string, fill?: string) =>
    h
      .el('text')
      .attrs({ x: String(x), y: String(y), 'text-anchor': anchor, fill })
      .children(label);
  const axis = { fill: chartTheme.mutedText, 'font-size': String(chartTheme.labelSize) };
  return h
    .el('svg')
    .attrs({
      class: 'chart-frame',
      viewBox: `0 0 ${frame.width} ${frame.height}`,
      width: '100%',
      height: String(frame.height),
      role: 'img',
      'aria-label': `${title}. ${description}`,
      style: `display:block;background:${chartTheme.background};color:${chartTheme.text};font-family:${chartTheme.fontFamily}`,
    })
    .children(
      h.el('title').children(title),
      h.el('desc').children(description),
      h
        .el('g')
        .attrs({
          class: 'chart-grid',
          stroke: chartTheme.grid,
          'stroke-width': '1',
          'aria-hidden': 'true',
        })
        .children(
          ...xTicks.map(({ position }) => line(position, plot.top, position, plot.bottom)),
          ...yTicks.map(({ y }) => line(plot.left, y, plot.right, y)),
        ),
      h
        .el('g')
        .attrs({ ...axis, class: 'chart-axis chart-axis-left' })
        .children(
          line(plot.left, plot.top, plot.left, plot.bottom, chartTheme.axis),
          ...yTicks.map(({ value, y }) => text(plot.left - 8, y + 4, 'end', String(value))),
          text(
            plot.left,
            Math.max(chartTheme.labelSize, plot.top - 10),
            'start',
            'Count',
            chartTheme.text,
          ),
        ),
      h
        .el('g')
        .attrs({ ...axis, class: 'chart-axis chart-axis-bottom' })
        .children(
          line(plot.left, plot.bottom, plot.right, plot.bottom, chartTheme.axis),
          ...xTicks.map(({ value, position }) =>
            text(position, plot.bottom + chartTheme.labelSize + 8, 'middle', String(value)),
          ),
          text(
            (plot.left + plot.right) / 2,
            frame.height - 8,
            'middle',
            'Value (units)',
            chartTheme.text,
          ),
        ),
      h
        .el('g')
        .attr('class', 'chart-bar-series')
        .children(
          ...bins.map(({ key, x, y, width, height, x0, x1, count }) =>
            h
              .el('rect')
              .key(key)
              .attrs({
                x: String(x),
                y: String(y),
                width: String(width),
                height: String(height),
                fill: seriesStyle.fill,
                stroke: seriesStyle.stroke,
                'stroke-width': String(seriesStyle.strokeWidth),
                opacity: String(seriesStyle.opacity),
                'aria-label': `${x0} to ${x1}: ${count} observations`,
              })
              .children(),
          ),
        ),
    );
};
