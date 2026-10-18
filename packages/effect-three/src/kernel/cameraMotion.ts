/**
 * How the rendered camera reaches its description: at once, or damped round its target;
 * and how it turns round its target by itself (`autoRotate`).
 *
 * Behavioural reference: three.js `examples/jsm/controls/OrbitControls.js` at 0.186.1,
 * `update` with `enableDamping`: each update closes `dampingFactor` of the remaining
 * rotation and pan. Here the remaining way to the described pose closes by that fraction
 * every sixtieth of a second of scene time, so the motion is the same at any frame rate,
 * and the camera travels round the target (azimuth the short way) rather than through it.
 * `autoRotate` is `update` with `autoRotate`: `rotateLeft` by `2π / 60 * autoRotateSpeed`
 * a second, only while no gesture is in progress (`state === NONE`).
 *
 * @module
 */
import { OrthographicCamera, type PerspectiveCamera, Spherical, Vector3 } from 'three';

import type { Camera, Vec3 } from './description.ts';

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
   * travels there. A new position, `lookAt` or zoom ends any turning (`autoRotate`).
   */
  readonly aim: (
    camera: PerspectiveCamera | OrthographicCamera,
    description: Camera,
    now: number,
    jump: boolean,
  ) => void;
  /**
   * Turns (`autoRotate`) and travels toward the aim up to scene time `now`. Returns
   * whether it is still moving.
   */
  readonly step: (camera: PerspectiveCamera | OrthographicCamera, now: number) => boolean;
  /** Lands on the aim at once. */
  readonly settle: (camera: PerspectiveCamera | OrthographicCamera) => void;
  readonly moving: () => boolean;
  /** Stops turning while `held` (a gesture is pressed), as `OrbitControls` turns only idle. */
  readonly hold: (held: boolean) => void;
  /** Where turning has taken the camera, when it has turned since its description. */
  readonly turned: () => Vec3 | undefined;
};

/** Radians a turning camera turns per second per unit of `autoRotate` (three's `2π / 60`). */
const turnRate = (2 * Math.PI) / 60;

/** Creates the motion of one camera. Allocation-free once created. */
export const createCameraMotion = (): CameraMotion => {
  const current = createPose();
  // Where the description puts the camera, and where it is going: that, turned by `spun`.
  const described = createPose();
  const goal = createPose();
  // The described position, written exactly on landing rather than through angles.
  const goalPosition = new Vector3();
  const lookAt = new Vector3();
  let shown = false;
  let easing = false;
  let damping = 0;
  let spin = 0;
  let spun = 0;
  let held = false;
  let last = 0;

  const turning = (): boolean => spin !== 0 && !held;

  const aimGoal = (): void => {
    copyPose(goal, described);
    goal.spherical.theta += spun;
  };

  const land = (camera: PerspectiveCamera | OrthographicCamera): void => {
    copyPose(current, goal);
    easing = false;
    if (spun !== 0) {
      write(camera, goal);
      return;
    }
    camera.position.copy(goalPosition);
    camera.lookAt(goal.target);
    writeZoom(camera, goal.zoom);
  };

  const settle: CameraMotion['settle'] = (camera) => {
    if (shown) land(camera);
  };

  /** Whether `description` puts the camera somewhere other than the last description did. */
  const moved = (description: Camera): boolean =>
    !shown ||
    !goalPosition.equals(position.fromArray(description.position)) ||
    !described.target.equals(lookAt.fromArray(description.lookAt)) ||
    described.zoom !== (description._tag === 'Orthographic' ? description.zoom : 1);

  /** One step of easing toward the goal, `seconds` after the last. */
  const ease = (camera: PerspectiveCamera | OrthographicCamera, seconds: number): void => {
    const remaining = (1 - damping) ** (seconds * 60);
    const k = 1 - remaining;
    current.target.lerp(goal.target, k);
    current.spherical.radius += (goal.spherical.radius - current.spherical.radius) * k;
    current.spherical.phi += (goal.spherical.phi - current.spherical.phi) * k;
    current.spherical.theta += turn(current.spherical.theta, goal.spherical.theta) * k;
    current.zoom += (goal.zoom - current.zoom) * k;
    if (remaining < 1e-4 || settled(current, goal)) land(camera);
    else write(camera, current);
  };

  return {
    aim: (camera, description, now, jump) => {
      if (moved(description)) spun = 0;
      readPose(described, description);
      goalPosition.fromArray(description.position);
      damping = description.damping;
      spin = description.autoRotate;
      last = now;
      aimGoal();
      if (jump || damping === 0 || !shown) {
        shown = true;
        land(camera);
        return;
      }
      easing = !settled(current, goal);
    },
    step: (camera, now) => {
      const seconds = Math.max(0, now - last);
      last = now;
      if (turning() && seconds > 0) {
        // Clockwise seen from above for a positive speed, as `rotateLeft` turns.
        spun -= turnRate * spin * seconds;
        aimGoal();
        easing = damping !== 0;
        if (!easing) land(camera);
      }
      if (easing) ease(camera, seconds);
      return easing || turning();
    },
    settle,
    moving: () => easing || turning(),
    hold: (next) => {
      held = next;
    },
    turned: () => {
      if (spun === 0) return undefined;
      position.setFromSpherical(goal.spherical).add(goal.target);
      return [position.x, position.y, position.z];
    },
  };
};
