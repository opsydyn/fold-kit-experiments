import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import { rowsOf } from '@opsydyn/foldkit-viz/plot';
import type { PlotData, PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/**
 * Example charts written as plain JSON specs (ADR 0037). Each one could have
 * come from a server, a notebook or a language model: nothing here is a
 * function.
 */

export type Example = Readonly<{ id: string; title: string; note: string; spec: PlotSpec }>;

const species = ['Adelie', 'Gentoo', 'Chinstrap'] as const;

const buildFlippers = (): ReadonlyArray<Row> => {
  const rng = randomLcg(5);
  const noise = randomNormal(0, 1, rng);
  return species.flatMap((name, s) =>
    Array.from({ length: 40 }, (_, i) => {
      const mass = 3200 + s * 900 + 1100 * rng();
      return {
        id: `${name}-${i}`,
        species: name,
        sex: rng() < 0.5 ? 'female' : 'male',
        mass: Math.round(mass),
        flipper: Math.round(150 + s * 8 + 0.012 * mass + 4 * noise()),
      };
    }),
  );
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const buildUnits = (): ReadonlyArray<Row> =>
  months.map((month, i) => ({ month, units: Math.round(80 + 40 * Math.sin(i / 2) + 10 * i) }));

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const buildActivity = (): ReadonlyArray<Row> => {
  const rng = randomLcg(9);
  return days.flatMap((day, d) =>
    Array.from({ length: 24 }, (_, hour) => {
      const working = d < 5 && hour >= 8 && hour <= 18;
      return {
        day,
        hour: String(hour).padStart(2, '0'),
        requests: Math.round((working ? 120 : 30) * (0.7 + 0.6 * rng()) + (hour === 12 ? 60 : 0)),
      };
    }),
  );
};

const buildLatency = (): ReadonlyArray<Row> => {
  const noise = randomNormal(0, 1, randomLcg(17));
  const start = Date.UTC(2026, 10, 12);
  return Array.from({ length: 20_000 }, (_, i) => ({
    time: new Date(start + i * 4_000).toISOString(),
    ms: Math.max(1, 40 + 15 * Math.sin(i / 900) + 6 * noise() + (i % 2_500 === 0 ? 120 : 0)),
  }));
};

const buildTemperature = (): ReadonlyArray<Row> => {
  const noise = randomNormal(0, 1, randomLcg(29));
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: 365 }, (_, day) => {
    const mean = 11 + 9 * Math.sin(((day - 105) / 365) * 2 * Math.PI) + noise();
    return {
      date: new Date(start + day * 86_400_000).toISOString().slice(0, 10),
      low: Math.round((mean - 4 - Math.abs(noise())) * 10) / 10,
      high: Math.round((mean + 4 + Math.abs(noise())) * 10) / 10,
      mean: Math.round(mean * 10) / 10,
    };
  });
};

export const examples: ReadonlyArray<Example> = [
  {
    id: 'facets',
    title: 'Facets with a fit per panel',
    note: 'Three panels on shared scales, coloured by a second field, each with its own regression and band.',
    spec: {
      width: 720,
      height: 300,
      data: buildFlippers(),
      facet: { x: 'species' },
      x: { label: 'Body mass (g)' },
      y: { label: 'Flipper length (mm)' },
      marks: [
        {
          mark: 'dot',
          x: 'mass',
          y: 'flipper',
          fill: 'sex',
          r: { value: 2.5 },
          opacity: 0.8,
          title: 'id',
        },
        {
          mark: 'line',
          x: 'mass',
          y: 'flipper',
          stroke: { value: '#e8a33c' },
          transform: { type: 'regression' },
        },
      ],
    },
  },
  {
    id: 'bars',
    title: 'Bars, a target and labels',
    note: 'A band axis from month names, a reference rule from a constant, and text labels above each bar.',
    spec: {
      width: 720,
      height: 280,
      data: buildUnits(),
      y: { label: 'Units sold' },
      marks: [
        { mark: 'bar', x: 'month', y: 'units', fill: { value: '#6aa7e8' }, title: 'units' },
        { mark: 'rule', y: { value: 150 }, stroke: { value: '#e8727a' }, strokeWidth: 1.5 },
        { mark: 'text', x: 'month', y: 'units', text: 'units', dy: -5 },
      ],
    },
  },
  {
    id: 'heatmap',
    title: 'Heatmap',
    note: 'Two band axes and a sequential colour scale with its legend, inferred from numbers.',
    spec: {
      width: 720,
      height: 260,
      data: buildActivity(),
      x: { label: 'Hour (UTC)', padding: 0.05 },
      y: { label: '', padding: 0.05 },
      color: { label: 'Requests' },
      marks: [{ mark: 'cell', x: 'hour', y: 'day', fill: 'requests', title: 'requests' }],
    },
  },
  {
    id: 'downsample',
    title: '20,000 samples, downsampled and smoothed',
    note: 'ISO timestamps become a UTC time axis. M4 reduces the raw line to the plot width; the smoothed line chains a moving mean and an LTTB downsample.',
    spec: {
      width: 720,
      height: 280,
      data: buildLatency(),
      x: { label: 'Time (UTC)' },
      y: { label: 'Latency (ms)', type: 'log' },
      marks: [
        {
          mark: 'line',
          x: 'time',
          y: 'ms',
          stroke: { value: '#8fb8de' },
          strokeWidth: 1,
          transform: { type: 'downsample', method: 'm4' },
        },
        {
          mark: 'line',
          x: 'time',
          y: 'ms',
          stroke: { value: '#e8a33c' },
          strokeWidth: 2,
          transform: [
            { type: 'window', size: 301, reduce: 'mean', anchor: 'centre' },
            { type: 'downsample', method: 'lttb' },
          ],
        },
      ],
    },
  },
  {
    id: 'range',
    title: 'A range band and its mean',
    note: 'An area between two fields, with the daily mean drawn over it.',
    spec: {
      width: 720,
      height: 280,
      data: buildTemperature(),
      x: { label: 'Date' },
      y: { label: 'Temperature (°C)' },
      marks: [
        {
          mark: 'area',
          x: 'date',
          y: 'high',
          y0: 'low',
          fill: { value: '#6aa7e8' },
          opacity: 0.35,
        },
        { mark: 'line', x: 'date', y: 'mean', stroke: { value: '#e6edf3' }, strokeWidth: 1.25 },
      ],
    },
  },
];

/** Long data arrays shown as their first two rows and a count. */
const summarise = (data: PlotData): ReadonlyArray<Row | string> => {
  const rows = rowsOf(data);
  return rows.length > 3
    ? [...rows.slice(0, 2), `… ${(rows.length - 2).toLocaleString('en-US')} more rows`]
    : rows;
};

/** The spec as JSON for display, with long data arrays summarised. */
export const displaySpec = (spec: PlotSpec): string => {
  const marks = spec.marks.map((mark) =>
    mark.data === undefined ? mark : { ...mark, data: summarise(mark.data) },
  );
  const shown =
    spec.data === undefined ? { ...spec, marks } : { ...spec, data: summarise(spec.data), marks };
  return JSON.stringify(shown, null, 2);
};
