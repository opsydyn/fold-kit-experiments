import { describe, expect, it } from 'bun:test';

import { triangulate, voronoiDiagram } from '../src/math/delaunay';
import { randomLcg } from '../src/math/random';

type Point = readonly [number, number];

const sites = (seed: number, n: number): ReadonlyArray<Point> => {
  const rng = randomLcg(seed);
  return Array.from({ length: n }, () => [4 + rng() * 432, 4 + rng() * 252] as const);
};

const inside = (p: Point, polygon: ReadonlyArray<Point>): boolean => {
  let crossings = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i] ?? [0, 0],
      [xj, yj] = polygon[j] ?? [0, 0];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      crossings = !crossings;
  }
  return crossings;
};

describe('Delaunay triangulation', () => {
  it.each([7, 42, 2026])('leaves every circumcircle empty (seed %i)', (seed) => {
    const points = sites(seed, 80);
    const { triangles } = triangulate(points);
    let violations = 0;
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]].map(
        (k) => points[k ?? 0] ?? [0, 0],
      );
      if (a === undefined || b === undefined || c === undefined) continue;
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      const sq = (p: Point) => p[0] ** 2 + p[1] ** 2;
      const ux = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d;
      const uy = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d;
      const r2 = (a[0] - ux) ** 2 + (a[1] - uy) ** 2;
      if (points.some((p) => (p[0] - ux) ** 2 + (p[1] - uy) ** 2 < r2 - 1e-6)) violations += 1;
    }
    expect(violations).toBe(0);
    // A triangulation of n points with h on the hull has 2n - 2 - h triangles.
    expect(triangles.length / 3).toBe(2 * points.length - 2 - triangulate(points).hull.length);
  });

  it('gives every site a Voronoi cell that contains it', () => {
    const points = sites(7, 55);
    const cells = voronoiDiagram(points, [4, 4, 436, 256]);
    expect(cells.every((cell, i) => cell !== null && inside(points[i] ?? [0, 0], cell))).toBe(true);
  });
});
