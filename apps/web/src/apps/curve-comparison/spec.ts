import type { MarkSpec, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import type { CurveType } from '@opsydyn/foldkit-viz/shape/line';

// Ten points with a non-monotone shape, so the curves differ visibly.
const POINTS = [20, 80, 45, 60, 10, 95, 30, 70, 50, 90];
const CURVES: ReadonlyArray<readonly [CurveType, string]> = [
  ['linear', 'linear'],
  ['monotoneX', 'monotone'],
  ['catmullRom', 'Catmull–Rom'],
  ['step', 'step'],
];

const lines: ReadonlyArray<MarkSpec> = CURVES.map(([curve, name]) => ({
  mark: 'line',
  data: POINTS.map((y, x) => ({ x, y, curve: name })),
  x: 'x',
  y: 'y',
  stroke: 'curve',
  curve,
  strokeWidth: 1.75,
}));

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Curve interpolation',
  description: 'The same ten points joined by linear, monotone, Catmull–Rom and step curves.',
  x: { label: 'x' },
  y: { label: 'y' },
  color: { label: 'Curve' },
  marks: [
    ...lines,
    {
      mark: 'dot',
      data: POINTS.map((y, x) => ({ x, y })),
      x: 'x',
      y: 'y',
      fill: { value: 'currentColor' },
      r: { value: 3 },
    },
  ],
};
