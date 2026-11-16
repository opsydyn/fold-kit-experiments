/**
 * Two-dimensional binning for density views of large scatters.
 *
 * `rectBins` counts data into a grid in data units, for 2D histograms drawn
 * through a Cartesian layout. `hexbin` groups already-projected points into
 * hexagons in pixel space, after d3-hexbin
 * (https://github.com/d3/d3-hexbin/blob/main/src/hexbin.js). Non-finite
 * values are skipped.
 */

export type Bin2dAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  y: (datum: T, index: number) => number;
}>;

export type RectBinsConfig = Readonly<{
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xCount: number;
  yCount: number;
}>;

export type RectBin<T> = Readonly<{
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  count: number;
  values: ReadonlyArray<T>;
}>;

const ascending = (domain: readonly [number, number], name: string): readonly [number, number] => {
  if (!domain.every(Number.isFinite) || !(domain[0] < domain[1]))
    throw new RangeError(`2D bin ${name} domain must be finite and increasing`);
  return domain;
};
const binCount = (count: number, name: string): number => {
  if (!Number.isInteger(count) || count < 1)
    throw new RangeError(`2D bin ${name} count must be a positive integer`);
  return count;
};

/**
 * Counts data into an xCount by yCount grid over the domains. Cells are
 * half-open, [x0, x1), except the last on each axis, which also takes the
 * domain maximum. Values outside the domains are left out. Every cell is
 * returned, column by column, so an empty cell can still be drawn.
 */
export function rectBins<T>(
  data: ReadonlyArray<T>,
  accessors: Bin2dAccessors<T>,
  config: RectBinsConfig,
): ReadonlyArray<RectBin<T>> {
  const [x0, x1] = ascending(config.xDomain, 'x');
  const [y0, y1] = ascending(config.yDomain, 'y');
  const nx = binCount(config.xCount, 'x'),
    ny = binCount(config.yCount, 'y');
  const cells: T[][] = Array.from({ length: nx * ny }, () => []);
  const index = rectBinIndex;
  data.forEach((datum, i) => {
    const x = accessors.x(datum, i),
      y = accessors.y(datum, i);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < x0 || x > x1 || y < y0 || y > y1) return;
    cells[index(x, x0, x1, nx) * ny + index(y, y0, y1, ny)]?.push(datum);
  });
  const edges = rectBinEdges(config);
  return cells.map((values, cell) => ({
    ...edges(Math.floor(cell / ny), cell % ny),
    count: values.length,
    values,
  }));
}

/**
 * The column (or row) of a grid of `n` equal bins over [lo, hi] holding a
 * value, the top bin closed: as rectBins places points, for another engine
 * (a SQL query, say) to place them the same way.
 */
export const rectBinIndex = (value: number, lo: number, hi: number, n: number): number =>
  value === hi ? n - 1 : Math.floor(((value - lo) / (hi - lo)) * n);

/** The edges of cell (i, j) in rectBins' grid. */
export function rectBinEdges(
  config: RectBinsConfig,
): (i: number, j: number) => Readonly<{ x0: number; x1: number; y0: number; y1: number }> {
  const [x0, x1] = ascending(config.xDomain, 'x');
  const [y0, y1] = ascending(config.yDomain, 'y');
  const nx = binCount(config.xCount, 'x'),
    ny = binCount(config.yCount, 'y');
  const wx = (x1 - x0) / nx,
    wy = (y1 - y0) / ny;
  return (i, j) => ({
    x0: x0 + i * wx,
    x1: i === nx - 1 ? x1 : x0 + (i + 1) * wx,
    y0: y0 + j * wy,
    y1: j === ny - 1 ? y1 : y0 + (j + 1) * wy,
  });
}

export type HexBin<T> = Readonly<{
  /** Centre of the hexagon. */
  x: number;
  y: number;
  count: number;
  values: ReadonlyArray<T>;
}>;

const positiveRadius = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= 0)
    throw new RangeError('Hexagon radius must be finite and positive');
  return radius;
};

/** Groups points into pointy-topped hexagons of the given radius, in first-seen order. */
export function hexbin<T>(
  points: ReadonlyArray<T>,
  accessors: Bin2dAccessors<T>,
  options: Readonly<{ radius: number }>,
): ReadonlyArray<HexBin<T>> {
  const radius = positiveRadius(options.radius);
  const dx = radius * 2 * Math.sin(Math.PI / 3);
  const dy = radius * 1.5;
  const bins = new Map<string, { x: number; y: number; values: T[] }>();
  points.forEach((point, index) => {
    const x = accessors.x(point, index),
      y = accessors.y(point, index);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const py = y / dy;
    let pj = Math.round(py);
    const px = x / dx - (pj & 1) / 2;
    let pi = Math.round(px);
    const py1 = py - pj;
    if (Math.abs(py1) * 3 > 1) {
      // Near a row boundary: choose between this row's hexagon and the nearer row's.
      const px1 = px - pi;
      const pi2 = pi + (px < pi ? -1 : 1) / 2;
      const pj2 = pj + (py < pj ? -1 : 1);
      const px2 = px - pi2;
      const py2 = py - pj2;
      if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
        pi = pi2 + (pj & 1 ? 1 : -1) / 2;
        pj = pj2;
      }
    }
    const id = `${pi}:${pj}`;
    const bin = bins.get(id);
    if (bin) bin.values.push(point);
    else bins.set(id, { x: (pi + (pj & 1) / 2) * dx, y: pj * dy, values: [point] });
  });
  return [...bins.values()].map(({ x, y, values }) => ({ x, y, count: values.length, values }));
}

const round = (value: number): number => {
  const rounded = Math.round(value * 1e9) / 1e9;
  return rounded === 0 ? 0 : rounded;
};

/** A closed hexagon path relative to its centre: translate it to each bin. */
export function hexagonPath(radius: number): string {
  positiveRadius(radius);
  let x0 = 0,
    y0 = 0;
  const steps = Array.from({ length: 6 }, (_, k) => {
    const angle = (k * Math.PI) / 3;
    const x1 = Math.sin(angle) * radius,
      y1 = -Math.cos(angle) * radius;
    const step = `${round(x1 - x0)},${round(y1 - y0)}`;
    x0 = x1;
    y0 = y1;
    return step;
  });
  return `m${steps.join('l')}z`;
}
