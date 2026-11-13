import { describe, expect, it } from 'bun:test';

import { hexagonPath, hexbin, rectBins } from '../src/math/bin2d';

type P = Readonly<{ x: number; y: number; id?: string }>;
const xy = { x: (p: P) => p.x, y: (p: P) => p.y };

describe('rectangular 2D bins', () => {
  const data: ReadonlyArray<P> = [
    { x: 0, y: 0 },
    { x: 0.4, y: 0.4 },
    { x: 1.5, y: 0.2 },
    { x: 2, y: 2 }, // the domain maximum belongs to the last bin
    { x: 5, y: 1 }, // outside the domain
    { x: Number.NaN, y: 1 },
  ];
  const bins = rectBins(data, xy, { xDomain: [0, 2], yDomain: [0, 2], xCount: 2, yCount: 2 });

  it('returns every cell of the grid, column by column', () => {
    expect(bins.map(({ x0, x1, y0, y1 }) => [x0, x1, y0, y1])).toEqual([
      [0, 1, 0, 1],
      [0, 1, 1, 2],
      [1, 2, 0, 1],
      [1, 2, 1, 2],
    ]);
  });

  it('counts values into half-open cells, closing the last bin on the maximum', () => {
    expect(bins.map((bin) => bin.count)).toEqual([2, 0, 1, 1]);
    expect(bins[0]?.values).toEqual(data.slice(0, 2));
  });

  it.each([
    ['a zero bin count', { xCount: 0 }],
    ['an empty domain', { xDomain: [1, 1] as const }],
  ])('rejects %s', (_, extra) => {
    expect(() =>
      rectBins(data, xy, { xDomain: [0, 2], yDomain: [0, 2], xCount: 2, yCount: 2, ...extra }),
    ).toThrow(RangeError);
  });
});

describe('hexagonal bins', () => {
  const radius = 10;
  const dx = radius * 2 * Math.sin(Math.PI / 3);
  const dy = radius * 1.5;

  it('groups nearby points and centres each bin on the hexagonal lattice', () => {
    const points: ReadonlyArray<P> = [
      { x: 0, y: 0, id: 'a' },
      { x: 2, y: 1, id: 'b' },
      { x: dx, y: 0, id: 'c' },
      { x: dx / 2, y: dy, id: 'd' },
    ];
    const bins = hexbin(points, xy, { radius });
    expect(bins.map((bin) => bin.values.map((p) => p.id))).toEqual([['a', 'b'], ['c'], ['d']]);
    expect(bins[0]).toMatchObject({ x: 0, y: 0, count: 2 });
    expect(bins[1]?.x).toBeCloseTo(dx);
    expect(bins[2]?.x).toBeCloseTo(dx / 2);
    expect(bins[2]?.y).toBeCloseTo(dy);
  });

  it('assigns a point near a hexagon corner to the nearer centre', () => {
    // Just past the hexagon's lower corner (y grows downwards), inside the next row.
    const [bin] = hexbin([{ x: 0.1, y: radius * 1.1 }], xy, { radius });
    expect(bin?.y).toBeCloseTo(dy);
  });

  it('skips non-finite points and rejects a non-positive radius', () => {
    expect(hexbin([{ x: Number.NaN, y: 0 }], xy, { radius })).toEqual([]);
    expect(() => hexbin([], xy, { radius: 0 })).toThrow(RangeError);
  });

  it('draws a closed hexagon path relative to the bin centre', () => {
    const path = hexagonPath(radius);
    expect(path.startsWith('m0,-10')).toBe(true);
    expect(path.endsWith('z')).toBe(true);
    expect(path.match(/l/g)).toHaveLength(5);
  });
});
