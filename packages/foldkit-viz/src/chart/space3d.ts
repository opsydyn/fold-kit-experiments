import { linear, linearTicks, niceLinear } from '../math/scale.js';
import { tableau10, viridis } from '../math/schemes.js';
import { readable } from '../plot/describe.js';

/**
 * Three-dimensional chart geometry: a cube of space with boxed, ticked axes,
 * and the points of a scatter or the wireframe of a surface placed in it.
 * Framework-free and renderer-free: positions are plain triples in scene
 * units, colours 0xRRGGBB numbers, ready for a 3D renderer such as
 * effect-three (see effect-three/space3d).
 *
 * Data x runs across (scene X), data z up (scene Y), and data y into the scene
 * (scene -Z), so a surface z = f(x, y) stands on the floor.
 */

export type Vec3 = readonly [number, number, number];
export type Segment3 = readonly [Vec3, Vec3];
export type Domain3 = readonly [number, number];
export type AxisName3 = 'x' | 'y' | 'z';

export type Space3dOptions = Readonly<{
  /** Half the cube's side, in scene units. Default 1. */
  half?: number;
  /** About how many ticks an axis gets. Default 5. */
  ticks?: number;
  /** Axis titles. Default the axis names. */
  labels?: Partial<Record<AxisName3, string>>;
}>;

export type Space3dTick = Readonly<{ value: number; label: string; position: Vec3 }>;

export type Space3dAxis = Readonly<{
  name: AxisName3;
  label: string;
  /** Where the title goes: beyond the middle of the ticked edge, or above the vertical one. */
  labelPosition: Vec3;
  ticks: ReadonlyArray<Space3dTick>;
}>;

export type Space3d = Readonly<{
  half: number;
  /** The nice domains the cube spans. */
  domains: Readonly<Record<AxisName3, Domain3>>;
  /** A data point's position in the scene. */
  place: (x: number, y: number, z: number) => Vec3;
  box: ReadonlyArray<Segment3>;
  /** Lines at the ticks across the floor and the two back walls. */
  grid: ReadonlyArray<Segment3>;
  axes: readonly [Space3dAxis, Space3dAxis, Space3dAxis];
}>;

const fail = (message: string): never => {
  throw new RangeError(message);
};

export function space3d(
  domains: Readonly<Record<AxisName3, Domain3>>,
  options: Space3dOptions = {},
): Space3d {
  const h = options.half ?? 1;
  const count = options.ticks ?? 5;
  const nice = (name: AxisName3): Domain3 => {
    const [lo, hi] = domains[name];
    if (!Number.isFinite(lo) || !Number.isFinite(hi))
      fail(`space3d: ${name} domain must be finite`);
    return lo === hi ? [lo - 0.5, hi + 0.5] : niceLinear([lo, hi], count);
  };
  const dx = nice('x'),
    dy = nice('y'),
    dz = nice('z');
  const sx = linear({ domain: dx, range: [-h, h] });
  // Larger y sits further into the scene, away from a camera on +Z.
  const sy = linear({ domain: dy, range: [h, -h] });
  const sz = linear({ domain: dz, range: [-h, h] });
  const place = (x: number, y: number, z: number): Vec3 => [sx(x), sz(z), sy(y)];

  const corners = [-h, h];
  const box: Segment3[] = [];
  for (const a of corners)
    for (const b of corners) {
      box.push([
        [-h, a, b],
        [h, a, b],
      ]);
      box.push([
        [a, -h, b],
        [a, h, b],
      ]);
      box.push([
        [a, b, -h],
        [a, b, h],
      ]);
    }

  const pad = h * 0.12;
  const ticksOf = (domain: Domain3) => linearTicks(domain, count);
  const xTicks = ticksOf(dx),
    yTicks = ticksOf(dy),
    zTicks = ticksOf(dz);
  const grid: Segment3[] = [
    // Floor: lines at x and y ticks.
    ...xTicks.map(
      (t): Segment3 => [
        [sx(t), -h, h],
        [sx(t), -h, -h],
      ],
    ),
    ...yTicks.map(
      (t): Segment3 => [
        [-h, -h, sy(t)],
        [h, -h, sy(t)],
      ],
    ),
    // Back wall: lines at x and z ticks.
    ...xTicks.map(
      (t): Segment3 => [
        [sx(t), -h, -h],
        [sx(t), h, -h],
      ],
    ),
    ...zTicks.map(
      (t): Segment3 => [
        [-h, sz(t), -h],
        [h, sz(t), -h],
      ],
    ),
    // Left wall: lines at y and z ticks.
    ...yTicks.map(
      (t): Segment3 => [
        [-h, -h, sy(t)],
        [-h, h, sy(t)],
      ],
    ),
    ...zTicks.map(
      (t): Segment3 => [
        [-h, sz(t), h],
        [-h, sz(t), -h],
      ],
    ),
  ];

  const titles = { x: 'x', y: 'y', z: 'z', ...options.labels };
  const axes: readonly [Space3dAxis, Space3dAxis, Space3dAxis] = [
    {
      name: 'x',
      label: titles.x,
      labelPosition: [0, -h - pad * 3, h + pad * 3],
      ticks: xTicks.map((t) => ({
        value: t,
        label: readable(t),
        position: [sx(t), -h - pad, h + pad],
      })),
    },
    {
      name: 'y',
      label: titles.y,
      labelPosition: [h + pad * 3, -h - pad * 3, 0],
      ticks: yTicks.map((t) => ({
        value: t,
        label: readable(t),
        position: [h + pad, -h - pad, sy(t)],
      })),
    },
    {
      name: 'z',
      label: titles.z,
      // Above the vertical axis, clear of its tick labels.
      labelPosition: [-h - pad, h + pad * 2.5, h + pad],
      ticks: zTicks.map((t) => ({
        value: t,
        label: readable(t),
        position: [-h - pad, sz(t), h + pad],
      })),
    },
  ];
  return { half: h, domains: { x: dx, y: dy, z: dz }, place, box, grid, axes };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i;

/** A hex or rgb() colour as a 0xRRGGBB number, as 3D renderers take colours. */
export function rgbOf(colour: string): number {
  const hex = HEX.exec(colour)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return Number.parseInt(full, 16);
  }
  const rgb = RGB.exec(colour);
  if (rgb !== null) return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3]);
  return fail(`space3d reads hex and rgb() colours, not "${colour}"`);
}

/** The finite extent of values, or [0, 1] when there are none. */
const extentOf = (values: ReadonlyArray<number>): Domain3 => {
  let lo = Number.POSITIVE_INFINITY,
    hi = Number.NEGATIVE_INFINITY;
  for (const v of values)
    if (Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  return lo <= hi ? [lo, hi] : [0, 1];
};

export type Scatter3dAccessors<D> = Readonly<{
  x: (d: D) => number;
  y: (d: D) => number;
  z: (d: D) => number;
  /** A category to colour by. Default one colour. */
  color?: (d: D) => string;
}>;

export type Scatter3d = Readonly<{
  space: Space3d;
  positions: ReadonlyArray<Vec3>;
  colors: ReadonlyArray<number>;
  /** Each point's index in the data; rows with a non-finite value are left out. */
  rows: ReadonlyArray<number>;
  legend: ReadonlyArray<Readonly<{ label: string; color: number }>>;
}>;

export function scatter3d<D>(
  data: ReadonlyArray<D>,
  accessors: Scatter3dAccessors<D>,
  options: Space3dOptions &
    Readonly<{
      domains?: Partial<Record<AxisName3, Domain3>>;
      palette?: ReadonlyArray<string>;
    }> = {},
): Scatter3d {
  const xs = data.map(accessors.x),
    ys = data.map(accessors.y),
    zs = data.map(accessors.z);
  const space = space3d(
    {
      x: options.domains?.x ?? extentOf(xs),
      y: options.domains?.y ?? extentOf(ys),
      z: options.domains?.z ?? extentOf(zs),
    },
    options,
  );
  const palette = (options.palette ?? tableau10).map(rgbOf);
  const categories: string[] = [];
  const colourOf = (d: D): number => {
    if (accessors.color === undefined) return palette[0] ?? 0;
    const category = accessors.color(d);
    let at = categories.indexOf(category);
    if (at < 0) at = categories.push(category) - 1;
    return palette[at % palette.length] ?? 0;
  };
  const positions: Vec3[] = [],
    colors: number[] = [],
    rows: number[] = [];
  data.forEach((d, i) => {
    const x = xs[i] ?? Number.NaN,
      y = ys[i] ?? Number.NaN,
      z = zs[i] ?? Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    positions.push(space.place(x, y, z));
    colors.push(colourOf(d));
    rows.push(i);
  });
  const legend = categories.map((label, i) => ({ label, color: palette[i % palette.length] ?? 0 }));
  return { space, positions, colors, rows, legend };
}

/** A colour `t` of the way along evenly spaced stops, blended in RGB; the ends exact. */
function along(stops: ReadonlyArray<number>, t: number): number {
  if (stops.length === 1) return stops[0] ?? 0;
  const at = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(at));
  const a = stops[i] ?? 0,
    b = stops[i + 1] ?? 0;
  const f = at - i;
  const mix = (shift: number) =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export type Surface3dGrid = Readonly<{
  /** The x of each column. */
  xs: ReadonlyArray<number>;
  /** The y of each row. */
  ys: ReadonlyArray<number>;
  /** Heights by row, then column: z[j][i] is at (xs[i], ys[j]). */
  z: ReadonlyArray<ReadonlyArray<number>>;
}>;

export type Surface3d = Readonly<{
  space: Space3d;
  /** Segment endpoints in pairs: the wireframe along rows, then along columns. */
  points: ReadonlyArray<Vec3>;
  /** A colour for each point, by height. */
  colors: ReadonlyArray<number>;
  /** The heights' extent, which the colours span. */
  range: Domain3;
}>;

/**
 * A surface z = f(x, y) over a grid, as a wireframe coloured by height: lines
 * along each row and each column. A filled mesh needs triangle geometry a 3D
 * renderer takes as such; this stays plain segments any renderer draws.
 */
export function surface3d(
  grid: Surface3dGrid,
  options: Space3dOptions & Readonly<{ scheme?: ReadonlyArray<string> }> = {},
): Surface3d {
  const { xs, ys, z } = grid;
  if (z.length !== ys.length) fail(`surface3d: ${z.length} rows of z for ${ys.length} ys`);
  z.forEach((row, j) => {
    if (row.length !== xs.length)
      fail(`surface3d: z row ${j} has ${row.length} values for ${xs.length} xs`);
  });
  const range = extentOf(z.flat());
  const space = space3d({ x: extentOf(xs), y: extentOf(ys), z: range }, options);
  const stops = (options.scheme ?? viridis).map(rgbOf);
  const colourOf = (height: number) =>
    along(stops, range[1] === range[0] ? 0 : (height - range[0]) / (range[1] - range[0]));
  const points: Vec3[] = [],
    colors: number[] = [];
  const vertex = (i: number, j: number) => {
    const height = z[j]?.[i] ?? Number.NaN;
    points.push(space.place(xs[i] ?? 0, ys[j] ?? 0, height));
    colors.push(colourOf(height));
  };
  for (let j = 0; j < ys.length; j += 1)
    for (let i = 0; i + 1 < xs.length; i += 1) {
      vertex(i, j);
      vertex(i + 1, j);
    }
  for (let i = 0; i < xs.length; i += 1)
    for (let j = 0; j + 1 < ys.length; j += 1) {
      vertex(i, j);
      vertex(i, j + 1);
    }
  return { space, points, colors, range };
}
