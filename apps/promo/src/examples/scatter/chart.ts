import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';

import { points } from './data';
import type { Point } from './data';

export type Settings = Readonly<{
  group: 'all' | 'a' | 'b';
  xMax: number;
  yMax: number;
  selectedPoint: string | null;
}>;

export function scatterGeometry(data: ReadonlyArray<Point>, settings: Settings) {
  const x = linear({ domain: [0, settings.xMax], range: [48, 528] });
  const y = linear({ domain: [0, settings.yMax], range: [250, 30] });
  return {
    points: data
      .filter((point) => settings.group === 'all' || point.group === settings.group)
      .map((point) => ({ ...point, cx: x(point.x), cy: y(point.y) })),
    xTicks: linearTicks([0, settings.xMax], 5).map((value) => ({ value, x: x(value) })),
    yTicks: linearTicks([0, settings.yMax], 5).map((value) => ({ value, y: y(value) })),
  };
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
