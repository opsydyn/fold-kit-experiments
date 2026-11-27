import type { Html } from '@effect/ui/html';
import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme } from '@opsydyn/foldkit-viz/chart/theme';
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
  const { plot } = geometry.layout;
  const labelSize = theme.labelSize;
  const description = `${datasets[snapshot.dataset].label}. Snapshot ${snapshot.revision}. Illustrative wind speed in metres per second.`;
  const line = (x1: number, y1: number, x2: number, y2: number, stroke?: string) =>
    h
      .el('line')
      .attrs({ x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke })
      .children();
  const text = (x: number, y: number, anchor: string, text: string, fill?: string) =>
    h
      .el('text')
      .attrs({ x: String(x), y: String(y), 'text-anchor': anchor, fill })
      .children(text);
  const axisAttrs = { fill: theme.mutedText, 'font-size': String(labelSize) };
  return h
    .el('svg')
    .attrs({
      class: 'chart-frame',
      viewBox: `0 0 ${frame.width} ${frame.height}`,
      width: '100%',
      height: String(frame.height),
      role: 'img',
      'aria-label': `Wind observations. ${description}`,
      style: `display:block;background:${theme.background};color:${theme.text};font-family:${theme.fontFamily}`,
    })
    .children(
      h.el('title').children('Wind observations'),
      h.el('desc').children(description),
      h
        .el('g')
        .attrs({
          class: 'chart-grid',
          stroke: theme.grid,
          'stroke-width': '1',
          'aria-hidden': 'true',
        })
        .children(
          ...geometry.xTicks.map(({ position }) => line(position, plot.top, position, plot.bottom)),
          ...geometry.yTicks.map(({ position }) => line(plot.left, position, plot.right, position)),
        ),
      h
        .el('g')
        .attrs({ ...axisAttrs, class: 'chart-axis chart-axis-bottom' })
        .children(
          line(plot.left, plot.bottom, plot.right, plot.bottom, theme.axis),
          ...geometry.xTicks.map(({ position, value }) =>
            text(position, plot.bottom + labelSize + 8, 'middle', hourLabel(value)),
          ),
          text((plot.left + plot.right) / 2, frame.height - 8, 'middle', 'Hour', theme.text),
        ),
      h
        .el('g')
        .attrs({ ...axisAttrs, class: 'chart-axis chart-axis-left' })
        .children(
          line(plot.left, plot.top, plot.left, plot.bottom, theme.axis),
          ...geometry.yTicks.map(({ position, value }) =>
            text(plot.left - 8, position + 4, 'end', String(value)),
          ),
          text(
            plot.left,
            Math.max(labelSize, plot.top - 10),
            'start',
            'Wind speed (m/s)',
            theme.text,
          ),
        ),
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
    );
};
