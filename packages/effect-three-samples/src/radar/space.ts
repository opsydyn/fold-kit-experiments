/**
 * The radar's sphere in world units. The 2D radar projects these same coordinates onto
 * SVG; here they are the scene. Longitude 0 faces +z (the home camera's side) and
 * positive longitudes turn right, as the 2D projection; latitude is up.
 */
import type { Vec3 } from '@opsydyn/effect-three';
import { Match } from 'effect';

import { categoryIds, type Category, type Ring } from './data';
import { categoryCenter, type RadarPosition, sectorStarts, shellFractions } from './layout';

/** The outer (caution) shell's radius. */
export const outerRadius = 3;

export const shellRadius = (ring: Ring): number => outerRadius * shellFractions[ring];

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The point `radius` from the centre at `[longitude, latitude]`, in degrees. */
export const onSphere = (longitude: number, latitude: number, radius: number): Vec3 => {
  const lon = radians(longitude);
  const lat = radians(latitude);
  return [
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  ];
};

/** An entry's blip: its slot's direction, on its ring's shell. */
export const blipPosition = (position: RadarPosition): Vec3 =>
  onSphere(position.longitude, position.latitude, shellRadius(position.entry.ring));

/** A shell's equator, every 5°, closed. */
export const equator = (radius: number): ReadonlyArray<Vec3> =>
  Array.from({ length: 73 }, (_, i) => onSphere(-180 + i * 5, 0, radius));

/** Pole to pole along `longitude`, every 5°. */
export const meridian = (longitude: number, radius: number): ReadonlyArray<Vec3> =>
  Array.from({ length: 37 }, (_, i) => onSphere(longitude, -90 + i * 5, radius));

/** The outer shell's sector boundaries, one meridian per category's start. */
export const sectorBoundaries: ReadonlyArray<
  Readonly<{ category: Category; points: ReadonlyArray<Vec3> }>
> = categoryIds.map((category) => ({
  category,
  points: meridian(sectorStarts[category], outerRadius),
}));

/** A category's name: outside the outer shell, on the equator at its sector's centre. */
export const categoryLabelPosition = (category: Category): Vec3 =>
  onSphere(categoryCenter(category)[0], 0, outerRadius * 1.16);

/** A ring's name: just above its shell's north pole, clear of every blip (all at ±22°). */
export const ringLabelPosition = (ring: Ring): Vec3 => [0, shellRadius(ring) + 0.14, 0];

const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const scaled = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => scaled(v, 1 / length(v));

/** How far an edge lifts above its shells at its middle, as a share of the outer one. */
const edgeLift = 0.1;

/**
 * A unit vector at right angles to `u`, towards `toward` when they are not parallel:
 * the second axis of the plane an edge turns in. Opposite blips have no plane of their
 * own, so they turn over the top, or round the side when they sit on the poles.
 */
const perpendicular = (u: Vec3, toward: Vec3): Vec3 => {
  const candidates: ReadonlyArray<Vec3> = [toward, [0, 1, 0], [1, 0, 0]];
  const found = candidates
    .map((candidate) => plus(candidate, scaled(u, -dot(candidate, u))))
    .find((rest) => length(rest) > 1e-6);
  return unit(found ?? [0, 0, 1]);
};

/**
 * A relationship's edge from `a` to `b`. Its direction turns evenly round the sphere
 * from one blip to the other; its distance from the centre eases from one shell to the
 * other and lifts outward in the middle. So it never dips inside the nearer blip's
 * shell, and opposite blips arc over the top rather than through the centre.
 */
export const edgeArc = (a: Vec3, b: Vec3, samples = 24): ReadonlyArray<Vec3> => {
  const [ra, rb] = [length(a), length(b)];
  const [ua, ub] = [unit(a), unit(b)];
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(ua, ub))));
  const v = perpendicular(ua, ub);
  const lift = edgeLift * Math.max(ra, rb);
  return Array.from({ length: samples + 1 }, (_, i) =>
    arcPoint(ua, v, angle, ra, rb, lift, i / samples),
  );
};

/** The edge at `t`: turned `t` of the way round, at its eased and lifted distance. */
const arcPoint = (
  ua: Vec3,
  v: Vec3,
  angle: number,
  ra: number,
  rb: number,
  lift: number,
  t: number,
): Vec3 =>
  scaled(
    plus(scaled(ua, Math.cos(t * angle)), scaled(v, Math.sin(t * angle))),
    ra + (rb - ra) * t + lift * Math.sin(Math.PI * t),
  );

/** The arc's peak, where its type label sits. */
export const arcPeak = (arc: ReadonlyArray<Vec3>): Vec3 =>
  arc[Math.floor(arc.length / 2)] ?? [0, 0, 0];

export const distanceBetween = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** How much a blip shows, from its distance to the camera: zooming in reveals more. */
export type Detail = 'blip' | 'name' | 'full';
/** Within this distance a blip shows its name. */
export const nameDistance = 7;
/** Within this distance a blip also shows its ring, category and description. */
export const fullDistance = 4.5;

export const detailAt = (distance: number): Detail =>
  Match.value(distance).pipe(
    Match.when(
      (near) => near <= fullDistance,
      () => 'full' as const,
    ),
    Match.when(
      (near) => near <= nameDistance,
      () => 'name' as const,
    ),
    Match.orElse(() => 'blip' as const),
  );

/** Whether a blip at this detail is named. */
export const showsName = (detail: Detail): boolean =>
  Match.value(detail).pipe(
    Match.when('blip', () => false),
    Match.orElse(() => true),
  );

/** Whether a blip at this detail also shows its ring, category and description. */
export const showsMeta = (detail: Detail): boolean =>
  Match.value(detail).pipe(
    Match.when('full', () => true),
    Match.orElse(() => false),
  );

/** Whether `point` is on the camera's side of the radar's centre. */
export const facesCamera = (camera: Vec3, point: Vec3): boolean => dot(camera, point) > 0;

/** A blip's detail: those on the camera's side by their distance; the far side shows none. */
export const detailFor = (camera: Vec3, point: Vec3): Detail =>
  Match.value(facesCamera(camera, point)).pipe(
    Match.when(true, () => detailAt(distanceBetween(camera, point))),
    Match.orElse(() => 'blip' as const),
  );

/** Category names show from beyond this camera distance; closer, they would fill the view. */
export const categoryLabelDistance = 8;

/** The orbit's zoom limits: outside the labels, and never inside the outer shell. */
export const zoomLimits = { min: 5, max: 16 } as const;

/** `position` moved along its line to the centre by `factor`, within the zoom limits. */
export const zoomedPosition = (position: Vec3, factor: number): Vec3 => {
  const current = length(position);
  const next = Math.min(zoomLimits.max, Math.max(zoomLimits.min, current * factor));
  const scale = next / current;
  return [position[0] * scale, position[1] * scale, position[2] * scale];
};
