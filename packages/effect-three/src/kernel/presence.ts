/**
 * Other players in a shared immersive scene: where a player's head and hands are, as an
 * immersive session reports them (`xr({ poses })`, `XrPoses` events), and an avatar that
 * shows them to everyone else.
 *
 * Poses are latest-wins state, not inputs: a peer shows the newest pose it has heard from
 * each other player and drops the rest, so they travel beside a lockstep session rather
 * than through its turns (ADR-020). Each part of an avatar eases to its new place over
 * the report interval, so a player moves smoothly between reports, as networked
 * avatars interpolate between updates.
 *
 * @module
 */
import { Euler, Quaternion } from 'three';

import { ease, group, mesh, sphere, standard, fixed, box } from './build.ts';
import type { GroupNode, MeshNode, Rgb, SceneNode, Vec3 } from './description.ts';
import type { BodyPose } from './physics.ts';

/** Where a player's head and hands are, in the scene's space (`XrPoses` events). */
export type XrPoses = {
  readonly head: BodyPose;
  /** The left hand's grip (a controller held, or a tracked hand), `null` if not tracked. */
  readonly left: BodyPose | null;
  readonly right: BodyPose | null;
};

export type AvatarOptions = {
  readonly color: Rgb;
  /** How long each part eases to a new pose: the interval poses are reported at. */
  readonly seconds: number;
};

const turned = new Quaternion();
const angles = new Euler();

/** A pose's rotation as the Euler angles scene nodes take. */
const eulerOf = (pose: BodyPose): Vec3 => {
  angles.setFromQuaternion(turned.fromArray([...pose.quaternion]));
  // `+ 0` turns −0 into 0, so an avatar reads back from JSON as it was made.
  return [angles.x + 0, angles.y + 0, angles.z + 0];
};

/** A part of an avatar, at `pose`, easing there over `seconds`. */
const part = (
  key: string,
  pose: BodyPose,
  seconds: number,
  children: ReadonlyArray<SceneNode>,
): GroupNode =>
  group({
    key,
    position: pose.position,
    rotation: fixed(eulerOf(pose)),
    transition: ease({ seconds, easing: 'linear' }),
    children,
  });

const hand = (key: string, color: Rgb): MeshNode =>
  mesh({ key, geometry: sphere({ radius: 0.045 }), material: standard({ color, roughness: 0.6 }) });

/**
 * Another player, keyed `key`: a head with a visor facing where they look, and a sphere
 * for each hand they have tracked, where `poses` puts them. Defaults: light grey, easing
 * over a twentieth of a second (`xr({ poses: 0.05 })`).
 */
export const avatar = (
  key: string,
  poses: XrPoses,
  options: Partial<AvatarOptions> = {},
): GroupNode => {
  const color = options.color ?? 0xd8d8d8;
  const seconds = options.seconds ?? 0.05;
  const head = part(`${key}-head`, poses.head, seconds, [
    mesh({
      key: `${key}-skull`,
      geometry: box({ width: 0.18, height: 0.22, depth: 0.2 }),
      material: standard({ color, roughness: 0.6 }),
    }),
    // The viewer looks down its own −z: the visor is on that face.
    mesh({
      key: `${key}-visor`,
      position: [0, 0.02, -0.1],
      geometry: box({ width: 0.16, height: 0.07, depth: 0.02 }),
      material: standard({ color: 0x1a1a22, roughness: 0.2 }),
    }),
  ]);
  const hands = [
    ...(poses.left === null
      ? []
      : [part(`${key}-left`, poses.left, seconds, [hand(`${key}-left-hand`, color)])]),
    ...(poses.right === null
      ? []
      : [part(`${key}-right`, poses.right, seconds, [hand(`${key}-right-hand`, color)])]),
  ];
  return group({ key, children: [head, ...hands] });
};
