/**
 * Pivot controls as data, after Drei's `PivotControls` (`bf6f4ad`,
 * `src/web/pivotControls/`): every handle at once, turned with the object and sized in
 * scene units — an arrow along each axis, a square sliding in each plane, a quarter arc
 * turning round each axis, and a sphere scaling along each. Drei's listen to the pointer
 * and move a group themselves; here `pivotNodes` describes the handles from the Model, a
 * press on one (`pressPivot`, with the point the press hit) and the drag rays after it
 * (`dragPivot`) return the next placement, and the Model keeps both.
 *
 * The maths is Drei's: an arrow and a sphere follow the point on their axis nearest the
 * ray (`calculateOffset`); a square and an arc follow where the ray's line meets their
 * plane, a square by its offset along the plane's two axes, an arc by the angle turned
 * about the object (`calculateAngle`); a sphere scales by 2 to the power of a fifth of
 * the distance dragged, in handle sizes. Snapping is Drei's shift: ten degrees, and
 * scales to a tenth.
 *
 * Placements are in the object's parent's space, which is taken to be the world, as for
 * `gizmoNodes`.
 *
 * @module
 */
import { Euler, Quaternion, Vector3 } from 'three';

import { basic, cone, cylinder, fixed, group, mesh, plane, sphere } from './build.ts';
import type { SceneNode, Vec3 } from './description.ts';
import type { Placement } from './gizmo.ts';
import type { Ray } from './pointer.ts';

type Axis = 'x' | 'y' | 'z';

/** A handle: what it does, and the axis it is on (a square's and an arc's normal). */
export type PivotHandle = `${'arrow' | 'slider' | 'rotator' | 'sphere'}-${Axis}`;

/** A drag in progress: the handle, the placement it began at and the frame it moves in. */
export type PivotGrab = {
  readonly handle: PivotHandle;
  readonly start: Placement;
  /** Where the press hit the handle. */
  readonly point: Vec3;
  /** The handle's directions in the world: its axis, or its plane's two and normal. */
  readonly e1: Vec3;
  readonly e2: Vec3;
  readonly normal: Vec3;
};

export type Pivot = {
  /** The handles' size in scene units: an arrow's length (Drei's `scale`, 1). */
  readonly scale: number;
  /** Whether the object hides the handles behind it (Drei's `depthTest`, true). */
  readonly depthTest: boolean;
  /** Leave out kinds of handle, as Drei's `disable*`. */
  readonly disableAxes: boolean;
  readonly disableSliders: boolean;
  readonly disableRotations: boolean;
  readonly disableScaling: boolean;
  /** The handle under the pointer, drawn in Drei's hovered yellow. */
  readonly hovered: PivotHandle | null;
  readonly grab: PivotGrab | null;
};

/** Pivot controls with Drei's defaults: size 1, depth tested, every handle shown. */
export const pivot = (options: Partial<Omit<Pivot, 'hovered' | 'grab'>> = {}): Pivot => ({
  scale: options.scale ?? 1,
  depthTest: options.depthTest ?? true,
  disableAxes: options.disableAxes ?? false,
  disableSliders: options.disableSliders ?? false,
  disableRotations: options.disableRotations ?? false,
  disableScaling: options.disableScaling ?? false,
  hovered: null,
  grab: null,
});

const unit: Record<Axis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

/** Each plane's two directions, by its normal, in Drei's order. */
const planeOf: Record<Axis, readonly [Axis, Axis]> = {
  z: ['x', 'y'],
  y: ['z', 'x'],
  x: ['y', 'z'],
};

const turnOf = (rotation: Vec3): Quaternion =>
  new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2]));

const toVec3 = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

const kindOf = (handle: PivotHandle) =>
  handle.split('-')[0] as 'arrow' | 'slider' | 'rotator' | 'sphere';
const axisOf = (handle: PivotHandle): Axis => handle.split('-')[1] as Axis;

/** The handle's frame in the world: turned with the object, as Drei's group is. */
const frameOf = (handle: PivotHandle, placement: Placement) => {
  const turn = turnOf(placement.rotation);
  const axis = axisOf(handle);
  const [first, second] = planeOf[axis];
  const kind = kindOf(handle);
  const flat = kind === 'slider' || kind === 'rotator';
  const e1 = (flat ? unit[first] : unit[axis]).clone().applyQuaternion(turn);
  const e2 = (flat ? unit[second] : unit[axis]).clone().applyQuaternion(turn);
  return { e1, e2, normal: e1.clone().cross(e2).normalize() };
};

/** A press on `handle` at `point`, with the object at `placement`: takes hold. */
export const pressPivot = (
  state: Pivot,
  placement: Placement,
  handle: PivotHandle,
  point: Vec3,
): Pivot => {
  const { e1, e2, normal } = frameOf(handle, placement);
  return {
    ...state,
    grab: {
      handle,
      start: placement,
      point,
      e1: toVec3(e1),
      e2: toVec3(e2),
      normal: toVec3(kindOf(handle) === 'arrow' || kindOf(handle) === 'sphere' ? e1 : normal),
    },
  };
};

export const releasePivot = (state: Pivot): Pivot => ({ ...state, grab: null });

export const hoverPivot = (state: Pivot, handle: PivotHandle | null): Pivot =>
  state.hovered === handle ? state : { ...state, hovered: handle };

/**
 * Drei's `calculateOffset`: how far along `direction` from `point` the line nearest the
 * ray is, solving for the closest points of the two lines.
 */
const offsetAlong = (point: Vector3, direction: Vector3, ray: Ray): number => {
  const origin = new Vector3(...ray.origin);
  const toward = new Vector3(...ray.direction);
  const e1 = direction.dot(direction);
  const e2 = direction.dot(point) - direction.dot(origin);
  const e3 = direction.dot(toward);
  if (e3 === 0) return -e2 / e1;
  const v1 = toward
    .clone()
    .multiplyScalar(e1 / e3)
    .sub(direction);
  const v2 = toward
    .clone()
    .multiplyScalar(e2 / e3)
    .add(origin)
    .sub(point);
  return -v1.dot(v2) / v1.dot(v1);
};

/** Where the ray's line meets the plane through `at` with `normal`, if it does. */
const meetPlane = (ray: Ray, at: Vector3, normal: Vector3): Vector3 | undefined => {
  const origin = new Vector3(...ray.origin);
  const toward = new Vector3(...ray.direction);
  const facing = normal.dot(toward);
  if (facing === 0) return undefined;
  return origin.addScaledVector(toward, normal.dot(at.clone().sub(origin)) / facing);
};

/** Drei's `calculateAngle`: from the press to `to`, round `at`, in the plane of e1 and e2. */
const angleBetween = (from: Vector3, to: Vector3, at: Vector3, e1: Vector3, e2: Vector3) => {
  const a = from.clone().sub(at);
  const b = to.clone().sub(at);
  return Math.atan2(b.dot(e2), b.dot(e1)) - Math.atan2(a.dot(e2), a.dot(e1));
};

const vectorsOf = (grab: PivotGrab) => ({
  point: new Vector3(...grab.point),
  e1: new Vector3(...grab.e1),
  e2: new Vector3(...grab.e2),
  normal: new Vector3(...grab.normal),
  at: new Vector3(...grab.start.position),
});

const moved = (start: Placement, by: Vector3): Placement => ({
  ...start,
  position: toVec3(new Vector3(...start.position).add(by)),
});

const arrowDrag = (grab: PivotGrab, ray: Ray): Placement => {
  const { point, e1 } = vectorsOf(grab);
  return moved(grab.start, e1.clone().multiplyScalar(offsetAlong(point, e1, ray)));
};

const sliderDrag = (grab: PivotGrab, ray: Ray): Placement => {
  const { point, e1, e2, normal, at } = vectorsOf(grab);
  const meet = meetPlane(ray, at, normal);
  if (meet === undefined) return grab.start;
  const offset = meet.sub(point);
  return moved(
    grab.start,
    e1.multiplyScalar(offset.dot(e1)).add(e2.multiplyScalar(offset.dot(e2))),
  );
};

const tenDegrees = Math.PI / 18;

const rotatorDrag = (grab: PivotGrab, ray: Ray, snap: boolean): Placement => {
  const { point, e1, e2, normal, at } = vectorsOf(grab);
  const meet = meetPlane(ray, at, normal);
  if (meet === undefined) return grab.start;
  const turned = angleBetween(point, meet, at, e1, e2);
  const angle = snap ? Math.round(turned / tenDegrees) * tenDegrees : turned;
  const turn = new Quaternion()
    .setFromAxisAngle(normal, angle)
    .multiply(turnOf(grab.start.rotation));
  const euler = new Euler().setFromQuaternion(turn.normalize());
  return { ...grab.start, rotation: [euler.x, euler.y, euler.z] };
};

const sphereDrag = (state: Pivot, grab: PivotGrab, ray: Ray, snap: boolean): Placement => {
  const { point, e1 } = vectorsOf(grab);
  const grown = 2 ** ((offsetAlong(point, e1, ray) / state.scale) * 0.2);
  // Drei never lets a scale fall below 1e-5, which would break the object's matrix.
  const factor = Math.max(snap ? Math.round(grown * 10) / 10 : grown, 1e-5);
  const index = { x: 0, y: 1, z: 2 }[axisOf(grab.handle)];
  const scale: Vec3 = [
    grab.start.scale[0] * (index === 0 ? factor : 1),
    grab.start.scale[1] * (index === 1 ? factor : 1),
    grab.start.scale[2] * (index === 2 ? factor : 1),
  ];
  return { ...grab.start, scale };
};

/**
 * The placement a drag ray gives, or `undefined` while nothing is held. `snap` rounds
 * turns to ten degrees and scales to tenths, as Drei's shift does.
 */
export const dragPivot = (
  state: Pivot,
  ray: Ray,
  options: { readonly snap?: boolean } = {},
): Placement | undefined => {
  const grab = state.grab;
  if (grab === null) return undefined;
  const snap = options.snap ?? false;
  const kind = kindOf(grab.handle);
  if (kind === 'arrow') return arrowDrag(grab, ray);
  if (kind === 'slider') return sliderDrag(grab, ray);
  if (kind === 'rotator') return rotatorDrag(grab, ray, snap);
  return sphereDrag(state, grab, ray, snap);
};

// DRAWING

/** Drei's `axisColors` and `hoveredColor`. */
const colours: Record<Axis, number> = { x: 0xff2060, y: 0x20df80, z: 0x2080ff };
const hoveredColour = 0xffff40;

const handles = ['arrow', 'slider', 'rotator', 'sphere'] as const;

/** The handle a hit names, if it is one of this pivot's. */
export const pivotHandleOf = (key: string, hit: string): PivotHandle | undefined => {
  const [owner, name] = hit.split(':');
  if (owner !== key) return undefined;
  return handles
    .flatMap((kind) => (['x', 'y', 'z'] as const).map((axis): PivotHandle => `${kind}-${axis}`))
    .find((handle) => handle === name);
};

const lookOf = (state: Pivot, handle: PivotHandle) =>
  basic({
    color:
      state.grab?.handle === handle || state.hovered === handle
        ? hoveredColour
        : colours[axisOf(handle)],
    depthTest: state.depthTest,
    side: 'double',
  });

/**
 * What a hit shape is drawn with: nothing to see, never hiding anything, still picked
 * (Drei's arrows carry an invisible cylinder the same way).
 */
const unseen = basic({ opacity: 0, transparent: true, depthTest: false });

/** Turns +y onto each axis, for the arrows, stems and spheres, which are drawn along y. */
const pointAlong: Record<Axis, Vec3> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

const along = (axis: Axis, distance: number): Vec3 => {
  const { x, y, z } = unit[axis];
  return [x * distance, y * distance, z * distance];
};

/** Drei's `AxisArrow`: a stem of 4/5 of the size and a cone of 1/5, 1/20 wide. */
const arrowNodes = (key: string, state: Pivot, axis: Axis): ReadonlyArray<SceneNode> => {
  const handle: PivotHandle = `arrow-${axis}`;
  const size = state.scale;
  const coneLength = size / 5;
  const stem = size - coneLength;
  const material = lookOf(state, handle);
  return [
    mesh({
      key: `${key}:${handle}:stem`,
      position: along(axis, stem / 2),
      rotation: fixed(pointAlong[axis]),
      geometry: cylinder({ radiusTop: size / 80, radiusBottom: size / 80, height: stem }),
      material,
    }),
    // Drei's hit cylinder: 1.4 cone widths round, the arrow's whole length.
    mesh({
      key: `${key}:${handle}:hit`,
      position: along(axis, size / 2),
      rotation: fixed(pointAlong[axis]),
      geometry: cylinder({ radiusTop: size * 0.07, radiusBottom: size * 0.07, height: size }),
      material: unseen,
      interactive: true,
    }),
    mesh({
      key: `${key}:${handle}:cone`,
      position: along(axis, stem + coneLength / 2),
      rotation: fixed(pointAlong[axis]),
      geometry: cone({ radius: size / 20, height: coneLength, radialSegments: 24 }),
      material,
      interactive: true,
    }),
  ];
};

/** A rotation onto the plane of an axis's slider and arc: x onto its first, y its second. */
const ontoPlane: Record<Axis, Vec3> = {
  z: [0, 0, 0],
  y: [-Math.PI / 2, 0, -Math.PI / 2],
  x: [Math.PI / 2, Math.PI / 2, 0],
};

/** Drei's `PlaneSlider`: a square 0.225 of the size, its middle 1.7/7 out along both. */
const sliderNode = (key: string, state: Pivot, axis: Axis): SceneNode => {
  const handle: PivotHandle = `slider-${axis}`;
  const out = (state.scale / 7) * 1.7;
  const side = state.scale * 0.225;
  return group({
    key: `${key}:${handle}`,
    rotation: fixed(ontoPlane[axis]),
    children: [
      mesh({
        key: `${key}:${handle}:square`,
        position: [out, out, 0],
        geometry: plane({ width: side, height: side }),
        material: lookOf(state, handle),
        interactive: true,
      }),
    ],
  });
};

const arcSegments = 8;

/** Drei's `AxisRotator`: a quarter circle of radius 0.65 of the size, from its first to its second. */
const rotatorNode = (key: string, state: Pivot, axis: Axis): SceneNode => {
  const handle: PivotHandle = `rotator-${axis}`;
  const radius = state.scale * 0.65;
  const step = Math.PI / 2 / arcSegments;
  const chord = 2 * radius * Math.sin(step / 2);
  // A cylinder lies along y: each turned to the arc's tangent at its middle. The thin one
  // shows; a thick, unseen one round it is what the pointer finds, as Drei's line is
  // picked a few pixels wide.
  const segment = (index: number, part: 'line' | 'hit'): SceneNode => {
    const middle = step * (index + 0.5);
    const thickness = part === 'line' ? radius / 50 : state.scale * 0.03;
    return mesh({
      key: `${key}:${handle}:${part}:${index}`,
      position: [Math.cos(middle) * radius, Math.sin(middle) * radius, 0],
      rotation: fixed([0, 0, middle]),
      geometry: cylinder({ radiusTop: thickness, radiusBottom: thickness, height: chord }),
      material: part === 'line' ? lookOf(state, handle) : unseen,
      interactive: part === 'hit',
    });
  };
  const indices = Array.from({ length: arcSegments }, (_, index) => index);
  return group({
    key: `${key}:${handle}`,
    rotation: fixed(ontoPlane[axis]),
    children: [
      ...indices.map((index) => segment(index, 'line')),
      ...indices.map((index) => segment(index, 'hit')),
    ],
  });
};

/** Drei's `ScalingSphere`: a ball 1/22.5 of the size, 1.2 sizes out along its axis. */
const sphereNode = (key: string, state: Pivot, axis: Axis): SceneNode =>
  mesh({
    key: `${key}:sphere-${axis}`,
    position: along(axis, state.scale * 1.2),
    geometry: sphere({ radius: state.scale / 22.5, widthSegments: 12, heightSegments: 12 }),
    material: lookOf(state, `sphere-${axis}`),
    interactive: true,
  });

const axesOf: ReadonlyArray<Axis> = ['x', 'y', 'z'];

/**
 * The handles for `placement`: a group at the object, turned with it (and not scaled),
 * its handles keyed `${key}:arrow-x`, `${key}:slider-z`, `${key}:rotator-y`,
 * `${key}:sphere-x` and so on, each pickable.
 */
export const pivotNodes = (key: string, state: Pivot, placement: Placement): SceneNode =>
  group({
    key,
    position: placement.position,
    rotation: fixed(placement.rotation),
    children: [
      ...(state.disableAxes ? [] : axesOf.flatMap((axis) => arrowNodes(key, state, axis))),
      ...(state.disableSliders ? [] : axesOf.map((axis) => sliderNode(key, state, axis))),
      ...(state.disableRotations ? [] : axesOf.map((axis) => rotatorNode(key, state, axis))),
      ...(state.disableScaling ? [] : axesOf.map((axis) => sphereNode(key, state, axis))),
    ],
  });
