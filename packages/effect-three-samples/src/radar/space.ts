/**
 * The radar's sphere in world units. The 2D radar projects these same coordinates onto
 * SVG; here they are the scene. Longitude 0 faces +z (the home camera's side) and
 * positive longitudes turn right, as the 2D projection; latitude is up.
 */
import type { Vec3 } from '@opsydyn/effect-three';

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
