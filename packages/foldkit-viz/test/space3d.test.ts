import { describe, expect, it } from 'bun:test';

import { rgbOf, scatter3d, space3d, surface3d } from '../src/chart/space3d.js';
import { tableau10, viridis } from '../src/math/schemes.js';

describe('space3d', () => {
  const space = space3d(
    { x: [0, 10], y: [0, 100], z: [-1, 1] },
    { half: 1, labels: { x: 'time', y: 'size', z: 'value' } },
  );

  it('maps x across, z up and y into the scene, each domain onto the cube', () => {
    expect(space.place(0, 0, -1)).toEqual([-1, -1, 1]);
    expect(space.place(10, 100, 1)).toEqual([1, 1, -1]);
    expect(space.place(5, 50, 0)).toEqual([0, 0, 0]);
  });

  it('draws the twelve edges of the cube', () => {
    expect(space.box).toHaveLength(12);
    for (const [a, b] of space.box) {
      const differ = a.filter((v, i) => v !== b[i]).length;
      expect(differ).toBe(1);
    }
  });

  it('labels every axis with nice ticks along an outer edge, and names it', () => {
    const [x, y, z] = space.axes;
    expect(x.ticks.map((t) => t.label)).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(x.label).toBe('time');
    expect(y.label).toBe('size');
    expect(z.label).toBe('value');
    // x ticks run along the bottom front edge, outside the cube.
    for (const tick of x.ticks) {
      expect(tick.position[1]).toBeLessThan(-1);
      expect(tick.position[2]).toBeGreaterThan(1);
    }
    expect(z.ticks[0]?.position[1]).toBeCloseTo(-1, 6);
    expect(z.ticks.at(-1)?.position[1]).toBeCloseTo(1, 6);
  });

  it('rules a grid on the floor and the two back walls at the ticks', () => {
    expect(space.grid.length).toBeGreaterThan(10);
    const onBackOrFloor = space.grid.every(([a, b]) =>
      [a, b].every((p) => p[1] === -1 || p[2] === -1 || p[0] === -1),
    );
    expect(onBackOrFloor).toBe(true);
  });

  it('refuses a domain that is not finite', () => {
    expect(() => space3d({ x: [0, Number.NaN], y: [0, 1], z: [0, 1] })).toThrow(
      'space3d: x domain must be finite',
    );
  });
});

describe('scatter3d', () => {
  const rows = [
    { a: 1, b: 2, c: 3, kind: 'p' },
    { a: 2, b: 4, c: 1, kind: 'q' },
    { a: Number.NaN, b: 1, c: 1, kind: 'p' },
    { a: 3, b: 6, c: 2, kind: 'p' },
  ];
  const scatter = scatter3d(rows, {
    x: (d) => d.a,
    y: (d) => d.b,
    z: (d) => d.c,
    color: (d) => d.kind,
  });

  it('places each finite row in the space, keeping which row each point is', () => {
    expect(scatter.positions).toHaveLength(3);
    expect(scatter.rows).toEqual([0, 1, 3]);
    expect(scatter.positions[0]).toEqual(scatter.space.place(1, 2, 3));
  });

  it('colours by category in palette order, with a legend', () => {
    expect(scatter.colors).toEqual([
      rgbOf(tableau10[0]!),
      rgbOf(tableau10[1]!),
      rgbOf(tableau10[0]!),
    ]);
    expect(scatter.legend).toEqual([
      { label: 'p', color: rgbOf(tableau10[0]!) },
      { label: 'q', color: rgbOf(tableau10[1]!) },
    ]);
  });
});

describe('surface3d', () => {
  const xs = [0, 1, 2];
  const ys = [0, 1];
  const z = [
    [0, 1, 2],
    [3, 4, 5],
  ];
  const surface = surface3d({ xs, ys, z });

  it('draws the surface as a wireframe of segments along both directions', () => {
    // Rows: 2 rows of 2 segments; columns: 3 columns of 1 segment; two points each.
    expect(surface.points).toHaveLength((2 * 2 + 3 * 1) * 2);
    expect(surface.points[0]).toEqual(surface.space.place(0, 0, 0));
    expect(surface.points[1]).toEqual(surface.space.place(1, 0, 1));
  });

  it('colours each vertex by height, from the low end of the scheme to the high', () => {
    expect(surface.colors).toHaveLength(surface.points.length);
    expect(surface.colors[0]).toBe(rgbOf(viridis[0]!));
    const top = surface.points.findIndex((p) => p[1] === surface.space.place(2, 1, 5)[1]);
    expect(surface.colors[top]).toBe(rgbOf(viridis.at(-1)!));
    expect(surface.range).toEqual([0, 5]);
  });

  it('refuses a ragged grid', () => {
    expect(() =>
      surface3d({
        xs,
        ys,
        z: [
          [0, 1, 2],
          [3, 4],
        ],
      }),
    ).toThrow('surface3d: z row 1 has 2 values for 3 xs');
  });
});

describe('rgbOf', () => {
  it('reads hex and rgb() colours as 0xRRGGBB', () => {
    expect(rgbOf('#4e79a7')).toBe(0x4e79a7);
    expect(rgbOf('#fff')).toBe(0xffffff);
    expect(rgbOf('rgb(1, 2, 3)')).toBe(0x010203);
  });
});
