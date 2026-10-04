import { scatterGeometry as projectScatter } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame, Domain } from '@opsydyn/foldkit-viz/chart/cartesian';
import { createSeriesStyles } from '@opsydyn/foldkit-viz/chart/theme';

import { exampleTheme, frameForWidth, tickCountForWidth } from '#example/frame';

import { points } from './data';
import type { Point } from './data';

export type Settings = Readonly<{
  group: 'all' | 'a' | 'b';
  xMax: number;
  yMax: number;
  selectedPoint: string | null;
}>;

export const chartTheme = exampleTheme;
export const seriesStyles = createSeriesStyles(
  ['a', 'b'],
  ['var(--chart-series-a, var(--blue, #3d79fa))', 'var(--chart-series-b, var(--coral, #fa8b79))'],
  new Map([
    ['a', { pointRadius: 6, strokeWidth: 1, symbol: 'circle' }],
    ['b', { pointRadius: 6, strokeWidth: 1, symbol: 'square' }],
  ]),
);
export function scatterGeometry(
  data: ReadonlyArray<Point>,
  settings: Settings,
  options: Readonly<{ frame?: ChartFrame; xDomain?: Domain; yDomain?: Domain }> = {},
) {
  const frame = options.frame ?? frameForWidth(560, 320);
  const cartesian = projectScatter(
    data.filter((point) => settings.group === 'all' || point.group === settings.group),
    {
      x: (point) => point.x,
      y: (point) => point.y,
      datumKey: (point) => point.id,
      seriesKey: (point) => point.group,
    },
    {
      frame,
      xDomain: options.xDomain ?? [0, settings.xMax],
      yDomain: options.yDomain ?? [0, settings.yMax],
      xTickCount: tickCountForWidth(frame.width),
      yTickCount: tickCountForWidth(frame.width),
    },
  );
  return {
    cartesian,
    points: cartesian.points.map((p) => ({ ...p.datum, cx: p.x, cy: p.y })),
    xTicks: cartesian.xTicks.map((t) => ({ value: t.value, x: t.position })),
    yTicks: cartesian.yTicks.map((t) => ({ value: t.value, y: t.position })),
  };
}

export function navigatePoint(settings: Settings, key: string): Settings {
  const visible = points.filter(
    (point) => settings.group === 'all' || point.group === settings.group,
  );
  if (key === 'Escape' || visible.length === 0) return { ...settings, selectedPoint: null };
  const index = visible.findIndex((point) => point.id === settings.selectedPoint);
  let next: number;
  if (key === 'Home') next = 0;
  else if (key === 'End') next = visible.length - 1;
  else if (key === 'ArrowRight' || key === 'ArrowDown') next = (index + 1) % visible.length;
  else if (key === 'ArrowLeft' || key === 'ArrowUp')
    next = index <= 0 ? visible.length - 1 : index - 1;
  else return settings;
  return selectPoint(settings, visible[next]?.id ?? '');
}

export function changeDomain(settings: Settings, axis: 'xMax' | 'yMax', raw: string): Settings {
  const value = Number(raw);
  if (
    raw.trim() === '' ||
    !Number.isInteger(value) ||
    value < 100 ||
    value > 200 ||
    value % 10 !== 0
  )
    return settings;
  return { ...settings, [axis]: value };
}

export function selectPoint(settings: Settings, id: string): Settings {
  if (id === '') return { ...settings, selectedPoint: null };
  const point = points.find((point) => point.id === id);
  if (!point || (settings.group !== 'all' && point.group !== settings.group)) return settings;
  return { ...settings, selectedPoint: id };
}

export function changeGroup(settings: Settings, group: Settings['group']): Settings {
  const next = { ...settings, group };
  const selected = points.find((point) => point.id === settings.selectedPoint);
  return selected && group !== 'all' && selected.group !== group
    ? { ...next, selectedPoint: null }
    : next;
}

export function settingsSource(settings: Settings): string {
  return (
    '// Change these values to explore the chart.\nexport const initialSettings = ' +
    JSON.stringify(settings, null, 2) +
    ' as const;\n'
  );
}
