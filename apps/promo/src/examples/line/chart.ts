import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame, Domain } from '@opsydyn/foldkit-viz/chart/cartesian';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';

import { exampleTheme, frameForWidth, tickCountForWidth } from '#example/frame';

export type Curve = 'catmullRom' | 'linear' | 'step';
export type Settings = Readonly<{ curve: Curve; values: ReadonlyArray<number>; yMax: number }>;

export const chartTheme = exampleTheme;
export const seriesStyle = resolveSeriesStyle(
  chartTheme,
  {
    stroke: 'var(--chart-series-a, var(--blue, #3d79fa))',
    fill: 'var(--chart-series-a, var(--blue, #3d79fa))',
    pointRadius: 5,
    strokeWidth: 3,
  },
  {},
  {},
);
export const comparisonStyle = resolveSeriesStyle(
  chartTheme,
  { stroke: 'var(--chart-series-b, var(--coral, #fa8b79))', dashPattern: '5 4', strokeWidth: 2 },
  {},
  {},
);
export function chartGeometry(
  settings: Settings,
  options: Readonly<{ frame?: ChartFrame; xDomain?: Domain; yDomain?: Domain }> = {},
) {
  const frame = options.frame ?? frameForWidth(560, 290);
  const cartesian = lineGeometry(
    settings.values,
    {
      x: (_value, index) => index,
      y: (value) => value,
      datumKey: (_value, index) => String(index),
      seriesKey: () => 'values',
    },
    {
      frame,
      xDomain: options.xDomain ?? [0, Math.max(0, settings.values.length - 1)],
      yDomain: options.yDomain ?? [0, settings.yMax],
      xTickCount: tickCountForWidth(frame.width),
      yTickCount: tickCountForWidth(frame.width),
      curve: settings.curve,
    },
  );
  return {
    cartesian,
    path: cartesian.series[0]?.path ?? '',
    points: cartesian.points.map((p): readonly [number, number] => [p.x, p.y]),
    xTicks: cartesian.xTicks.map((t) => ({ value: t.value + 1, x: t.position })),
    yTicks: cartesian.yTicks.map((t) => ({ value: t.value, y: t.position })),
  };
}

export function changeValue(settings: Settings, index: number, raw: string): Settings {
  const value = Number(raw);
  if (
    raw.trim() === '' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= settings.values.length
  )
    return settings;
  return {
    ...settings,
    values: settings.values.map((previous, i) => (i === index ? value : previous)),
  };
}

export function changeDomain(settings: Settings, raw: string): Settings {
  const yMax = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(yMax) || yMax < 100 || yMax > 200 || yMax % 10 !== 0)
    return settings;
  return { ...settings, yMax };
}

export function settingsSource(settings: Settings): string {
  return (
    '// Change these values to explore the chart.\nexport const initialSettings = ' +
    JSON.stringify(settings, null, 2) +
    ' as const;\n'
  );
}
