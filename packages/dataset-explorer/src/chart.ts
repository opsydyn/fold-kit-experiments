import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme } from '@opsydyn/foldkit-viz/chart/theme';
import {
  axis,
  chartFrame,
  grid,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import type { HtmlBuilder } from 'foldkit/html';

import { datasets } from './data';
import type { Snapshot } from './data';

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
  h: HtmlBuilder<M>,
  options: Readonly<{
    frame?: ChartFrame;
    theme?: ChartTheme;
    colour?: string;
  }> = {},
) => {
  const theme = options.theme ?? chartTheme;
  const frame = options.frame ?? {
    width: 920,
    height: 330,
    margins: { top: 24, right: 28, bottom: 58, left: 58 },
  };
  const geometry = lineGeometry(
    snapshot.points,
    {
      x: (point) => point.hour,
      y: (point) => point.value,
      datumKey: (point) => String(point.hour),
      seriesKey: () => snapshot.dataset,
    },
    { frame, curve: 'linear' },
  );
  const colour = options.colour ?? datasets[snapshot.dataset].colour;
  const style = resolveSeriesStyle(
    theme,
    { stroke: colour, fill: colour, strokeWidth: 3, pointRadius: 4 },
    {},
    {},
  );
  return chartFrame(
    h,
    {
      layout: geometry.layout,
      title: 'Wind observations',
      description: `${datasets[snapshot.dataset].label}. Snapshot ${snapshot.revision}. Illustrative wind speed in metres per second.`,
      theme,
    },
    [
      grid(h, { layout: geometry.layout, xTicks: geometry.xTicks, yTicks: geometry.yTicks, theme }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'bottom',
        ticks: geometry.xTicks,
        label: 'Hour',
        format: hourLabel,
        theme,
      }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'left',
        ticks: geometry.yTicks,
        label: 'Wind speed (m/s)',
        format: String,
        theme,
      }),
      ...geometry.series.map((series) => lineSeries(h, { path: series.path, style })),
      pointSeries(h, {
        points: geometry.points,
        styleFor: () => style,
        activeKey: null,
        labelFor: (point) => `${hourLabel(point.hour)}: ${point.value} m/s`,
      }),
    ],
  );
};
