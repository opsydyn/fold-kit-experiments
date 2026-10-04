import { bin } from '@opsydyn/foldkit-viz/math/bin';
import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';

export type Settings = Readonly<{ dataset: 'spread' | 'clustered'; binCount: number }>;

export function histogramGeometry(values: ReadonlyArray<number>, binCount: number) {
  // Explicit thresholds give exactly the selected number of bins, rather than a tick-count hint.
  const thresholds = Array.from(
    { length: binCount - 1 },
    (_, index) => (100 * (index + 1)) / binCount,
  );
  const bins = bin(values, { domain: [0, 100], thresholds });
  const yMax = Math.max(1, ...bins.map(({ count }) => count));
  const x = linear({ domain: [0, 100], range: [48, 528] });
  const y = linear({ domain: [0, yMax], range: [250, 30] });
  return {
    bars: bins.map(({ x0, x1, count }, index) => ({
      x0,
      x1,
      count,
      x: x(x0),
      y: y(count),
      width: x(x1) - x(x0) - 1,
      height: 250 - y(count),
      interval:
        '[' +
        Number(x0.toFixed(1)) +
        ', ' +
        Number(x1.toFixed(1)) +
        (index === bins.length - 1 ? ']' : ')'),
    })),
    total: bins.reduce((sum, { count }) => sum + count, 0),
    xTicks: linearTicks([0, 100], 5).map((value) => ({ value, x: x(value) })),
    yTicks: linearTicks([0, yMax], 5)
      .filter(Number.isInteger)
      .map((value) => ({ value, y: y(value) })),
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
