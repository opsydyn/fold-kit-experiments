import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';

/**
 * The sample's data, the same on every visit: three clusters of measurements
 * for the scatter, and a hill-and-valley surface on a grid.
 */

export type Measurement = Readonly<{
  id: number;
  cluster: string;
  x: number;
  y: number;
  z: number;
}>;

const centres = [
  { cluster: 'alpha', x: 2, y: 3, z: 6 },
  { cluster: 'beta', x: 6, y: 7, z: 3 },
  { cluster: 'gamma', x: 7, y: 2, z: 8 },
];

export const measurements: ReadonlyArray<Measurement> = (() => {
  const rng = randomLcg(42);
  const normal = randomNormal(0, 1, rng);
  return Array.from({ length: 450 }, (_, id) => {
    const centre = centres[id % centres.length] ?? centres[0]!;
    return {
      id,
      cluster: centre.cluster,
      x: centre.x + normal() * 0.9,
      y: centre.y + normal() * 0.9,
      z: centre.z + normal() * 0.9,
    };
  });
})();

const steps = (from: number, to: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));

/** z = sin(x)·cos(y) with a slope, on a 32 by 32 grid. */
export const hill = (() => {
  const xs = steps(-3, 3, 32),
    ys = steps(-3, 3, 32);
  return { xs, ys, z: ys.map((y) => xs.map((x) => Math.sin(x) * Math.cos(y) + x * 0.15)) };
})();
