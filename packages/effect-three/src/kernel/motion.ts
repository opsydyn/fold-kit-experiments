/**
 * Registered behaviours: application motion as pure functions of scene time.
 *
 * A behaviour writes a pose (a position offset, a rotation and a scale factor) into a
 * reused scratch value, so ticking allocates nothing. The scene graph composes that pose
 * on top of the node's own transform each frame: position added, rotation added, scale
 * multiplied. Because the pose depends only on time and parameters, behaviours pause,
 * rewind and replay with the scene, unlike `useFrame` callbacks that mutate state.
 *
 * @module
 */
import { Vector3 } from 'three';

/** Where a behaviour writes its pose. Reset to no change before every call. */
export type BehaviourPose = {
  /** Added to the node's position, in its parent's space. */
  readonly offset: Vector3;
  /** Euler angles (radians) added to the node's rotation. */
  readonly rotation: Vector3;
  /** Multiplies the node's scale. */
  readonly scale: Vector3;
};

/** A behaviour: writes the pose for `seconds` of scene time and the node's parameters. */
export type Behaviour = (
  pose: BehaviourPose,
  seconds: number,
  params: Readonly<Record<string, number>>,
) => void;

/** A pose that changes nothing. */
export const createPose = (): BehaviourPose => ({
  offset: new Vector3(),
  rotation: new Vector3(),
  scale: new Vector3(1, 1, 1),
});

export const resetPose = (pose: BehaviourPose): void => {
  pose.offset.set(0, 0, 0);
  pose.rotation.set(0, 0, 0);
  pose.scale.set(1, 1, 1);
};

/** Maps `value` from one range to another, as three's `MathUtils.mapLinear`. */
const mapLinear = (value: number, a1: number, a2: number, b1: number, b2: number): number =>
  b1 + ((value - a1) * (b2 - b1)) / (a2 - a1);

/**
 * Drei's `Float` (`drei-main/src/core/Float.tsx` at `bf6f4ad`): a gentle bob and sway.
 * Parameters (Drei's defaults): `speed` 1, `rotationIntensity` 1, `floatIntensity` 1,
 * `low` -0.1 and `high` 0.1 (Drei's `floatingRange`), and `phase` 0 in place of Drei's
 * random start, so the motion is the same on every run.
 */
export const float: Behaviour = (pose, seconds, params) => {
  const speed = params['speed'] ?? 1;
  const turn = params['rotationIntensity'] ?? 1;
  const lift = params['floatIntensity'] ?? 1;
  const angle = (((params['phase'] ?? 0) + seconds) / 4) * speed;
  pose.rotation.set(
    (Math.cos(angle) / 8) * turn,
    (Math.sin(angle) / 8) * turn,
    (Math.sin(angle) / 20) * turn,
  );
  const y = mapLinear(
    Math.sin(angle) / 10,
    -0.1,
    0.1,
    params['low'] ?? -0.1,
    params['high'] ?? 0.1,
  );
  pose.offset.set(0, y * lift, 0);
};

/** Behaviours every scene knows without registering them. */
export const builtinBehaviours: Readonly<Record<string, Behaviour>> = { float };
