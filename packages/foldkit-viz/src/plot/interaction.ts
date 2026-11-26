import { fail, highlightMatcher, isNumber } from './channels.js';
import { isColumnTable } from './columns.js';
import type {
  FacetGeometry,
  Graphic,
  Highlight,
  PlotAxis,
  PlotData,
  PlotGeometry,
  Value,
} from './types.js';

/**
 * Pure helpers for interaction with compiled plots. They install no listeners
 * and hold no state: the parent turns pointer events into plot pixels, asks
 * these what lies there, and keeps the answer in its Model.
 */

// ── Pointer to plot pixels ────────────────────────────────────────────────────

export type ClientPoint = Readonly<{ x: number; y: number }>;
/** The rendered element's bounding rectangle, as getBoundingClientRect gives it. */
export type ClientRect = Readonly<{ left: number; top: number; width: number; height: number }>;

/** A pointer's client position as plot pixels, through the element's rendered size. */
export function pointerToPlot(
  client: ClientPoint,
  rect: ClientRect,
  geometry: Pick<PlotGeometry, 'width' | 'height'>,
): ClientPoint {
  const sx = rect.width > 0 ? geometry.width / rect.width : 1;
  const sy = rect.height > 0 ? geometry.height / rect.height : 1;
  return { x: (client.x - rect.left) * sx, y: (client.y - rect.top) * sy };
}

// ── Pixels to data ────────────────────────────────────────────────────────────

const symlog = (v: number, c: number) => Math.sign(v) * Math.log1p(Math.abs(v / c));
const unsymlog = (u: number, c: number) => Math.sign(u) * c * Math.expm1(Math.abs(u));
const power = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

/** The data value at a pixel on an axis, or undefined off a band. */
export function invertAxis(axis: PlotAxis, pixel: number): number | string | undefined {
  const [r0, r1] = axis.range;
  if (axis.type === 'band') {
    // The nearest band centre, if the pixel is within half a step of it.
    const step =
      axis.ticks.length > 1
        ? Math.abs((axis.ticks[1]?.position ?? 0) - (axis.ticks[0]?.position ?? 0))
        : Math.abs(r1 - r0);
    let best: string | undefined;
    let distance = step / 2;
    for (const tick of axis.ticks) {
      const d = Math.abs(tick.position - pixel);
      if (d <= distance) {
        distance = d;
        best = String(tick.value);
      }
    }
    return best;
  }
  const [d0, d1] = axis.domain.map(Number);
  if (d0 === undefined || d1 === undefined || r1 === r0) return undefined;
  const t = (pixel - r0) / (r1 - r0);
  switch (axis.type) {
    case 'log':
      return d0 * (d1 / d0) ** t;
    case 'symlog': {
      const c = axis.constant ?? 1;
      return unsymlog(symlog(d0, c) + t * (symlog(d1, c) - symlog(d0, c)), c);
    }
    case 'pow': {
      const e = axis.exponent ?? 1;
      return power(power(d0, e) + t * (power(d1, e) - power(d0, e)), 1 / e);
    }
    default:
      return d0 + t * (d1 - d0);
  }
}

export type PlotLocation = Readonly<{
  facet: FacetGeometry;
  /** Data value under the pixel on each axis: a number on continuous axes, a band's name on band axes. */
  x: number | string | undefined;
  y: number | string | undefined;
}>;

/** The facet under a plot pixel, and the data coordinates there; undefined outside every plot area. */
export function invertPlot(geometry: PlotGeometry, x: number, y: number): PlotLocation | undefined {
  const facet = geometry.facets.find(
    (f) => x >= f.plot.left && x <= f.plot.right && y >= f.plot.top && y <= f.plot.bottom,
  );
  if (facet === undefined) return undefined;
  return {
    facet,
    x: facet.x === null ? undefined : invertAxis(facet.x, x),
    y: facet.y === null ? undefined : invertAxis(facet.y, y),
  };
}

// ── Nearest mark ──────────────────────────────────────────────────────────────

export type PlotHit = Readonly<{
  facet: string;
  /** The mark's index in the spec. */
  mark: number;
  /** The graphic's key; for dense marks, the packed graphic's key. */
  key: string;
  /** For dense marks, the row of the mark's data under the pointer. */
  row: number | undefined;
  x: number;
  y: number;
  distance: number;
}>;

export type PlotIndex = Readonly<{
  /** Points indexed. */
  size: number;
  /** The closest mark within `radius` plot pixels (default 24), if any. */
  nearest: (x: number, y: number, radius?: number) => PlotHit | undefined;
}>;

type Owner = Readonly<{ facet: string; mark: number; key: string; dense: boolean }>;

const CELL = 16;

/**
 * Indexes every dot, packed point and rectangle centre on a uniform grid of
 * 16-pixel cells, in linear time and typed arrays, so a million points index
 * in a fraction of a second and a query reads only nearby cells.
 */
/** A dot drawn as a symbol: a path translated to its point. */
const isSymbolPath = (g: Graphic): boolean => g.kind === 'path' && g.translate !== undefined;

const centreOf = (g: Graphic): readonly [number, number] => {
  switch (g.kind) {
    case 'circle':
      return [g.cx, g.cy];
    case 'rect':
      return [g.x + g.width / 2, g.y + g.height / 2];
    case 'path':
      return g.translate ?? [0, 0];
    default:
      return [0, 0];
  }
};

const containsCentre = (facet: FacetGeometry, x: number, y: number): boolean =>
  x >= facet.plot.left && x <= facet.plot.right && y >= facet.plot.top && y <= facet.plot.bottom;

export type PlotTarget = Readonly<{
  facet: string;
  mark: number;
  graphic: number;
  key: string;
  title: string;
  cx: number;
  cy: number;
  left: number;
  right: number;
  domain: readonly [number, number];
  /** Numeric y value for a point or the upper edge of a rectangle. */
  value: number | undefined;
  includeEnd: boolean;
  isBar: boolean;
}>;

/** Keyboard and pointer targets for ordinary dots and rectangles with numeric x coordinates. */
export function plotTargets(
  geometry: PlotGeometry,
  options: Readonly<{
    mark: number;
    facet?: string;
    inset?: number;
    finalIntervalClosed?: boolean;
  }>,
): ReadonlyArray<PlotTarget> {
  const facet =
    options.facet === undefined
      ? geometry.facets[0]
      : geometry.facets.find((candidate) => candidate.key === options.facet);
  if (facet === undefined || facet.x === null || facet.x.type === 'band') return [];
  const xAxis = facet.x;
  const mark = facet.marks.find((candidate) => candidate.index === options.mark);
  const inset = options.inset ?? 0;
  const numericAt = (axis: PlotAxis | null, pixel: number): number | undefined => {
    const value = axis === null ? undefined : invertAxis(axis, pixel);
    // Avoid exposing inversion noise on a bin boundary or a displayed value.
    return isNumber(value) && Number.isFinite(value) ? Number(value.toPrecision(15)) : undefined;
  };
  const targets = (mark?.graphics ?? []).flatMap((g, graphic): ReadonlyArray<PlotTarget> => {
    const isBar = g.kind === 'rect';
    if (!isBar && g.kind !== 'circle' && !(mark?.mark === 'dot' && isSymbolPath(g))) return [];
    const [cx, cy] = centreOf(g);
    if (geometry.clip && !containsCentre(facet, cx, cy)) return [];
    const left = isBar ? g.x - inset : cx;
    const right = isBar ? g.x + g.width + inset : cx;
    const bin = isBar ? g.bin : undefined;
    const start = bin?.x[0] ?? numericAt(xAxis, left);
    const end = bin?.x[1] ?? numericAt(xAxis, right);
    if (start === undefined || end === undefined) return [];
    return [
      {
        facet: facet.key,
        mark: options.mark,
        graphic,
        key: g.key,
        title: g.title ?? g.key,
        cx,
        cy,
        left,
        right,
        domain: [Math.min(start, end), Math.max(start, end)],
        value:
          bin !== undefined && bin.y === undefined
            ? bin.value
            : numericAt(facet.y, isBar ? g.y : cy),
        includeEnd: !isBar,
        isBar,
      },
    ];
  });
  const lastEdge = options.finalIntervalClosed
    ? targets.reduce(
        (end, target) => (target.isBar ? Math.max(end, target.domain[1]) : end),
        -Infinity,
      )
    : -Infinity;
  return targets
    .map((target) =>
      target.isBar && target.domain[1] === lastEdge ? { ...target, includeEnd: true } : target,
    )
    .sort((a, b) => a.cx - b.cx);
}

export function indexPlot(geometry: PlotGeometry): PlotIndex {
  const owners: Owner[] = [];
  let total = 0;
  for (const facet of geometry.facets)
    for (const mark of facet.marks)
      for (const g of mark.graphics)
        if (g.kind === 'points') total += g.count;
        else if (
          g.kind === 'circle' ||
          g.kind === 'rect' ||
          (mark.mark === 'dot' && isSymbolPath(g))
        )
          total += 1;
  const xs = new Float64Array(total),
    ys = new Float64Array(total),
    owner = new Uint32Array(total),
    row = new Int32Array(total);
  let n = 0;
  for (const facet of geometry.facets)
    for (const mark of facet.marks)
      for (const g of mark.graphics) {
        if (g.kind === 'points') {
          const id =
            owners.push({ facet: facet.key, mark: mark.index, key: g.key, dense: true }) - 1;
          for (let i = 0; i < g.count; i += 1) {
            const px = g.xs[i] ?? 0,
              py = g.ys[i] ?? 0;
            if (geometry.clip && !containsCentre(facet, px, py)) continue;
            xs[n] = g.xs[i] ?? 0;
            ys[n] = g.ys[i] ?? 0;
            owner[n] = id;
            row[n] = g.rows[i] ?? -1;
            n += 1;
          }
        } else if (
          g.kind === 'circle' ||
          g.kind === 'rect' ||
          (mark.mark === 'dot' && isSymbolPath(g))
        ) {
          const id =
            owners.push({ facet: facet.key, mark: mark.index, key: g.key, dense: false }) - 1;
          const [cx, cy] = centreOf(g);
          if (geometry.clip && !containsCentre(facet, cx, cy)) continue;
          xs[n] = cx;
          ys[n] = cy;
          owner[n] = id;
          row[n] = -1;
          n += 1;
        }
      }
  // Counting sort by cell: cellStart[c]..cellStart[c + 1] lists cell c's points.
  const columns = Math.max(1, Math.ceil(geometry.width / CELL) + 1);
  const rows = Math.max(1, Math.ceil(geometry.height / CELL) + 1);
  const columnOf = (x: number) => Math.min(columns - 1, Math.max(0, Math.floor(x / CELL)));
  const rowOf = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor(y / CELL)));
  const cellOf = (x: number, y: number) => rowOf(y) * columns + columnOf(x);
  const cells = new Uint32Array(n);
  const cellStart = new Uint32Array(columns * rows + 1);
  for (let i = 0; i < n; i += 1) {
    const c = cellOf(xs[i] ?? 0, ys[i] ?? 0);
    cells[i] = c;
    cellStart[c + 1] = (cellStart[c + 1] ?? 0) + 1;
  }
  for (let c = 0; c < columns * rows; c += 1)
    cellStart[c + 1] = (cellStart[c + 1] ?? 0) + (cellStart[c] ?? 0);
  const order = new Uint32Array(n);
  const fill = cellStart.slice(0, columns * rows);
  for (let i = 0; i < n; i += 1) {
    const c = cells[i] ?? 0;
    order[fill[c] ?? 0] = i;
    fill[c] = (fill[c] ?? 0) + 1;
  }

  const nearest = (x: number, y: number, radius = 24): PlotHit | undefined => {
    let best = -1;
    let bestDistance = radius * radius;
    const c0 = columnOf(x - radius),
      c1 = columnOf(x + radius);
    const r0 = rowOf(y - radius),
      r1 = rowOf(y + radius);
    for (let r = r0; r <= r1; r += 1)
      for (let c = c0; c <= c1; c += 1) {
        const cell = r * columns + c;
        for (let k = cellStart[cell] ?? 0; k < (cellStart[cell + 1] ?? 0); k += 1) {
          const i = order[k] ?? 0;
          const dx = (xs[i] ?? 0) - x,
            dy = (ys[i] ?? 0) - y;
          const d = dx * dx + dy * dy;
          if (d <= bestDistance) {
            bestDistance = d;
            best = i;
          }
        }
      }
    if (best < 0) return undefined;
    const o = owners[owner[best] ?? 0];
    if (o === undefined) return undefined;
    return {
      facet: o.facet,
      mark: o.mark,
      key: o.key,
      row: o.dense ? row[best] : undefined,
      x: xs[best] ?? 0,
      y: ys[best] ?? 0,
      distance: Math.sqrt(bestDistance),
    };
  };
  return { size: n, nearest };
}

// ── Restyling without recompiling ─────────────────────────────────────────────

/**
 * Restyles a dense dot mark for a new highlight without recompiling: the
 * geometry comes back with that mark's dimmed flags recomputed from `data`,
 * the rows it was compiled from. Positions, palette and row indices are
 * shared with the input, so a PlotIndex built from it stays valid, and every
 * other mark is returned as it was. Recompile to restyle any other mark.
 */
export function highlightPoints(
  geometry: PlotGeometry,
  markIndex: number,
  data: PlotData,
  highlight: Highlight | undefined,
): PlotGeometry {
  const path = `marks[${markIndex}]`;
  const field = highlight?.field ?? '';
  const missing = isColumnTable(data)
    ? data.length > 0 && data.columns[field] === undefined
    : data.length > 0 && !data.some((row) => Object.hasOwn(row, field));
  if (highlight !== undefined && missing)
    fail(`${path}.highlight.field`, `field "${highlight.field}" is missing from the data`);
  // Match only the packed points' own rows: no data-sized arrays or row objects are built.
  const matches = highlight === undefined ? undefined : highlightMatcher(highlight);
  const column = isColumnTable(data) ? data.columns[field] : undefined;
  const valueAt = (row: number): Value =>
    isColumnTable(data) ? (column?.[row] ?? null) : (data[row]?.[field] ?? null);
  let restyled = 0;
  const restyle = (g: Graphic): Graphic => {
    if (g.kind !== 'points') return g;
    restyled += 1;
    if (matches === undefined) {
      const { dimmed, ...plain } = g;
      return dimmed === undefined ? g : plain;
    }
    const dimmed = new Uint8Array(g.count);
    for (let i = 0; i < g.count; i += 1) dimmed[i] = matches(valueAt(g.rows[i] ?? 0)) ? 0 : 1;
    return { ...g, dimmed };
  };
  const facets = geometry.facets.map((facet) => ({
    ...facet,
    marks: facet.marks.map((mark) =>
      mark.index === markIndex ? { ...mark, graphics: mark.graphics.map(restyle) } : mark,
    ),
  }));
  if (restyled === 0) fail(path, 'highlightPoints restyles dense dot marks only');
  return { ...geometry, facets };
}
