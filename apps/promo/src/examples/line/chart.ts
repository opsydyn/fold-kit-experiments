import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { line } from '@opsydyn/foldkit-viz/shape/line';

export type Curve = 'catmullRom' | 'linear' | 'step';
export type Settings = Readonly<{ curve: Curve; values: ReadonlyArray<number>; yMax: number }>;

export function chartGeometry(settings: Settings) {
  const x = linear({ domain: [0, settings.values.length - 1], range: [48, 528] });
  const y = linear({ domain: [0, settings.yMax], range: [250, 30] });
  const points = settings.values.map((value, index): readonly [number, number] => [
    x(index),
    y(value),
  ]);
  return {
    path: line(points, { curve: settings.curve }) ?? '',
    points,
    xTicks: settings.values.map((_, index) => ({ value: index + 1, x: x(index) })),
    yTicks: linearTicks([0, settings.yMax], 5).map((value) => ({ value, y: y(value) })),
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
