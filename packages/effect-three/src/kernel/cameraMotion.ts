/**
 * How the rendered camera reaches its description: at once, or damped round its target.
 *
 * Behavioural reference: three.js `examples/jsm/controls/OrbitControls.js` at 0.186.1,
 * `update` with `enableDamping`: each update closes `dampingFactor` of the remaining
 * rotation and pan. Here the remaining way to the described pose closes by that fraction
 * every sixtieth of a second of scene time, so the motion is the same at any frame rate,
 * and the camera travels round the target (azimuth the short way) rather than through it.
 *
 * @module
 */
import { OrthographicCamera, type PerspectiveCamera, Spherical, Vector3 } from 'three';

import type { Camera } from './description.ts';

type Pose = { readonly target: Vector3; readonly spherical: Spherical; zoom: number };

const createPose = (): Pose => ({ target: new Vector3(), spherical: new Spherical(), zoom: 1 });

const offset = new Vector3();
const position = new Vector3();

const readPose = (pose: Pose, description: Camera): void => {
  pose.target.fromArray(description.lookAt);
  offset.fromArray(description.position).sub(pose.target);
  pose.spherical.setFromVector3(offset);
  pose.zoom = description._tag === 'Orthographic' ? description.zoom : 1;
};

const copyPose = (to: Pose, from: Pose): void => {
  to.target.copy(from.target);
  to.spherical.copy(from.spherical);
  to.zoom = from.zoom;
};

/** The signed angle from `from` to `to`, the short way round: within ±π. */
const turn = (from: number, to: number): number => {
  const difference = (to - from) % (2 * Math.PI);
  if (difference > Math.PI) return difference - 2 * Math.PI;
  if (difference < -Math.PI) return difference + 2 * Math.PI;
  return difference;
};

/** Close enough to the aim that the rest is invisible: snap and stop. */
const settled = (current: Pose, goal: Pose): boolean => {
  const scale = Math.max(1, goal.spherical.radius);
  return (
    current.target.distanceTo(goal.target) < 1e-5 * scale &&
    Math.abs(current.spherical.radius - goal.spherical.radius) < 1e-5 * scale &&
    Math.abs(turn(current.spherical.theta, goal.spherical.theta)) < 1e-6 &&
    Math.abs(current.spherical.phi - goal.spherical.phi) < 1e-6 &&
    Math.abs(current.zoom - goal.zoom) < 1e-6 * goal.zoom
  );
};

function writeZoom(camera: PerspectiveCamera | OrthographicCamera, zoom: number): void {
  if (!(camera instanceof OrthographicCamera) || camera.zoom === zoom) return;
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
}

/** Writes a pose to a host camera. */
const write = (camera: PerspectiveCamera | OrthographicCamera, pose: Pose): void => {
  position.setFromSpherical(pose.spherical).add(pose.target);
  camera.position.copy(position);
  camera.lookAt(pose.target);
  writeZoom(camera, pose.zoom);
};

export type CameraMotion = {
  /**
   * Aims at a described pose at scene time `now`. It is shown at once when `jump` is
   * true, the camera has no damping, or nothing was shown before; otherwise `step`
   * travels there.
   */
  readonly aim: (
    camera: PerspectiveCamera | OrthographicCamera,
    description: Camera,
    now: number,
    jump: boolean,
  ) => void;
  /** Travels toward the aim up to scene time `now`. Returns whether it is still moving. */
  readonly step: (camera: PerspectiveCamera | OrthographicCamera, now: number) => boolean;
  /** Lands on the aim at once. */
  readonly settle: (camera: PerspectiveCamera | OrthographicCamera) => void;
  readonly moving: () => boolean;
};

/** Creates the motion of one camera. Allocation-free once created. */
export const createCameraMotion = (): CameraMotion => {
  const current = createPose();
  const goal = createPose();
  // The described position, written exactly on landing rather than through angles.
  const goalPosition = new Vector3();
  let shown = false;
  let moving = false;
  let damping = 0;
  let last = 0;

  const settle: CameraMotion['settle'] = (camera) => {
    if (!shown) return;
    copyPose(current, goal);
    moving = false;
    camera.position.copy(goalPosition);
    camera.lookAt(goal.target);
    writeZoom(camera, goal.zoom);
  };

  return {
    aim: (camera, description, now, jump) => {
      readPose(goal, description);
      goalPosition.fromArray(description.position);
      damping = description.damping;
      last = now;
      if (jump || damping === 0 || !shown) {
        shown = true;
        settle(camera);
        return;
      }
      moving = !settled(current, goal);
    },
    step: (camera, now) => {
      if (!moving) return false;
      const remaining = (1 - damping) ** (Math.max(0, now - last) * 60);
      last = now;
      if (remaining < 1e-4) {
        settle(camera);
        return false;
      }
      const k = 1 - remaining;
      current.target.lerp(goal.target, k);
      current.spherical.radius += (goal.spherical.radius - current.spherical.radius) * k;
      current.spherical.phi += (goal.spherical.phi - current.spherical.phi) * k;
      current.spherical.theta += turn(current.spherical.theta, goal.spherical.theta) * k;
      current.zoom += (goal.zoom - current.zoom) * k;
      if (settled(current, goal)) {
        settle(camera);
        return false;
      }
      write(camera, current);
      return true;
    },
    settle,
    moving: () => moving,
  };
};
