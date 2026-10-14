/**
 * Narrow orthographic sphere port based on d3-geo rotation.js and clip/circle.js.
 * Copyright 2010-2024 Mike Bostock. Upstream ISC notice: THIRD-PARTY-NOTICES.md.
 * Points and minor-arc open lines only; no polygon clipping or resampling.
 */
import type { GeoCoord } from './geo';

export type GlobeView = Readonly<{
  center: GeoCoord;
  radius: number;
  translate: readonly [number, number];
}>;
export type GlobePoint = Readonly<{ x: number; y: number; facing: number; visible: boolean }>;
export const GLOBE_EPSILON = 1e-9;
type Vector = readonly [number, number, number];
type ScreenPoint = readonly [number, number];
const radians = Math.PI / 180;

function validateCoordinate(coordinate: GeoCoord): void {
  if (!coordinate.every(Number.isFinite) || Math.abs(coordinate[1]) > 90)
    throw new RangeError('Globe coordinates require finite longitude and latitude within [-90,90]');
}

function validateView(view: GlobeView): void {
  validateCoordinate(view.center);
  if (!Number.isFinite(view.radius) || view.radius <= 0 || !view.translate.every(Number.isFinite))
    throw new RangeError('Globe view requires a positive finite radius and finite translation');
}

// Equivalent to D3 longitude rotation followed by a centre-latitude spherical rotation.
function rotate(coordinate: GeoCoord, center: GeoCoord): Vector {
  validateCoordinate(coordinate);
  const lambda = ((coordinate[0] % 360) - (center[0] % 360)) * radians;
  const phi = coordinate[1] * radians;
  const tilt = center[1] * radians;
  const x = Math.cos(phi) * Math.cos(lambda);
  const z = Math.sin(phi);
  const facing = x * Math.cos(tilt) + z * Math.sin(tilt);
  return [
    Math.abs(facing) <= GLOBE_EPSILON ? 0 : facing,
    Math.cos(phi) * Math.sin(lambda),
    z * Math.cos(tilt) - x * Math.sin(tilt),
  ];
}

function screen(vector: Vector, view: GlobeView): ScreenPoint {
  const point: ScreenPoint = [
    view.translate[0] + view.radius * vector[1],
    view.translate[1] - view.radius * vector[2],
  ];
  if (!point.every(Number.isFinite)) throw new RangeError('Globe screen coordinates overflow');
  return point;
}

export function projectGlobePoint(coordinate: GeoCoord, view: GlobeView): GlobePoint {
  validateView(view);
  const vector = rotate(coordinate, view.center);
  const [x, y] = screen(vector, view);
  return { x, y, facing: vector[0], visible: vector[0] >= 0 };
}

// D3's intersection of a great-circle plane with the hemisphere plane x=0:
// positive interpolation weights select the minor arc; normalising restores the sphere.
function horizon(a: Vector, b: Vector): Vector {
  const t = a[0] / (a[0] - b[0]);
  const y = a[1] * (1 - t) + b[1] * t;
  const z = a[2] * (1 - t) + b[2] * t;
  const length = Math.hypot(y, z);
  if (length === 0) throw new RangeError('Ambiguous horizon intersection');
  return [0, y / length, z / length];
}

export function clipGlobeLine(
  coordinates: ReadonlyArray<GeoCoord>,
  view: GlobeView,
): ReadonlyArray<ReadonlyArray<ScreenPoint>> {
  validateView(view);
  const vectors = coordinates.map((coordinate) => rotate(coordinate, view.center));
  const segments: ScreenPoint[][] = [];
  let current: ScreenPoint[] = [];
  const append = (vector: Vector): void => {
    const point = screen(vector, view);
    const last = current.at(-1);
    if (last === undefined || last[0] !== point[0] || last[1] !== point[1]) current.push(point);
  };
  const finish = (): void => {
    if (current.length >= 2) segments.push(current);
    current = [];
  };
  let previous: Vector | undefined;
  for (const vector of vectors) {
    if (previous !== undefined) {
      if (
        Math.hypot(vector[0] + previous[0], vector[1] + previous[1], vector[2] + previous[2]) <=
        GLOBE_EPSILON
      )
        throw new RangeError('Antipodal edges do not define a unique minor arc');
      const wasVisible = previous[0] >= 0;
      const visible = vector[0] >= 0;
      if (wasVisible !== visible) append(horizon(previous, vector));
      if (!visible) finish();
    }
    if (vector[0] >= 0) append(vector);
    previous = vector;
  }
  finish();
  return segments;
}
