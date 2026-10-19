/**
 * A transform gizmo as data, after three.js's `TransformControls` (0.186.1,
 * `examples/jsm/controls/TransformControls.js`), which Drei's `TransformControls` wraps.
 * three's controls listen to the canvas and move the object themselves; here, as for the
 * camera (ADR-006), the gizmo is pure: `gizmoNodes` describes its handles from the Model,
 * a press on one (`pressGizmo`) and the drag rays after it (`dragGizmo`) return the next
 * placement, and the Model keeps both. Every move is a Message, so it can be undone,
 * replayed and tested without a browser.
 *
 * The maths is three's: a single axis is dragged on the plane through it that best faces
 * the eye; a plane handle on that plane; the centre on a plane facing the camera.
 * Rotation turns by the drag along `axis × eye`, at three's speed (20 over the camera's
 * distance). Scale is always in the object's own axes. Handles keep their size on
 * screen, as three's do, and hide when they point straight at the eye.
 *
 * Placements are in the object's parent's space, which is taken to be the world: a gizmo
 * for a node at the top of the scene, or in an unrotated, unscaled group.
 *
 * @module
 */
import { Euler, Quaternion, Vector3 } from 'three';

import { basic, box, cone, cylinder, fixed, group, mesh, plane, sphere, torus } from './build.ts';
import type { Camera, SceneNode, Vec3 } from './description.ts';
import { type PlaneEquation, pointOnPlane, type Ray } from './pointer.ts';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
/** A handle: an axis, the plane of two, or all three (the centre). */
export type GizmoHandle = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'xyz';
export type GizmoSpace = 'world' | 'local';

/** Where an object is: its position, Euler angles (radians) and scale. */
export type Placement = {
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
};

/** A drag in progress: the handle, where it began, and the plane it moves on. */
export type GizmoGrab = {
  readonly handle: GizmoHandle;
  readonly start: Placement;
  /** The press point on the plane, from the object's position. */
  readonly from: Vec3;
  readonly plane: PlaneEquation;
  /** From the object towards the eye, as the press saw it. */
  readonly eye: Vec3;
  /** The eye's distance, for rotation speed. */
  readonly distance: number;
};

export type Gizmo = {
  readonly mode: GizmoMode;
  readonly space: GizmoSpace;
  /** On-screen size, 1 as three's. */
  readonly size: number;
  /** Rounds moves, turns (radians) and scales to these steps, or not when `null`. */
  readonly translationSnap: number | null;
  readonly rotationSnap: number | null;
  readonly scaleSnap: number | null;
  readonly showX: boolean;
  readonly showY: boolean;
  readonly showZ: boolean;
  /** The handle under the pointer, drawn highlighted. */
  readonly hovered: GizmoHandle | null;
  readonly grab: GizmoGrab | null;
};

/** A gizmo with Drei's and three's defaults: translating, in world space, size 1, no snaps. */
export const gizmo = (options: Partial<Omit<Gizmo, 'hovered' | 'grab'>> = {}): Gizmo => ({
  mode: options.mode ?? 'translate',
  space: options.space ?? 'world',
  size: options.size ?? 1,
  translationSnap: options.translationSnap ?? null,
  rotationSnap: options.rotationSnap ?? null,
  scaleSnap: options.scaleSnap ?? null,
  showX: options.showX ?? true,
  showY: options.showY ?? true,
  showZ: options.showZ ?? true,
  hovered: null,
  grab: null,
});

const axes = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
} as const;

const turnOf = (rotation: Vec3): Quaternion =>
  new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2]));

/** The space handles are in: scale is always the object's own (three's rule). */
const spaceOf = (state: Gizmo, handle: GizmoHandle | null): GizmoSpace => {
  if (state.mode === 'scale') return 'local';
  if (handle === 'xyz') return 'world';
  return state.space;
};

/** An axis in world space: the object's own when the space is local. */
const axisIn = (name: 'x' | 'y' | 'z', space: GizmoSpace, rotation: Vec3): Vector3 =>
  space === 'local' ? axes[name].clone().applyQuaternion(turnOf(rotation)) : axes[name].clone();

const toVec3 = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

/**
 * three's `TransformControlsPlane`: the plane the handle drags on, through `center`. An
 * axis: its plane facing the eye; a plane handle: that plane; the centre and every
 * rotation: the plane facing the camera.
 */
const dragPlane = (
  state: Gizmo,
  handle: GizmoHandle,
  start: Placement,
  eye: Vector3,
  facingCamera: Vector3,
): PlaneEquation => {
  const space = spaceOf(state, handle);
  const along = (name: 'x' | 'y' | 'z') => axisIn(name, space, start.rotation);
  const facing = (axis: Vector3) => axis.clone().cross(eye.clone().cross(axis));
  const normals: Record<GizmoHandle, () => Vector3> = {
    x: () => facing(along('x')),
    y: () => facing(along('y')),
    z: () => facing(along('z')),
    xy: () => along('z'),
    yz: () => along('x'),
    xz: () => along('y'),
    xyz: () => facingCamera.clone(),
  };
  const normal = state.mode === 'rotate' ? facingCamera.clone() : normals[handle]();
  if (normal.lengthSq() < 1e-12) normal.copy(eye);
  normal.normalize();
  const center = new Vector3(...start.position);
  return { normal: toVec3(normal), constant: -normal.dot(center) };
};

/** Where a ray meets the grab's plane, from the object's starting position. */
const onPlane = (grab: GizmoGrab, ray: Ray): Vector3 | undefined => {
  const point = pointOnPlane(ray, grab.plane);
  if (point === undefined) return undefined;
  return new Vector3(...point).sub(new Vector3(...grab.start.position));
};

/** From the camera's target back to the camera: the way the camera's screen faces. */
const backwards = (camera: Camera): Vector3 => {
  const back = new Vector3(...camera.position).sub(new Vector3(...camera.lookAt));
  return back.lengthSq() > 1e-12 ? back.normalize() : new Vector3(0, 0, 1);
};

/**
 * Takes hold of `handle` on a press along `ray`, seen from `camera` (the scene's, as the
 * Model holds it): the gizmo remembers where the drag began.
 */
export const pressGizmo = (
  state: Gizmo,
  placement: Placement,
  handle: GizmoHandle,
  ray: Ray,
  camera: Camera,
): Gizmo => {
  const center = new Vector3(...placement.position);
  const facingCamera = backwards(camera);
  // three's eye: towards a perspective camera, or along an orthographic one's view.
  const towardsEye = new Vector3(...camera.position).sub(center);
  const distance = towardsEye.length();
  const eye =
    camera._tag === 'Orthographic' || distance < 1e-9
      ? facingCamera.clone()
      : towardsEye.normalize();
  const plane = dragPlane(state, handle, placement, eye, facingCamera);
  const point = pointOnPlane(ray, plane);
  if (point === undefined) return state;
  const from = toVec3(new Vector3(...point).sub(center));
  return { ...state, grab: { handle, start: placement, from, plane, eye: toVec3(eye), distance } };
};

/** Lets go: the drag ends where it is. */
export const releaseGizmo = (state: Gizmo): Gizmo => ({ ...state, grab: null });

/** The handle under the pointer, or none. */
export const hoverGizmo = (state: Gizmo, handle: GizmoHandle | null): Gizmo =>
  state.hovered === handle ? state : { ...state, hovered: handle };

const snapped = (value: number, step: number | null): number =>
  step === null ? value : Math.round(value / step) * step;

const includes = (handle: GizmoHandle, axis: 'x' | 'y' | 'z'): boolean => handle.includes(axis);

/** three's translate: the drag's offset, kept to the handle's axes, then snapped. */
const translated = (state: Gizmo, grab: GizmoGrab, end: Vector3): Placement => {
  const space = spaceOf(state, grab.handle);
  const offset = end.clone().sub(new Vector3(...grab.from));
  const turn = turnOf(grab.start.rotation);
  if (space === 'local') offset.applyQuaternion(turn.clone().invert());
  if (!includes(grab.handle, 'x')) offset.x = 0;
  if (!includes(grab.handle, 'y')) offset.y = 0;
  if (!includes(grab.handle, 'z')) offset.z = 0;
  if (space === 'local') {
    // Snapped along the object's own axes, as three snaps local moves.
    const local = offset.add(
      new Vector3(...grab.start.position).applyQuaternion(turn.clone().invert()),
    );
    if (includes(grab.handle, 'x')) local.x = snapped(local.x, state.translationSnap);
    if (includes(grab.handle, 'y')) local.y = snapped(local.y, state.translationSnap);
    if (includes(grab.handle, 'z')) local.z = snapped(local.z, state.translationSnap);
    return { ...grab.start, position: toVec3(local.applyQuaternion(turn)) };
  }
  const position = offset.add(new Vector3(...grab.start.position));
  if (includes(grab.handle, 'x')) position.x = snapped(position.x, state.translationSnap);
  if (includes(grab.handle, 'y')) position.y = snapped(position.y, state.translationSnap);
  if (includes(grab.handle, 'z')) position.z = snapped(position.z, state.translationSnap);
  return { ...grab.start, position: toVec3(position) };
};

/** three's scale: the press and drag points' ratio, in the object's own axes. */
const scaled = (state: Gizmo, grab: GizmoGrab, end: Vector3): Placement => {
  const from = new Vector3(...grab.from);
  const factor = new Vector3(1, 1, 1);
  if (grab.handle === 'xyz') {
    const ratio = (end.length() / Math.max(from.length(), 1e-9)) * (end.dot(from) < 0 ? -1 : 1);
    factor.setScalar(ratio);
  } else {
    const inverse = turnOf(grab.start.rotation).invert();
    const a = from.clone().applyQuaternion(inverse);
    const b = end.clone().applyQuaternion(inverse);
    factor.set(
      includes(grab.handle, 'x') ? b.x / a.x : 1,
      includes(grab.handle, 'y') ? b.y / a.y : 1,
      includes(grab.handle, 'z') ? b.z / a.z : 1,
    );
  }
  const step = state.scaleSnap;
  const each = (index: 0 | 1 | 2, axis: 'x' | 'y' | 'z'): number => {
    const value = grab.start.scale[index] * factor.getComponent(index);
    if (step === null || !includes(grab.handle, axis)) return value;
    return snapped(value, step) || step;
  };
  return { ...grab.start, scale: [each(0, 'x'), each(1, 'y'), each(2, 'z')] };
};

/** three's rotate: the drag along `axis × eye`, at its speed; turned about the axis. */
const rotated = (state: Gizmo, grab: GizmoGrab, end: Vector3): Placement => {
  if (grab.handle !== 'x' && grab.handle !== 'y' && grab.handle !== 'z') return grab.start;
  const space = spaceOf(state, grab.handle);
  const offset = end.clone().sub(new Vector3(...grab.from));
  const speed = 20 / Math.max(grab.distance, 1e-9);
  const axis = axisIn(grab.handle, space, grab.start.rotation);
  const across = axis.clone().cross(new Vector3(...grab.eye));
  const angle = snapped(
    across.lengthSq() < 1e-12 ? 0 : offset.dot(across.normalize()) * speed,
    state.rotationSnap,
  );
  const start = turnOf(grab.start.rotation);
  const turn =
    space === 'local'
      ? start.clone().multiply(new Quaternion().setFromAxisAngle(axes[grab.handle], angle))
      : new Quaternion().setFromAxisAngle(axes[grab.handle], angle).multiply(start);
  const euler = new Euler().setFromQuaternion(turn.normalize());
  return { ...grab.start, rotation: [euler.x, euler.y, euler.z] };
};

/** The placement a drag ray gives, or `undefined` while nothing is held. */
export const dragGizmo = (state: Gizmo, ray: Ray): Placement | undefined => {
  const grab = state.grab;
  if (grab === null) return undefined;
  const end = onPlane(grab, ray);
  if (end === undefined) return grab.start;
  if (state.mode === 'translate') return translated(state, grab, end);
  if (state.mode === 'scale') return scaled(state, grab, end);
  return rotated(state, grab, end);
};

// DRAWING

const colours = {
  x: 0xff3653,
  y: 0x8adb00,
  z: 0x2c8fff,
  xy: 0x2c8fff,
  yz: 0xff3653,
  xz: 0x8adb00,
} as const;
const highlight = 0xffff00;
/** three's `AXIS_HIDE_THRESHOLD`: an axis this close to the eye is hidden. */
const hideThreshold = 0.99;

/**
 * three's on-screen size: the camera's distance times its view's spread, a quarter of
 * that per unit of `size`. An orthographic camera is taken as 480 pixels tall.
 */
const screenScale = (state: Gizmo, at: Vec3, camera: Camera): number => {
  if (camera._tag === 'Orthographic') return ((480 / camera.zoom) * state.size) / 4;
  const distance = new Vector3(...camera.position).distanceTo(new Vector3(...at));
  const spread = Math.min(1.9 * Math.tan((Math.PI * camera.fov) / 360), 7);
  return (distance * spread * state.size) / 4;
};

/** The handle a hit names, if it is one of this gizmo's. */
export const gizmoHandleOf = (key: string, hit: string): GizmoHandle | undefined => {
  const prefix = `${key}:`;
  if (!hit.startsWith(prefix)) return undefined;
  const name = hit.slice(prefix.length).split(':')[0];
  const handles: ReadonlyArray<GizmoHandle> = ['x', 'y', 'z', 'xy', 'yz', 'xz', 'xyz'];
  return handles.find((handle) => handle === name);
};

const look = (state: Gizmo, handle: GizmoHandle, colour: number) =>
  basic({
    color: state.grab?.handle === handle || state.hovered === handle ? highlight : colour,
    transparent: true,
    opacity: state.grab !== null && state.grab.handle !== handle ? 0.25 : 0.9,
    // Over everything, as three's gizmo: seen through the object it moves.
    depthTest: false,
  });

/** Turns +y onto each axis, for the arrows and stems, which are drawn along y. */
const pointAlong = { x: [0, 0, -Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] } as const;
/** Where each arrow's tip is: half a unit along its axis. */
const tips = { x: [0.5, 0, 0], y: [0, 0.5, 0], z: [0, 0, 0.5] } as const satisfies Record<
  'x' | 'y' | 'z',
  Vec3
>;
/** Turns each ring (in xy, round z) round its axis. */
const ringRound = { x: [0, Math.PI / 2, 0], y: [Math.PI / 2, 0, 0], z: [0, 0, 0] } as const;

type Axis = 'x' | 'y' | 'z';

/** A rotation handle: a ring round the axis. */
const ring = (key: string, state: Gizmo, axis: Axis): ReadonlyArray<SceneNode> => [
  mesh({
    key: `${key}:${axis}`,
    rotation: fixed([...ringRound[axis]]),
    geometry: torus({ radius: 0.5, tube: 0.02, radialSegments: 6, tubularSegments: 48 }),
    material: look(state, axis, colours[axis]),
    interactive: true,
  }),
];

/** A translate or scale handle: a stem along the axis, an arrowhead or a box at its end. */
const arrow = (key: string, state: Gizmo, axis: Axis): ReadonlyArray<SceneNode> => {
  const along = pointAlong[axis];
  const tipAt = tips[axis];
  const material = look(state, axis, colours[axis]);
  return [
    mesh({
      key: `${key}:${axis}:stem`,
      position: [tipAt[0] / 2, tipAt[1] / 2, tipAt[2] / 2],
      rotation: fixed([...along]),
      geometry: cylinder({ radiusTop: 0.012, radiusBottom: 0.012, height: 0.5 }),
      material,
      interactive: true,
    }),
    mesh({
      key: `${key}:${axis}:tip`,
      position: tipAt,
      rotation: fixed([...along]),
      geometry:
        state.mode === 'scale'
          ? box({ width: 0.08, height: 0.08, depth: 0.08 })
          : cone({ radius: 0.04, height: 0.12, radialSegments: 12 }),
      material,
      interactive: true,
    }),
  ];
};

const axisHandles = (
  key: string,
  state: Gizmo,
  visible: (axis: Axis) => boolean,
): ReadonlyArray<SceneNode> =>
  (['x', 'y', 'z'] as const)
    .filter(visible)
    .flatMap((axis) =>
      state.mode === 'rotate' ? ring(key, state, axis) : arrow(key, state, axis),
    );

/** The plane handles of translate and scale: small squares between two axes. */
const planeHandles = (key: string, state: Gizmo): ReadonlyArray<SceneNode> => {
  if (state.mode === 'rotate') return [];
  const squares = [
    {
      handle: 'xy',
      at: [0.15, 0.15, 0] as Vec3,
      turn: [0, 0, 0] as Vec3,
      shown: state.showX && state.showY,
    },
    {
      handle: 'yz',
      at: [0, 0.15, 0.15] as Vec3,
      turn: [0, Math.PI / 2, 0] as Vec3,
      shown: state.showY && state.showZ,
    },
    {
      handle: 'xz',
      at: [0.15, 0, 0.15] as Vec3,
      turn: [-Math.PI / 2, 0, 0] as Vec3,
      shown: state.showX && state.showZ,
    },
  ] as const;
  return squares
    .filter((square) => square.shown)
    .map((square) =>
      mesh({
        key: `${key}:${square.handle}`,
        position: square.at,
        rotation: fixed([...square.turn]),
        geometry: plane({ width: 0.12, height: 0.12 }),
        material: { ...look(state, square.handle, colours[square.handle]), side: 'double' },
        interactive: true,
      }),
    );
};

/**
 * The gizmo's handles for `placement`, seen from `camera`: a group at the object's
 * position, turned with it in local space (and always when scaling), its handles keyed
 * `${key}:x`, `${key}:xy`, `${key}:xyz` and so on, each pickable. Highlights the hovered
 * or held handle in yellow, as three does.
 */
export const gizmoNodes = (
  key: string,
  state: Gizmo,
  placement: Placement,
  camera: Camera,
): SceneNode => {
  const space = spaceOf(state, state.grab?.handle ?? null);
  const scale = screenScale(state, placement.position, camera);
  const eye = new Vector3(...camera.position).sub(new Vector3(...placement.position)).normalize();
  const shown = { x: state.showX, y: state.showY, z: state.showZ };
  const visible = (axis: 'x' | 'y' | 'z'): boolean =>
    shown[axis] &&
    (state.mode === 'rotate' ||
      state.grab?.handle === axis ||
      Math.abs(axisIn(axis, space, placement.rotation).dot(eye)) <= hideThreshold);
  return group({
    key,
    position: placement.position,
    rotation: fixed(space === 'local' ? placement.rotation : [0, 0, 0]),
    scale: [scale, scale, scale],
    children: [
      ...axisHandles(key, state, visible),
      ...planeHandles(key, state),
      ...(state.mode === 'rotate'
        ? []
        : [
            mesh({
              key: `${key}:xyz`,
              geometry:
                state.mode === 'scale'
                  ? box({ width: 0.1, height: 0.1, depth: 0.1 })
                  : sphere({ radius: 0.06, widthSegments: 12, heightSegments: 8 }),
              material: look(state, 'xyz', 0xffffff),
              interactive: true,
            }),
          ]),
    ],
  });
};
