/**
 * Orbit controls as data: pure functions from a camera and a gesture to the next camera.
 * The camera stays in the application's Model; a `Gesture` Message carries the input and
 * `orbit` applies it, so time travel, undo and persistence see every camera move.
 *
 * Behavioural reference: three.js `examples/jsm/controls/OrbitControls.js` at 0.186.1,
 * the class Drei's `OrbitControls` wraps (`drei-main/src/core/OrbitControls.tsx` at
 * `bf6f4ad`). As there:
 *
 * - The camera circles its `lookAt` point (the target) with world up `+y`.
 * - Left drag rotates (with shift, control or meta: pans), middle drag dollies, right
 *   drag pans (with a modifier: rotates). One finger rotates; two pinch and pan.
 * - A full drag across the height of the area turns the camera once round (`rotateSpeed`
 *   1). Wheel and dolly steps scale the distance by `0.95 ^ (zoomSpeed * |delta| / 100)`;
 *   orthographic cameras change `zoom` instead.
 * - Panning moves target and camera together, by the distance under the pointer.
 * - Polar and azimuth limits, distance and zoom limits are applied after every step.
 *
 * Unlike three's controls these hold no state between calls; smoothing is the camera's
 * own `damping`, which the scene applies to the rendered camera.
 *
 * @module
 */
import { Matrix4, Spherical, Vector3 } from 'three';

import type { Camera, Vec3 } from './description.ts';
import type { Gesture, Modifiers } from './pointer.ts';

/** How `orbit` reads gestures: speeds and limits, as three.js's `OrbitControls`. */
export type OrbitOptions = {
  readonly enableRotate: boolean;
  readonly enableZoom: boolean;
  readonly enablePan: boolean;
  readonly rotateSpeed: number;
  readonly zoomSpeed: number;
  readonly panSpeed: number;
  /** Pan in the screen's plane (`true`, the default) or along the ground (`false`). */
  readonly screenSpacePanning: boolean;
  /** Perspective cameras: the closest and furthest distance from the target. */
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Orthographic cameras: the smallest and largest `zoom`. */
  readonly minZoom: number;
  readonly maxZoom: number;
  /** Radians from straight above (0) to straight below (π). */
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
  /** Radians around the vertical axis; infinite (the default) for no limit. */
  readonly minAzimuthAngle: number;
  readonly maxAzimuthAngle: number;
};

/** three.js's `OrbitControls` defaults. */
export const defaultOrbit: OrbitOptions = {
  enableRotate: true,
  enableZoom: true,
  enablePan: true,
  rotateSpeed: 1,
  zoomSpeed: 1,
  panSpeed: 1,
  screenSpacePanning: true,
  minDistance: 0,
  maxDistance: Infinity,
  minZoom: 0,
  maxZoom: Infinity,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
};

/** Orbit options: three.js's defaults with yours on top. */
export const orbitOptions = (options: Partial<OrbitOptions> = {}): OrbitOptions => ({
  ...defaultOrbit,
  ...options,
});

const twoPi = 2 * Math.PI;

// Scratch values, so a step allocates only the camera it returns.
const offset = new Vector3();
const spherical = new Spherical();
const target = new Vector3();
const position = new Vector3();
const axis = new Vector3();
const panOffset = new Vector3();
const basis = new Matrix4();
const worldUp = new Vector3(0, 1, 0);

const toVec3 = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

/** Clamps an azimuth to limits that may wrap past ±π (OrbitControls' `update`). */
const clampAzimuth = (theta: number, options: OrbitOptions): number => {
  let min = options.minAzimuthAngle;
  let max = options.maxAzimuthAngle;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return theta;
  if (min < -Math.PI) min += twoPi;
  else if (min > Math.PI) min -= twoPi;
  if (max < -Math.PI) max += twoPi;
  else if (max > Math.PI) max -= twoPi;
  if (min <= max) return Math.max(min, Math.min(max, theta));
  return theta > (min + max) / 2 ? Math.max(min, theta) : Math.min(max, theta);
};

const clampDistance = (distance: number, options: OrbitOptions): number =>
  Math.max(options.minDistance, Math.min(options.maxDistance, distance));

/** Brings `spherical` within the limits, as every OrbitControls `update` does. */
const limit = (options: OrbitOptions): void => {
  spherical.theta = clampAzimuth(spherical.theta, options);
  spherical.phi = Math.max(options.minPolarAngle, Math.min(options.maxPolarAngle, spherical.phi));
  spherical.makeSafe();
  spherical.radius = clampDistance(spherical.radius, options);
};

/**
 * Reads the camera's offset from its target into `spherical`, within the limits: a
 * camera outside them starts from where the controls would first put it.
 */
const readSpherical = (camera: Camera, options: OrbitOptions): void => {
  target.fromArray(camera.lookAt);
  offset.fromArray(camera.position).sub(target);
  spherical.setFromVector3(offset);
  limit(options);
};

/** The camera placed at `spherical` around `target`, within the limits, with `zoom`. */
const place = (camera: Camera, options: OrbitOptions, zoom: number): Camera => {
  limit(options);
  position.setFromSpherical(spherical).add(target);
  const lookAt = toVec3(target);
  return camera._tag === 'Perspective'
    ? { ...camera, position: toVec3(position), lookAt }
    : {
        ...camera,
        position: toVec3(position),
        lookAt,
        zoom: clampZoom(zoom, options),
      };
};

const clampZoom = (zoom: number, options: OrbitOptions): number =>
  Math.max(options.minZoom, Math.min(options.maxZoom, zoom));

/** An orthographic camera's zoom within the limits; 1 for a perspective camera. */
const zoomOf = (camera: Camera, options: OrbitOptions): number =>
  camera._tag === 'Orthographic' ? clampZoom(camera.zoom, options) : 1;

/**
 * Turns the camera round its target by a drag of `deltaX`, `deltaY` CSS pixels over an
 * area `height` pixels tall: a drag the full height turns it once round.
 */
export const rotateCamera = (
  camera: Camera,
  deltaX: number,
  deltaY: number,
  height: number,
  options: OrbitOptions = defaultOrbit,
): Camera => {
  readSpherical(camera, options);
  const scale = (twoPi * options.rotateSpeed) / Math.max(1, height);
  spherical.theta -= deltaX * scale;
  spherical.phi -= deltaY * scale;
  return place(camera, options, zoomOf(camera, options));
};

/**
 * Scales the camera's distance from its target by `scale` (below 1 moves closer). An
 * orthographic camera keeps its distance and divides its `zoom` by `scale` instead.
 */
export const dollyCamera = (
  camera: Camera,
  scale: number,
  options: OrbitOptions = defaultOrbit,
): Camera => {
  readSpherical(camera, options);
  if (camera._tag === 'Perspective') spherical.radius *= scale;
  return place(camera, options, zoomOf(camera, options) / scale);
};

/**
 * Moves the camera and its target together by a drag of `deltaX`, `deltaY` CSS pixels
 * over an area `width` by `height`: the scene follows the pointer at the target's depth.
 */
export const panCamera = (
  camera: Camera,
  deltaX: number,
  deltaY: number,
  area: { readonly width: number; readonly height: number },
  options: OrbitOptions = defaultOrbit,
): Camera => {
  readSpherical(camera, options);
  position.setFromSpherical(spherical).add(target);
  basis.lookAt(position, target, worldUp);
  const dx = deltaX * options.panSpeed;
  const dy = deltaY * options.panSpeed;
  // World units per CSS pixel at the target's depth.
  const left =
    camera._tag === 'Perspective'
      ? (2 * dx * spherical.radius * Math.tan((camera.fov / 2) * (Math.PI / 180))) /
        Math.max(1, area.height)
      : dx / zoomOf(camera, options);
  const up =
    camera._tag === 'Perspective'
      ? (2 * dy * spherical.radius * Math.tan((camera.fov / 2) * (Math.PI / 180))) /
        Math.max(1, area.height)
      : dy / zoomOf(camera, options);
  panOffset.setFromMatrixColumn(basis, 0).multiplyScalar(-left);
  if (options.screenSpacePanning) {
    axis.setFromMatrixColumn(basis, 1);
  } else {
    axis.setFromMatrixColumn(basis, 0);
    axis.crossVectors(worldUp, axis);
  }
  panOffset.addScaledVector(axis, up);
  target.add(panOffset);
  return place(camera, options, zoomOf(camera, options));
};

/** `0.95 ^ (zoomSpeed * |delta| / 100)`: OrbitControls' `_getZoomScale`. */
const zoomScale = (delta: number, options: OrbitOptions): number =>
  0.95 ** (options.zoomSpeed * Math.abs(delta * 0.01));

/** A dolly by a wheel or vertical drag of `delta` pixels: up or forward moves closer. */
const dollyBy = (camera: Camera, delta: number, options: OrbitOptions): Camera => {
  if (delta === 0 || !options.enableZoom) return camera;
  const scale = zoomScale(delta, options);
  return dollyCamera(camera, delta < 0 ? scale : 1 / scale, options);
};

const modified = (modifiers: Modifiers): boolean =>
  modifiers.shift || modifiers.control || modifiers.meta;

type DragGesture = Extract<Gesture, { readonly _tag: 'Drag' }>;

const rotateBy = (camera: Camera, gesture: DragGesture, options: OrbitOptions): Camera =>
  options.enableRotate
    ? rotateCamera(camera, gesture.deltaX, gesture.deltaY, gesture.height, options)
    : camera;

const panBy = (
  camera: Camera,
  gesture: Extract<Gesture, { readonly deltaX: number }>,
  options: OrbitOptions,
): Camera =>
  options.enablePan ? panCamera(camera, gesture.deltaX, gesture.deltaY, gesture, options) : camera;

/** A drag by button: left rotates, middle dollies, right pans; a modifier swaps the two. */
const drag = (camera: Camera, gesture: DragGesture, options: OrbitOptions): Camera => {
  switch (gesture.button) {
    case 0:
      return modified(gesture.modifiers)
        ? panBy(camera, gesture, options)
        : rotateBy(camera, gesture, options);
    case 1:
      return dollyBy(camera, gesture.deltaY, options);
    case 2:
      return modified(gesture.modifiers)
        ? rotateBy(camera, gesture, options)
        : panBy(camera, gesture, options);
    default:
      return camera;
  }
};

/**
 * The camera after one gesture, as three.js's `OrbitControls` would move it. Apply it in
 * `update` and keep the result in the Model:
 *
 * ```ts
 * GotGesture: ({ gesture }) => ({ model: { ...model, camera: orbit(model.camera, gesture) } })
 * ```
 *
 * A wheel with control held (how trackpads report a pinch) dollies ten times as far.
 */
export const orbit = (
  camera: Camera,
  gesture: Gesture,
  options: OrbitOptions = defaultOrbit,
): Camera => {
  switch (gesture._tag) {
    case 'Drag':
      return drag(camera, gesture, options);
    case 'Wheel':
      return dollyBy(
        camera,
        gesture.modifiers.control ? gesture.deltaY * 10 : gesture.deltaY,
        options,
      );
    case 'Pinch': {
      const dollied =
        options.enableZoom && gesture.scale > 0
          ? dollyCamera(camera, 1 / gesture.scale ** options.zoomSpeed, options)
          : camera;
      return panBy(dollied, gesture, options);
    }
  }
};
