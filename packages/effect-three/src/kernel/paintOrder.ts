/**
 * The order to paint a still in, far to near from one eye, exactly: a binary space
 * partition (Fuchs, Kedem and Naylor, 1980) of what is drawn, where sorting by depth
 * would paint a floor over what stands on it. It partitions objects rather than faces: an
 * object none of whose faces can hide another (any convex solid, its back faces culled)
 * is painted as it is, and is told which side of a plane it lies by its bounding sphere
 * before its faces are looked at, so a scene of many objects stays quick. Splitting
 * planes are chosen to cut few objects and to share them out evenly.
 *
 * @module
 */
import { Sphere, Vector3 } from 'three';

/** A flat convex polygon in the world, and what it is painted as. */
export type Facet<T> = {
  readonly _tag: 'Facet';
  readonly points: ReadonlyArray<Vector3>;
  readonly item: T;
};

/** Something without area (a line, a point) at a place in the world. */
export type Mark<T> = { readonly _tag: 'Mark'; readonly at: Vector3; readonly item: T };

/** What one object draws, and whether its facets may be painted in any order. */
export type Unit<T> = {
  readonly facets: ReadonlyArray<Facet<T>>;
  readonly marks: ReadonlyArray<Mark<T>>;
  readonly bounds: Sphere;
  readonly selfOrdered: boolean;
};

/** A plane, `normal · p = constant`. */
export type Plane = { readonly normal: Vector3; readonly constant: number };

/** How far from a plane, in world units a unit from the origin, a point counts as on it. */
const onPlane = 1e-6;

/** How many facets are weighed as each partition's plane. */
const candidates = 8;

/** How much worse a cut object is than an object on the fuller side. */
const splitCost = 8;

const planeOf = (points: ReadonlyArray<Vector3>): Plane | undefined => {
  const [a, b, c] = points;
  if (a === undefined || b === undefined || c === undefined) return undefined;
  const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
  if (normal.lengthSq() === 0) return undefined;
  normal.normalize();
  return { normal, constant: normal.dot(a) };
};

const side = (plane: Plane, point: Vector3): number => plane.normal.dot(point) - plane.constant;

const toleranceAt = (points: ReadonlyArray<Vector3>): number =>
  onPlane * Math.max(1, ...points.map((point) => point.length()));

type Parts<T> = {
  readonly front?: Facet<T>;
  readonly back?: Facet<T>;
  readonly on?: Facet<T>;
};

/** A facet split by a plane: what lies in front of it, behind it, and in it. */
export const split = <T>(plane: Plane, facet: Facet<T>): Parts<T> => {
  const sides = facet.points.map((point) => side(plane, point));
  const tolerance = toleranceAt(facet.points);
  if (sides.every((s) => Math.abs(s) <= tolerance)) return { on: facet };
  if (sides.every((s) => s >= -tolerance)) return { front: facet };
  if (sides.every((s) => s <= tolerance)) return { back: facet };
  const front: Array<Vector3> = [];
  const back: Array<Vector3> = [];
  facet.points.forEach((point, i) => {
    const next = facet.points[(i + 1) % facet.points.length] ?? point;
    const here = sides[i] ?? 0;
    const there = sides[(i + 1) % sides.length] ?? 0;
    if (here >= -tolerance) front.push(point);
    if (here <= tolerance) back.push(point);
    if ((here > tolerance && there < -tolerance) || (here < -tolerance && there > tolerance)) {
      const crossing = point.clone().lerp(next, here / (here - there));
      front.push(crossing);
      back.push(crossing.clone());
    }
  });
  return {
    ...(front.length >= 3 ? { front: { ...facet, points: front } } : {}),
    ...(back.length >= 3 ? { back: { ...facet, points: back } } : {}),
  };
};

/** Whether the eye is in front of `facet` and all of `facets` lie on or behind its plane. */
function hidesNone<T>(facet: Facet<T>, facets: ReadonlyArray<Facet<T>>, eye: Vector3): boolean {
  const plane = planeOf(facet.points);
  if (plane === undefined) return true;
  const tolerance = toleranceAt(facet.points);
  return (
    side(plane, eye) > tolerance &&
    facets.every(
      (other) => other === facet || other.points.every((point) => side(plane, point) <= tolerance),
    )
  );
}

/**
 * Gathers what one object draws. Its facets may be painted in any order when the eye is
 * in front of each and every other lies on or behind each one's plane: then none comes
 * between the eye and another.
 */
export const unitOf = <T>(
  facets: ReadonlyArray<Facet<T>>,
  marks: ReadonlyArray<Mark<T>>,
  eye: Vector3,
): Unit<T> => {
  const points = [...facets.flatMap((facet) => facet.points), ...marks.map((mark) => mark.at)];
  const bounds = new Sphere().setFromPoints(points);
  const selfOrdered = facets.every((facet) => hidesNone(facet, facets, eye));
  return { facets, marks, bounds, selfOrdered };
};

type Partition<T> = {
  readonly front: ReadonlyArray<Unit<T>>;
  readonly back: ReadonlyArray<Unit<T>>;
  readonly on: ReadonlyArray<Facet<T>>;
};

const sizeOf = <T>(unit: Unit<T>): number => unit.facets.length + unit.marks.length;

/** Which side of `plane` a unit lies, by its bounds: `0` when they cross it. */
const sideOf = <T>(plane: Plane, unit: Unit<T>): number => {
  const distance = side(plane, unit.bounds.center);
  const reach = unit.bounds.radius * (1 + onPlane) + onPlane;
  return distance > reach ? 1 : distance < -reach ? -1 : 0;
};

/** Units cut in two by `plane`, and how many facets and marks fall either side. */
const weigh = <T>(plane: Plane, units: ReadonlyArray<Unit<T>>): number => {
  let cut = 0;
  let front = 0;
  let back = 0;
  for (const unit of units) {
    const whole = sideOf(plane, unit);
    if (whole > 0) front += sizeOf(unit);
    else if (whole < 0) back += sizeOf(unit);
    else {
      const parts = unit.facets.map((facet) => split(plane, facet));
      const ahead = parts.filter((part) => part.front !== undefined).length;
      const behind = parts.filter((part) => part.back !== undefined).length;
      if (ahead > 0 && behind > 0) cut++;
      front += ahead;
      back += behind;
    }
  }
  return splitCost * cut + Math.abs(front - back);
};

const partition = <T>(plane: Plane, units: ReadonlyArray<Unit<T>>): Partition<T> => {
  const front: Array<Unit<T>> = [];
  const back: Array<Unit<T>> = [];
  const on: Array<Facet<T>> = [];
  for (const unit of units) {
    const whole = sideOf(plane, unit);
    if (whole > 0) front.push(unit);
    else if (whole < 0) back.push(unit);
    else {
      const ahead: Array<Facet<T>> = [];
      const behind: Array<Facet<T>> = [];
      for (const facet of unit.facets) {
        const parts = split(plane, facet);
        if (parts.front !== undefined) ahead.push(parts.front);
        if (parts.back !== undefined) behind.push(parts.back);
        if (parts.on !== undefined) on.push(parts.on);
      }
      const marksAhead = unit.marks.filter((mark) => side(plane, mark.at) >= 0);
      const marksBehind = unit.marks.filter((mark) => side(plane, mark.at) < 0);
      // A part of an object is bounded by the whole, and keeps its order.
      if (ahead.length + marksAhead.length > 0)
        front.push({ ...unit, facets: ahead, marks: marksAhead });
      if (behind.length + marksBehind.length > 0)
        back.push({ ...unit, facets: behind, marks: marksBehind });
    }
  }
  return { front, back, on };
};

/** The plane of one of a few facets spread over the units: the one that weighs least. */
const planeFor = <T>(units: ReadonlyArray<Unit<T>>): Plane | undefined => {
  const withFacets = units.filter((unit) => unit.facets.length > 0);
  const count = Math.min(candidates, withFacets.length);
  let best: Plane | undefined;
  let lightest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const unit = withFacets[Math.floor((i * withFacets.length) / count)];
    const facet = unit?.facets[Math.floor((i * (unit?.facets.length ?? 0)) / count)];
    const plane = facet === undefined ? undefined : planeOf(facet.points);
    if (plane === undefined) continue;
    const weight = weigh(plane, units);
    if (weight < lightest) {
      lightest = weight;
      best = plane;
    }
  }
  if (best !== undefined) return best;
  // Every one weighed has no area: any facet that has one.
  for (const unit of withFacets) {
    for (const facet of unit.facets) {
      const plane = planeOf(facet.points);
      if (plane !== undefined) return plane;
    }
  }
  return undefined;
};

const distanceFrom =
  (eye: Vector3) =>
  <T>(mark: Mark<T>): number =>
    mark.at.distanceToSquared(eye);

/** Each facet of a unit as a unit of its own, and each mark: for a unit that is not self-ordered. */
const apart = <T>(unit: Unit<T>): ReadonlyArray<Unit<T>> => [
  ...unit.facets.map((facet) => ({
    facets: [facet],
    marks: [],
    bounds: new Sphere().setFromPoints([...facet.points]),
    selfOrdered: true,
  })),
  ...unit.marks.map((mark) => ({
    facets: [],
    marks: [mark],
    bounds: new Sphere(mark.at.clone(), 0),
    selfOrdered: true,
  })),
];

/** Appends what `units` draw to `into`, farthest from `eye` first. */
const paint = <T>(
  units: ReadonlyArray<Unit<T>>,
  eye: Vector3,
  into: Array<Facet<T> | Mark<T>>,
): void => {
  const [only] = units;
  if (only !== undefined && units.length === 1) {
    if (only.selfOrdered && only.marks.length === 0) {
      into.push(...only.facets);
      return;
    }
    if (only.facets.length === 0) {
      into.push(...only.marks.toSorted((a, b) => distanceFrom(eye)(b) - distanceFrom(eye)(a)));
      return;
    }
    paint(apart(only), eye, into);
    return;
  }
  const plane = planeFor(units);
  if (plane === undefined) {
    const marks = units.flatMap((unit) => unit.marks);
    into.push(...marks.toSorted((a, b) => distanceFrom(eye)(b) - distanceFrom(eye)(a)));
    return;
  }
  const { front, back, on } = partition(plane, units);
  const facing = side(plane, eye) >= 0;
  paint(facing ? back : front, eye, into);
  into.push(...on);
  paint(facing ? front : back, eye, into);
};

/** What `units` draw, in the order to paint it seen from `eye`: farthest first. */
export const paintOrder = <T>(
  units: ReadonlyArray<Unit<T>>,
  eye: Vector3,
): ReadonlyArray<Facet<T> | Mark<T>> => {
  const into: Array<Facet<T> | Mark<T>> = [];
  paint(units, eye, into);
  return into;
};
