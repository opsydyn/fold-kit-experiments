/**
 * The kernel's side of physics: an engine-neutral world contract, and colliders worked
 * out from geometry. An engine package (Rapier, in `@opsydyn/effect-three-rapier`)
 * implements `PhysicsEngine`; the scene graph steps it and moves meshes to its poses.
 *
 * Behavioural reference: react-three-rapier at `ae5c3fe` (2.2.0):
 * `getColliderArgsFromGeometry` in `src/utils/utils-collider.ts` for colliders (a cuboid
 * from the bounding box, a ball from the bounding sphere, a hull or trimesh from the
 * vertices, each scaled by the mesh's world scale), and the step loop in
 * `src/components/Physics.tsx` (fixed steps, delta clamped to 0.5 s, poses interpolated
 * between the last two steps).
 *
 * @module
 */
import { type BufferGeometry, Vector3 } from 'three';

import type { Body, BodyCollider, Physics, Vec3 } from './description.ts';

/** A quaternion, `[x, y, z, w]`. */
export type Quat = readonly [x: number, y: number, z: number, w: number];

/** Where a body is, in world space. */
export type BodyPose = { readonly position: Vec3; readonly quaternion: Quat };

/** A collider in the body's own space, scaled as the mesh is. */
export type ColliderShape =
  | { readonly _tag: 'Cuboid'; readonly halfExtents: Vec3; readonly offset: Vec3 }
  | { readonly _tag: 'Ball'; readonly radius: number; readonly offset: Vec3 }
  | { readonly _tag: 'Hull'; readonly points: Float32Array }
  | { readonly _tag: 'Trimesh'; readonly vertices: Float32Array; readonly indices: Uint32Array };

/** Two bodies began (`started`) or stopped touching, by their nodes' keys. */
export type Collision = { readonly a: string; readonly b: string; readonly started: boolean };

/** One physics world, keyed by node. Every method is synchronous. */
export type PhysicsWorld = {
  readonly configure: (physics: Physics) => void;
  readonly add: (key: string, body: Body, shape: ColliderShape, pose: BodyPose) => void;
  /** Applies a body's settings that need no new collider: type, mass, friction and so on. */
  readonly update: (key: string, body: Body) => void;
  /** Puts a body at `pose`, at rest. */
  readonly teleport: (key: string, pose: BodyPose) => void;
  /** Where a kinematic body is to be after the next step. */
  readonly moveKinematic: (key: string, pose: BodyPose) => void;
  readonly applyImpulse: (key: string, impulse: Vec3) => void;
  readonly remove: (key: string) => void;
  /** Advances by `seconds` and returns the collisions that began or ended. */
  readonly step: (seconds: number) => ReadonlyArray<Collision>;
  readonly pose: (key: string) => BodyPose | undefined;
  /** Whether any dynamic body is still moving (not asleep). */
  readonly awake: () => boolean;
  readonly dispose: () => void;
};

/** Makes physics worlds. Provide one to the scene graph (in Foldkit, the environment). */
export type PhysicsEngine = { readonly createWorld: (physics: Physics) => PhysicsWorld };

const toVec3 = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

const size = new Vector3();
const center = new Vector3();

/** The geometry's positions, scaled. */
const scaledPositions = (geometry: BufferGeometry, scale: Vector3): Float32Array => {
  const positions = geometry.getAttribute('position');
  const points = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    points[i * 3] = positions.getX(i) * scale.x;
    points[i * 3 + 1] = positions.getY(i) * scale.y;
    points[i * 3 + 2] = positions.getZ(i) * scale.z;
  }
  return points;
};

/** Triangle indices: the geometry's own, or one triangle per three positions. */
const triangles = (geometry: BufferGeometry): Uint32Array => {
  const index = geometry.getIndex();
  if (index !== null) return Uint32Array.from(index.array);
  return Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
};

/**
 * The collider for a mesh's geometry at its world `scale`, as react-three-rapier makes
 * auto colliders. An empty geometry (text before its font, say) gives a tiny ball.
 */
export const colliderFor = (
  geometry: BufferGeometry,
  collider: BodyCollider,
  scale: Vector3,
): ColliderShape => {
  if (geometry.getAttribute('position') === undefined) {
    return { _tag: 'Ball', radius: 1e-3, offset: [0, 0, 0] };
  }
  switch (collider) {
    case 'cuboid': {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box === null) return { _tag: 'Ball', radius: 1e-3, offset: [0, 0, 0] };
      box.getSize(size).multiply(scale).multiplyScalar(0.5);
      box.getCenter(center).multiply(scale);
      return { _tag: 'Cuboid', halfExtents: toVec3(size), offset: toVec3(center) };
    }
    case 'ball': {
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (sphere === null) return { _tag: 'Ball', radius: 1e-3, offset: [0, 0, 0] };
      center.copy(sphere.center).multiply(scale);
      const largest = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
      return { _tag: 'Ball', radius: sphere.radius * largest, offset: toVec3(center) };
    }
    case 'hull':
      return { _tag: 'Hull', points: scaledPositions(geometry, scale) };
    case 'trimesh':
      return {
        _tag: 'Trimesh',
        vertices: scaledPositions(geometry, scale),
        indices: triangles(geometry),
      };
  }
};
