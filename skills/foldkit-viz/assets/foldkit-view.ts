import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { lightTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { chartFrame, lineSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import type { Html, HtmlBuilder } from 'foldkit/html';

const data = [
  { id: 'jan', month: 1, value: 12 },
  { id: 'feb', month: 2, value: 18 },
];

export function chartView<Message>(h: HtmlBuilder<Message>): Html {
  const geometry = lineGeometry(
    data,
    { x: (d) => d.month, y: (d) => d.value, datumKey: (d) => d.id, seriesKey: () => 'Core' },
    { frame: { width: 600, height: 280, margins: { top: 16, right: 24, bottom: 40, left: 48 } } },
  );
  const theme = lightTheme;
  const style = resolveSeriesStyle(theme, {}, {}, {});
  return chartFrame(
    h,
    { layout: geometry.layout, title: 'Activity', description: 'January 12; February 18', theme },
    geometry.series.map((series) => lineSeries(h, { path: series.path, style })),
  );
}
