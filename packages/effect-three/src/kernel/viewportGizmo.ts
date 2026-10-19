/**
 * A viewport gizmo as data, after Drei's `GizmoHelper` with `GizmoViewport` (`bf6f4ad`,
 * `src/core/GizmoHelper.tsx`, `src/core/GizmoViewport.tsx`): three coloured axes, turned
 * as the camera sees the world, with a head at each end. Drei draws it in a `Hud` and,
 * when a head is pressed, tweens the camera to look from that axis; here
 * `viewportGizmoNodes` describes it for a scene's `hud`, `viewportAxisOf` names the head
 * a hit is on, and `cameraAlong` returns the camera looking from that axis, for the
 * Model to keep (a camera's `damping` eases it round, as Drei's tween does).
 *
 * The positive heads carry their letters, drawn with bars, as Drei's canvas textures
 * carry theirs; the negative heads are smaller and fainter, as Drei's.
 *
 * @module
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

import { basic, billboard, box, circle, fixed, group, mesh } from './build.ts';
import type { Camera, SceneNode, Vec3 } from './description.ts';

/** An axis end: a positive or negative world axis. */
export type ViewAxis = 'x' | 'y' | 'z' | '-x' | '-y' | '-z';

export type ViewportGizmoOptions = {
  /** Pixels from the middle to a head: Drei's `scale` of 40. */
  readonly size: number;
  /** The head under the pointer, drawn larger, as Drei's. */
  readonly hovered: ViewAxis | null;
  /** Leaves out the negative heads (Drei's `hideNegativeAxes`). */
  readonly hideNegativeAxes: boolean;
};

/** Drei's `axisColors`. */
const colours = { x: 0xff2060, y: 0x20df80, z: 0x2080ff } as const;
/** Drei's `labelColor`. */
const ink = 0x000000;

const directions: Record<ViewAxis, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
  '-x': [-1, 0, 0],
  '-y': [0, -1, 0],
  '-z': [0, 0, -1],
};

const axes = ['x', 'y', 'z', '-x', '-y', '-z'] as const;

/** How the camera is turned: three's `Object3D.lookAt` for a camera, up the world's y. */
const cameraTurn = (camera: Camera): Quaternion =>
  new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(
      new Vector3(...camera.position),
      new Vector3(...camera.lookAt),
      new Vector3(0, 1, 0),
    ),
  );

/** The gizmo's turn: the camera's undone, so the axes show as the camera sees the world. */
const gizmoTurn = (camera: Camera): Vec3 => {
  const turn = new Euler().setFromQuaternion(cameraTurn(camera).invert());
  return [turn.x, turn.y, turn.z];
};

/** A bar of a letter: length and angle (radians from across) in head units, at `at`. */
const stroke = (key: string, length: number, angle: number, at: readonly [number, number]) =>
  mesh({
    key,
    position: [at[0], at[1], 0.01],
    rotation: fixed([0, 0, angle]),
    geometry: box({ width: length, height: 0.07, depth: 0.001 }),
    material: basic({ color: ink }),
  });

/** The letters, in bars, about the middle of a head 0.5 across. */
const letters: Record<
  'x' | 'y' | 'z',
  ReadonlyArray<readonly [number, number, readonly [number, number]]>
> = {
  x: [
    [0.34, Math.PI / 4, [0, 0]],
    [0.34, -Math.PI / 4, [0, 0]],
  ],
  y: [
    [0.14, Math.PI / 2, [0, -0.07]],
    [0.17, Math.PI / 3, [0.04, 0.06]],
    [0.17, -Math.PI / 3, [-0.04, 0.06]],
  ],
  z: [
    [0.22, 0, [0, 0.11]],
    [0.22, 0, [0, -0.11]],
    [0.3, Math.PI / 4, [0, 0]],
  ],
};

const isPositive = (axis: ViewAxis): axis is 'x' | 'y' | 'z' => axis.length === 1;

const colourOf = (axis: ViewAxis): number =>
  colours[isPositive(axis) ? axis : (axis.slice(1) as 'x' | 'y' | 'z')];

/** Drei's head sizes: a labelled head whole, a bare one three quarters, 1.2 under the pointer. */
const headScale = (axis: ViewAxis, hovered: ViewAxis | null): number =>
  (isPositive(axis) ? 1 : 0.75) * (axis === hovered ? 1.2 : 1);

const labelOf = (key: string, axis: ViewAxis): ReadonlyArray<SceneNode> =>
  isPositive(axis)
    ? letters[axis].map(([length, angle, at], index) =>
        stroke(`${key}:${axis}:letter:${index}`, length, angle, at),
      )
    : [];

/** A head: a disc facing the eye, in its axis's colour, with its letter on it. */
const head = (key: string, axis: ViewAxis, hovered: ViewAxis | null): SceneNode => {
  const scale = headScale(axis, hovered);
  return group({
    key: `${key}:${axis}`,
    position: directions[axis],
    rotation: billboard(),
    scale: [scale, scale, scale],
    interactive: true,
    children: [
      mesh({
        key: `${key}:${axis}:disc`,
        geometry: circle({ radius: 0.25, segments: 32 }),
        material: basic({
          color: colourOf(axis),
          opacity: isPositive(axis) ? 1 : 0.75,
          transparent: !isPositive(axis),
        }),
      }),
      ...labelOf(key, axis),
    ],
  });
};

/** An axis's bar from the middle, as Drei's `Axis` (0.8 × 0.05 × 0.05). */
const bar = (key: string, axis: 'x' | 'y' | 'z'): SceneNode => {
  const [x, y, z] = directions[axis];
  return mesh({
    key: `${key}:${axis}:bar`,
    position: [x * 0.4, y * 0.4, z * 0.4],
    geometry: box({
      width: axis === 'x' ? 0.8 : 0.05,
      height: axis === 'y' ? 0.8 : 0.05,
      depth: axis === 'z' ? 0.8 : 0.05,
    }),
    material: basic({ color: colours[axis] }),
  });
};

/**
 * The gizmo for `camera`, keyed under `key` (`${key}:x`, `${key}:-y` and so on), for a
 * scene's `hud`: Drei's defaults, 40 pixels to a head, every head shown.
 */
export const viewportGizmoNodes = (
  key: string,
  camera: Camera,
  options: Partial<ViewportGizmoOptions> = {},
): SceneNode => {
  const size = options.size ?? 40;
  const hovered = options.hovered ?? null;
  const shown = options.hideNegativeAxes === true ? axes.filter(isPositive) : axes;
  return group({
    key,
    rotation: fixed(gizmoTurn(camera)),
    scale: [size, size, size],
    children: [
      bar(key, 'x'),
      bar(key, 'y'),
      bar(key, 'z'),
      ...shown.map((axis) => head(key, axis, hovered)),
    ],
  });
};

/** The head a hit `key` (or any part of one) is on, if it is one of this gizmo's. */
export const viewportAxisOf = (key: string, hit: string): ViewAxis | undefined => {
  const [owner, axis] = hit.split(':');
  if (owner !== key) return undefined;
  return axes.find((candidate) => candidate === axis);
};

/**
 * `camera` looking from `axis` at what it looks at, as far away as it was: Drei's
 * `tweenCamera` to that head, where it ends. Looking straight up or down, it stays a
 * hair off the pole toward +z, as `OrbitControls` keeps its camera off them.
 */
export const cameraAlong = <C extends Camera>(camera: C, axis: ViewAxis): C => {
  const target = new Vector3(...camera.lookAt);
  const distance = new Vector3(...camera.position).distanceTo(target);
  const direction = new Vector3(...directions[axis]);
  if (axis === 'y' || axis === '-y') direction.z = 1e-6;
  const position = direction.normalize().multiplyScalar(distance).add(target);
  return { ...camera, position: [position.x, position.y, position.z] };
};
