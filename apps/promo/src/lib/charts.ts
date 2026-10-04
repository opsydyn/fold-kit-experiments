import { bin } from '@opsydyn/foldkit-viz/math/bin';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { arc } from '@opsydyn/foldkit-viz/shape/arc';
import { area } from '@opsydyn/foldkit-viz/shape/area';
import { chord, ribbon } from '@opsydyn/foldkit-viz/shape/chord';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { sankey } from '@opsydyn/foldkit-viz/shape/sankey';
import { stack } from '@opsydyn/foldkit-viz/shape/stack';

import { mapPaths } from './map';

export const colours = ['blue', 'coral', 'gold', 'mint', 'lavender', 'periwinkle'];
export const seriesNames = ['Core', 'Tools', 'Community', 'Design', 'Learning', 'Experiments'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const values = [
  [16, 14, 12, 12, 10, 10],
  [21, 16, 14, 15, 11, 12],
  [16, 14, 12, 12, 10, 10],
  [17, 15, 13, 14, 10, 11],
  [22, 18, 16, 16, 12, 13],
  [26, 20, 17, 16, 12, 13],
  [21, 17, 15, 14, 11, 12],
  [18, 15, 13, 13, 10, 11],
  [23, 18, 16, 17, 12, 13],
  [24, 20, 18, 18, 13, 14],
  [30, 23, 20, 20, 15, 16],
  [34, 26, 22, 22, 14, 12],
];
const heroX = linear({ domain: [0, 11], range: [42, 526] });
const heroY = linear({ domain: [0, 140], range: [258, 18] });
const rows = values.map((row) => Object.fromEntries(row.map((value, i) => [String(i), value])));

export const heroMonths = months.map((label, i) => ({
  label,
  total: (values[i] ?? []).reduce((total, value) => total + value, 0),
  x: heroX(i),
  y: heroY((values[i] ?? []).reduce((total, value) => total + value, 0)),
}));
export const heroSeries = stack(rows, { keys: ['5', '4', '3', '2', '1', '0'] })
  .map((series) => ({
    colour: colours[Number(series.key)] ?? 'blue',
    d:
      area(
        series.bands.map((band, i) => [heroX(i), heroY(band.y1)]),
        258,
        {
          curve: 'catmullRom',
        },
      ) ?? '',
  }))
  .reverse();

const matrix = [
  [0, 12, 8, 10, 5, 9],
  [12, 0, 7, 4, 10, 6],
  [8, 7, 0, 14, 8, 5],
  [10, 4, 14, 0, 9, 8],
  [5, 10, 8, 9, 0, 12],
  [9, 6, 5, 8, 12, 0],
];
const chordLayout = chord(matrix, { padAngle: 0.045 });
export const chordGroups = chordLayout.groups.map((group) => ({
  colour: colours[group.index] ?? 'blue',
  d: arc({
    innerRadius: 88,
    outerRadius: 100,
    startAngle: group.startAngle,
    endAngle: group.endAngle,
  }),
}));
export const chordRibbons = chordLayout.chords.map((connection) => ({
  colour: colours[connection.source.index] ?? 'blue',
  d: ribbon(connection.source, connection.target, { radius: 85 }),
}));
export const flow = sankey(
  ['Web', 'Mobile', 'API', 'Other', 'Sign up', 'Active', 'Purchase', 'Return'].map((id) => ({
    id,
  })),
  [
    { source: 'Web', target: 'Sign up', value: 24 },
    { source: 'Web', target: 'Active', value: 18 },
    { source: 'Web', target: 'Purchase', value: 10 },
    { source: 'Mobile', target: 'Sign up', value: 12 },
    { source: 'Mobile', target: 'Active', value: 22 },
    { source: 'Mobile', target: 'Return', value: 12 },
    { source: 'API', target: 'Active', value: 10 },
    { source: 'API', target: 'Purchase', value: 18 },
    { source: 'Other', target: 'Purchase', value: 6 },
    { source: 'Other', target: 'Return', value: 16 },
  ],
  { width: 200, height: 185, nodeWidth: 7, nodePadding: 14 },
);

// Deterministic illustrative points; no runtime randomisation or remote data.
export const scatter = Array.from({ length: 135 }, (_, i) => {
  const group = i % 3;
  const value = 10 + ((i * 37) % 83);
  return {
    x: 34 + value * 2.52,
    y: 193 - (value * 1.38 + Math.sin(i * 2.7) * 28 + group * 8),
    colour: colours[group] ?? 'blue',
  };
});
const curveValues = [18, 36, 54, 41, 29, 59, 64, 78, 49, 57];
const curveX = linear({ domain: [0, 9], range: [34, 300] });
const curveY = linear({ domain: [0, 100], range: [197, 20] });
export const plotX = linear({ domain: [0, 100], range: [34, 300] });
export const curves = ['catmullRom', 'linear', 'step'] as const;
export const curvePlots = curves.map((curve) => ({
  curve,
  series: [0, 1, 2].map((i) => ({
    colour: colours[i] ?? 'blue',
    d:
      line(
        curveValues.map((value, j) => [curveX(j), curveY(value * (1 - i * 0.25) - i * 3)]),
        { curve },
      ) ?? '',
  })),
}));
export const histograms = [0, 1].map((group) => {
  const samples = Array.from(
    { length: 220 },
    (_, i) => 32 + group * 28 + 7 * (Math.sin(i * 1.7) + Math.sin(i * 3.3) + Math.sin(i * 5.1)),
  );
  const countY = linear({ domain: [0, 50], range: [197, 20] });
  return bin(samples, {
    domain: [0, 100],
    thresholds: Array.from({ length: 19 }, (_, i) => (i + 1) * 5),
  }).map((bucket) => ({
    x: plotX(bucket.x0),
    y: countY(bucket.count),
    width: plotX(bucket.x1) - plotX(bucket.x0) - 1,
    height: 197 - countY(bucket.count),
    count: bucket.count,
    colour: group === 0 ? 'mint' : 'coral',
  }));
});

export const chartPaths = [
  ...mapPaths.map(({ d }) => d),
  ...heroSeries.map(({ d }) => d),
  ...chordGroups.map(({ d }) => d),
  ...chordRibbons.map(({ d }) => d),
  ...flow.links.map(({ pathD }) => pathD),
  ...curvePlots.flatMap(({ series }) => series.map(({ d }) => d)),
];
