import { histogramGeometry as projectHistogram } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame, Domain } from '@opsydyn/foldkit-viz/chart/cartesian';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';

import { exampleTheme, frameForWidth, tickCountForWidth } from '#example/frame';

export type Settings = Readonly<{ dataset: 'spread' | 'clustered'; binCount: number }>;

export const chartTheme = exampleTheme;
export const seriesStyle = resolveSeriesStyle(
  chartTheme,
  { stroke: 'none', fill: 'var(--chart-series-a, var(--blue, #3d79fa))', strokeWidth: 0 },
  {},
  {},
);
export function histogramGeometry(
  values: ReadonlyArray<number>,
  binCount: number,
  options: Readonly<{ frame?: ChartFrame; domain?: Domain }> = {},
) {
  const frame = options.frame ?? frameForWidth(560, 290);
  const cartesian = projectHistogram(values, (value) => value, {
    frame,
    domain: options.domain ?? [0, 100],
    binCount,
    gap: 1,
    xTickCount: tickCountForWidth(frame.width),
    yTickCount: tickCountForWidth(frame.width),
  });
  return {
    cartesian,
    bars: cartesian.bins.map((bin, index) => ({
      ...bin,
      interval:
        '[' +
        Number(bin.x0.toFixed(1)) +
        ', ' +
        Number(bin.x1.toFixed(1)) +
        (index === cartesian.bins.length - 1 ? ']' : ')'),
    })),
    total: cartesian.bins.reduce((sum, bin) => sum + bin.count, 0),
    xTicks: cartesian.xTicks.map((t) => ({ value: t.value, x: t.position })),
    yTicks: cartesian.yTicks
      .filter((t) => Number.isInteger(t.value))
      .map((t) => ({ value: t.value, y: t.position })),
  };
}

export function changeBinCount(settings: Settings, raw: string): Settings {
  const binCount = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(binCount) || binCount < 2 || binCount > 20)
    return settings;
  return { ...settings, binCount };
}

export function settingsSource(settings: Settings): string {
  return (
    '// Change these values to explore the chart.\nexport const initialSettings = ' +
    JSON.stringify(settings, null, 2) +
    ' as const;\n'
  );
}
