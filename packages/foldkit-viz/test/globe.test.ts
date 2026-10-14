import { describe, expect, it } from 'bun:test';

import { geoOrthographic } from '../src/shape/geo';
import { clipGlobeLine, projectGlobePoint, type GlobeView } from '../src/shape/globe';

const view: GlobeView = { center: [0, 0], radius: 100, translate: [200, 200] };

describe('orthographic globe', () => {
  it.each([
    [[0, 0], 200, 200, true],
    [[30, 0], 250, 200, true],
    [[0, 30], 200, 150, true],
    [[180, 0], 200, 200, false],
    [[0, 90], 200, 100, true],
    [[0, -90], 200, 300, true],
  ] as const)('projects %p with independent facing', (coordinate, x, y, visible) => {
    const point = projectGlobePoint(coordinate, view);
    expect(point.x).toBeCloseTo(x, 8);
    expect(point.y).toBeCloseTo(y, 8);
    expect(point.visible).toBe(visible);
  });

  it('hides the opposite hemisphere that the existing raw projection overlays', () => {
    const raw = geoOrthographic().withScale(100).withTranslate([200, 200]);
    expect(raw(180, 0)[0]).toBeCloseTo(raw(0, 0)[0], 8);
    expect(projectGlobePoint([180, 0], view).facing).toBeCloseTo(-1, 8);
    expect(projectGlobePoint([180, 0], view).visible).toBe(false);
  });

  it.each([
    [90, 30],
    [-179, 45],
    [0, 90],
    [0, -90],
  ] as const)(
    'centres a spherical pose %p without subtracting latitudes',
    (longitude, latitude) => {
      const center = [longitude, latitude] as const;
      const point = projectGlobePoint(center, { ...view, center });
      expect(point.x).toBeCloseTo(200, 8);
      expect(point.y).toBeCloseTo(200, 8);
      expect(point.facing).toBeCloseTo(1, 8);
    },
  );

  it('handles the dateline and periodic longitude without mutating inputs', () => {
    const point = Object.freeze([181, 0] as const);
    const pose = Object.freeze({ ...view, center: Object.freeze([-179, 0] as const) });
    expect(projectGlobePoint(point, pose).x).toBeCloseTo(200, 8);
    expect(point).toEqual([181, 0]);
  });

  it('distinguishes exact, front and rear horizon points consistently', () => {
    expect(projectGlobePoint([90, 0], view).visible).toBe(true);
    expect(projectGlobePoint([89.999, 0], view).visible).toBe(true);
    expect(projectGlobePoint([90.001, 0], view).visible).toBe(false);
  });

  it('round trips a tilted pose through an independent geographic basis', () => {
    // Centre [90,30]: east [-1,0,0], north [0,-1/2,sqrt(3)/2], front [0,sqrt(3)/2,1/2].
    const p = projectGlobePoint([0, 0], { ...view, center: [90, 30] });
    const east = (p.x - 200) / 100;
    const north = -(p.y - 200) / 100;
    expect(-east).toBeCloseTo(1, 8);
    expect(-north / 2 + (p.facing * Math.sqrt(3)) / 2).toBeCloseTo(0, 8);
    expect((north * Math.sqrt(3)) / 2 + p.facing / 2).toBeCloseTo(0, 8);
  });

  it('rejects invalid configuration and overflowing screen coordinates', () => {
    for (const bad of [
      { ...view, radius: 0 },
      { ...view, radius: Infinity },
      { ...view, center: [0, 91] as const },
      { ...view, translate: [NaN, 0] as const },
    ])
      expect(() => projectGlobePoint([0, 0], bad)).toThrow(RangeError);
    expect(() => projectGlobePoint([0, NaN], view)).toThrow(RangeError);
    expect(() =>
      projectGlobePoint([90, 0], {
        ...view,
        radius: Number.MAX_VALUE,
        translate: [Number.MAX_VALUE, 0],
      }),
    ).toThrow(RangeError);
  });
});

describe('open spherical line clipping', () => {
  it('inserts an analytic equatorial horizon intersection', () => {
    const segments = clipGlobeLine(
      [
        [80, 0],
        [100, 0],
      ],
      view,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(2);
    expect(segments[0]?.[0]?.[0]).toBeCloseTo(298.4807753, 6);
    expect(segments[0]?.[1]?.[0]).toBeCloseTo(300, 8);
    expect(segments[0]?.[1]?.[1]).toBeCloseTo(200, 8);
  });
  it('splits a dateline-side invisible run instead of drawing a chord', () => {
    const result = clipGlobeLine(
      [
        [80, 0],
        [120, 0],
        [-120, 0],
        [-80, 0],
      ],
      view,
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.at(-1)?.[0]).toBeCloseTo(300, 8);
    expect(result[1]?.[0]?.[0]).toBeCloseTo(100, 8);
  });
  it('retains horizon lines and ignores duplicates without mutating frozen inputs', () => {
    const line = Object.freeze([
      Object.freeze([90, 0] as const),
      Object.freeze([90, 0] as const),
      Object.freeze([90, 30] as const),
    ]);
    const segments = clipGlobeLine(line, view);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(2);
    expect(segments[0]?.[1]?.[1]).toBeCloseTo(150, 8);
    expect(line).toHaveLength(3);
  });
  it('has no drawable runs for hidden or degenerate input', () => {
    expect(
      clipGlobeLine(
        [
          [150, 0],
          [170, 0],
        ],
        view,
      ),
    ).toEqual([]);
    expect(clipGlobeLine([], view)).toEqual([]);
    expect(clipGlobeLine([[0, 0]], view)).toEqual([]);
    expect(
      clipGlobeLine(
        [
          [0, 0],
          [0, 0],
        ],
        view,
      ),
    ).toEqual([]);
  });
  it('rejects ambiguous antipodal arcs and malformed vertices', () => {
    expect(() =>
      clipGlobeLine(
        [
          [0, 0],
          [180, 0],
        ],
        view,
      ),
    ).toThrow(RangeError);
    expect(() =>
      clipGlobeLine(
        [
          [0, 0],
          [1, Infinity],
        ],
        view,
      ),
    ).toThrow(RangeError);
  });
});
