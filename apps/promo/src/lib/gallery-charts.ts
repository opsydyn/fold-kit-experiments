import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';
import {
  hierarchy,
  sum,
  treemap,
  pack,
  treeLayout,
  descendants,
} from '@opsydyn/foldkit-viz/hierarchy';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { boxStats, kde } from '@opsydyn/foldkit-viz/math/stats';
import { arc } from '@opsydyn/foldkit-viz/shape/arc';
import { area } from '@opsydyn/foldkit-viz/shape/area';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { lineRadial } from '@opsydyn/foldkit-viz/shape/lineRadial';
import { pie } from '@opsydyn/foldkit-viz/shape/pie';
import { stack } from '@opsydyn/foldkit-viz/shape/stack';

const frame = { width: 340, height: 230, margins: { top: 20, right: 20, bottom: 35, left: 35 } };
import { barData, barAccessors } from '../examples/bars/data';
export { barData } from '../examples/bars/data';
export const grouped = barGeometry(barData, barAccessors, {
  frame,
  mode: 'grouped',
  orientation: 'vertical',
});
export const stacked = barGeometry(barData, barAccessors, {
  frame,
  mode: 'stacked',
  orientation: 'horizontal',
});
export const donut = pie([34, 26, 18, 14, 8], { sortValues: null }).map((d) => ({
  d: arc({
    innerRadius: 60,
    outerRadius: 92,
    startAngle: d.startAngle,
    endAngle: d.endAngle,
    padAngle: 0.03,
  }),
  value: d.value,
}));
const x = linear({ domain: [0, 7], range: [35, 320] });
const y = linear({ domain: [0, 100], range: [195, 20] });
const values = [18, 32, 24, 56, 48, 68, 60, 86];
export const areaPath =
  area(
    values.map((v, i) => [x(i), y(v)]),
    195,
    { curve: 'catmullRom' },
  ) ?? '';
const streamRows = values.map((v, i) => ({ a: v / 3, b: 15 + i * 2, c: 10 + ((i * 11) % 20) }));
const sy = linear({ domain: [-50, 50], range: [195, 20] });
export const streamPaths = stack(streamRows, { keys: ['a', 'b', 'c'], offset: 'silhouette' }).map(
  (series) =>
    (line(
      [
        ...series.bands.map((d, i): readonly [number, number] => [x(i), sy(d.y1)]),
        ...series.bands.map((d, i): readonly [number, number] => [x(i), sy(d.y0)]).reverse(),
      ],
      { curve: 'linear' },
    ) ?? '') + 'Z',
);
export const radarPaths = [0, 1, 2].map(
  (j) =>
    lineRadial(
      Array.from({ length: 6 }, (_, i): readonly [number, number] => [
        (i * Math.PI) / 3,
        40 + ((i * 21 + j * 17) % 50),
      ]),
      { closed: true },
    ) ?? '',
);
export const heatCells = Array.from({ length: 56 }, (_, i) => ({
  x: 45 + (i % 8) * 33,
  y: 25 + Math.floor(i / 8) * 23,
  opacity: 0.2 + ((i * 17) % 10) / 12,
}));
type Branch = { name: string; value: number; children?: Branch[] };
const structure: Branch = {
  name: 'All',
  value: 0,
  children: [
    {
      name: 'Core',
      value: 0,
      children: [
        { name: 'Scale', value: 34 },
        { name: 'Shape', value: 26 },
      ],
    },
    {
      name: 'Interaction',
      value: 0,
      children: [
        { name: 'Brush', value: 18 },
        { name: 'Zoom', value: 14 },
        { name: 'Select', value: 8 },
      ],
    },
  ],
};
const makeRoot = () =>
  sum(
    hierarchy(structure, (d) => d.children),
    (d) => d.value,
  );
export const tiles = descendants(
  treemap(makeRoot(), { width: 280, height: 170, paddingInner: 3 }),
).filter((d) => !d.children);
const packed = pack(makeRoot(), { width: 290, height: 190, padding: 0.5 });
export const circleGroups = packed.children ?? [];
export const circles = [...(packed.children ?? []).flatMap((d) => d.children ?? [])];
export const treeNodes = treeLayout(makeRoot(), { width: 170, height: 260 });
export const statistics = [0, 1, 2].map((group) => {
  const samples = Array.from(
    { length: 45 },
    (_, i) => 20 + group * 12 + Math.sin(i * 1.7) * 10 + i / 3,
  );
  const stats = boxStats(samples);
  const density = kde(
    samples,
    Array.from({ length: 41 }, (_, i) => i * 2.5),
    7,
  );
  const centre = 90 + group * 80;
  const width = linear({ domain: [0, Math.max(...density.map((d) => d.density))], range: [0, 25] });
  const violin =
    (line(
      [
        ...density.map((d) => [centre - width(d.density), y(d.value)] as const),
        ...density.map((d) => [centre + width(d.density), y(d.value)] as const).reverse(),
      ],
      { curve: 'linear' },
    ) ?? '') + 'Z';
  return { centre, stats, violin, y };
});
