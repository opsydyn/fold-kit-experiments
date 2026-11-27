import type { Html } from '@effect/ui/html';
import { axis, chartFrame, grid } from '@opsydyn/foldkit-viz/effect-ui/cartesian';

import { chartTheme, type histogramGeometry, seriesStyle } from './chart';

export const histogramChart = <M>(h: Html.H<M>, geometry: ReturnType<typeof histogramGeometry>) => {
  const { cartesian, total } = geometry;
  const { layout, xTicks, bins } = cartesian;
  const yTicks = cartesian.yTicks.filter(({ value }) => Number.isInteger(value));
  const title = 'Illustrative histogram';
  const description = `${total} observations. Intervals include the lower edge and the final upper edge.`;
  return chartFrame(h, { layout, title, description, theme: chartTheme }, [
    grid(h, { layout, xTicks, yTicks, theme: chartTheme }),
    axis(h, {
      layout,
      orientation: 'left',
      ticks: yTicks,
      label: 'Count',
      format: String,
      theme: chartTheme,
    }),
    axis(h, {
      layout,
      orientation: 'bottom',
      ticks: xTicks,
      label: 'Value (units)',
      format: String,
      theme: chartTheme,
    }),
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
  ]);
};
