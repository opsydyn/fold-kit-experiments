import type { Html } from '@effect/ui/html';
import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';

import { datasets } from './data';
import type { Snapshot } from './data';
import { frameForWidth, tickCountForFrame } from './frame';

export const chartTheme: ChartTheme = {
  ...darkTheme,
  background: 'var(--card-bg, var(--surface))',
  text: 'var(--page-text, var(--text))',
  mutedText: 'var(--chart-label, var(--muted))',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
};
export const hourLabel = (hour: number): string =>
  String(Math.round(hour)).padStart(2, '0') + ':00';

export const snapshotChart = <M>(
  snapshot: Snapshot,
  h: Html.H<M>,
  options: Readonly<{
    frame?: ChartFrame;
    theme?: ChartTheme;
    colour?: string;
  }> = {},
) => {
  const theme = options.theme ?? chartTheme;
  const frame = options.frame ?? frameForWidth(920);
  const geometry = lineGeometry(
    snapshot.points,
    {
      x: (point) => point.hour,
      y: (point) => point.value,
      datumKey: (point) => String(point.hour),
      seriesKey: () => snapshot.dataset,
    },
    { frame, curve: 'linear', xTickCount: tickCountForFrame(frame) },
  );
  const colour = options.colour ?? datasets[snapshot.dataset].colour;
  const style = resolveSeriesStyle(
    theme,
    { stroke: colour, fill: colour, strokeWidth: 3, pointRadius: 4 },
    {},
    {},
  );
  const { layout, xTicks, yTicks } = geometry;
  const description = `${datasets[snapshot.dataset].label}. Snapshot ${snapshot.revision}. Illustrative wind speed in metres per second.`;
  return chartFrame(h, { layout, title: 'Wind observations', description, theme }, [
    grid(h, { layout, xTicks, yTicks, theme }),
    axis(h, {
      layout,
      orientation: 'bottom',
      ticks: xTicks,
      label: 'Hour',
      format: hourLabel,
      theme,
    }),
    axis(h, {
      layout,
      orientation: 'left',
      ticks: yTicks,
      label: 'Wind speed (m/s)',
      format: String,
      theme,
    }),
    ...geometry.series.map(({ path }) =>
      h
        .el('path')
        .attrs({
          class: 'chart-line-series',
          d: path,
          fill: 'none',
          stroke: style.stroke,
          'stroke-width': String(style.strokeWidth),
          'stroke-dasharray': style.dashPattern,
          opacity: String(style.opacity),
          style: 'stroke-linejoin:round;stroke-linecap:round',
        })
        .children(),
    ),
    h
      .el('g')
      .attr('class', 'chart-point-series')
      .children(
        ...geometry.points.map(({ key, x, y, datum }) =>
          h
            .el('path')
            .key(key)
            .attrs({
              'data-symbol': style.symbol,
              transform: `translate(${x},${y})`,
              d: symbolPath(style.symbol, Math.PI * style.pointRadius ** 2),
              fill: style.fill,
              stroke: style.stroke,
              'stroke-width': String(style.strokeWidth),
              opacity: String(style.opacity),
              'aria-label': `${hourLabel(datum.hour)}: ${datum.value} m/s`,
            })
            .children(),
        ),
      ),
  ]);
};
