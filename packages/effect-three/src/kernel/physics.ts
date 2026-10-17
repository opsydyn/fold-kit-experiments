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
import { type BufferGeometry, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from 'three';

import type { Body, BodyCollider, JointKind, Physics, Vec3 } from './description.ts';

/** A quaternion, `[x, y, z, w]`. */
export type Quat = readonly [x: number, y: number, z: number, w: number];

/** Where a body is, in world space. */
export type BodyPose = { readonly position: Vec3; readonly quaternion: Quat };

/** A collider's shape, scaled as its mesh is, centred on its own origin. */
export type ColliderShape =
  | { readonly _tag: 'Cuboid'; readonly halfExtents: Vec3 }
  | { readonly _tag: 'Ball'; readonly radius: number }
  | { readonly _tag: 'Hull'; readonly points: Float32Array }
  | { readonly _tag: 'Trimesh'; readonly vertices: Float32Array; readonly indices: Uint32Array };

/** A collider placed in its body's space: one per mesh in the body. */
export type Collider = {
  readonly shape: ColliderShape;
  readonly translation: Vec3;
  readonly rotation: Quat;
};

/**
 * Two bodies began (`started`) or stopped touching, by the ids they were added with: a
 * node's key, or for an instance the node's and instance's keys joined by a NUL.
 */
export type Collision = { readonly a: string; readonly b: string; readonly started: boolean };

/** A joint as an engine makes it: a fixed joint's frames as quaternions. */
export type PhysicsJoint = {
  readonly anchorA: Vec3;
  readonly anchorB: Vec3;
  readonly contacts: boolean;
  readonly kind:
    | Exclude<JointKind, { readonly _tag: 'Fixed' }>
    | { readonly _tag: 'Fixed'; readonly frameA: Quat; readonly frameB: Quat };
};

/** One physics world, its bodies keyed by id. Every method is synchronous. */
export type PhysicsWorld = {
  readonly configure: (physics: Physics) => void;
  /** Adds a body with its colliders (none, for a model not yet loaded). */
  readonly add: (
    key: string,
    body: Body,
    colliders: ReadonlyArray<Collider>,
    pose: BodyPose,
  ) => void;
  /** Applies a body's settings that need no new collider: type, mass, friction and so on. */
  readonly update: (key: string, body: Body) => void;
  /** Puts a body at `pose`, at rest. */
  readonly teleport: (key: string, pose: BodyPose) => void;
  /** Where a kinematic body is to be after the next step. */
  readonly moveKinematic: (key: string, pose: BodyPose) => void;
  readonly applyImpulse: (key: string, impulse: Vec3) => void;
  /** Removes a body, and any joint holding it. */
  readonly remove: (key: string) => void;
  /** Joins bodies `a` and `b` (both added). */
  readonly addJoint: (id: string, joint: PhysicsJoint, a: string, b: string) => void;
  /** Removes a joint; nothing if it is gone already (with one of its bodies). */
  readonly removeJoint: (id: string) => void;
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

/** A tiny ball for an empty geometry (text before its font, say). */
const speck: { readonly shape: ColliderShape; readonly offset: Vector3 } = {
  shape: { _tag: 'Ball', radius: 1e-3 },
  offset: new Vector3(),
};

/**
 * The shape for a geometry at world `scale`, and where its centre is (scaled), as
 * react-three-rapier's `getColliderArgsFromGeometry` sizes auto colliders.
 */
const shapeFor = (
  geometry: BufferGeometry,
  collider: BodyCollider,
  scale: Vector3,
): { readonly shape: ColliderShape; readonly offset: Vector3 } => {
  if (geometry.getAttribute('position') === undefined) return speck;
  switch (collider) {
    case 'cuboid': {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box === null) return speck;
      box.getSize(size).multiply(scale).multiplyScalar(0.5);
      return {
        shape: { _tag: 'Cuboid', halfExtents: toVec3(size) },
        offset: box.getCenter(new Vector3()).multiply(scale),
      };
    }
    case 'ball': {
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (sphere === null) return speck;
      const largest = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
      return {
        shape: { _tag: 'Ball', radius: sphere.radius * largest },
        offset: sphere.center.clone().multiply(scale),
      };
    }
    case 'hull':
      return {
        shape: { _tag: 'Hull', points: scaledPositions(geometry, scale) },
        offset: new Vector3(),
      };
    case 'trimesh':
      return {
        shape: {
          _tag: 'Trimesh',
          vertices: scaledPositions(geometry, scale),
          indices: triangles(geometry),
        },
        offset: new Vector3(),
      };
  }
};

/**
 * The collider for one geometry at world `scale`, centred where its geometry is: what a
 * mesh with a body of its own gets.
 */
export const colliderFor = (
  geometry: BufferGeometry,
  collider: BodyCollider,
  scale: Vector3,
): Collider => {
  const { shape, offset } = shapeFor(geometry, collider, scale);
  return { shape, translation: toVec3(offset), rotation: [0, 0, 0, 1] };
};

const relative = new Matrix4();
const bodyInverse = new Matrix4();
const where = new Vector3();
const turn = new Quaternion();
const relativeScale = new Vector3();
const worldScale = new Vector3();
const worldPosition = new Vector3();
const worldTurn = new Quaternion();

const isMesh = (object: Object3D): object is Mesh => 'isMesh' in object && object.isMesh === true;

/** A mesh's collider in the body whose inverse world matrix is `bodyInverse`. */
function placedCollider(child: Mesh, collider: BodyCollider): Collider {
  child.matrixWorld.decompose(worldPosition, worldTurn, worldScale);
  relative.copy(child.matrixWorld).premultiply(bodyInverse).decompose(where, turn, relativeScale);
  const { shape, offset } = shapeFor(child.geometry, collider, worldScale);
  where.add(offset.applyQuaternion(turn));
  return { shape, translation: toVec3(where), rotation: [turn.x, turn.y, turn.z, turn.w] };
}

/**
 * A number as signature text, to five places with `-0` as `0`: the simulation turns a body,
 * and its matrices pick up rounding that must not read as a change of shape.
 */
const settled = (value: number): string => (Math.round(value * 1e5) / 1e5 || 0).toString();

/** A mesh's geometry and placement in the body whose inverse is `bodyInverse`. */
function meshSignature(child: Mesh): string {
  relative.copy(child.matrixWorld).premultiply(bodyInverse);
  child.matrixWorld.decompose(worldPosition, worldTurn, worldScale);
  const placed = relative.elements.map(settled).join(',');
  return `${child.geometry.uuid}:${placed}:${worldScale.toArray().map(settled).join(',')}`;
}

/** The visible meshes in `body`, itself included. */
function visibleMeshes(body: Object3D): ReadonlyArray<Mesh> {
  const meshes: Array<Mesh> = [];
  body.traverseVisible((child) => {
    if (isMesh(child)) meshes.push(child);
  });
  return meshes;
}

/**
 * A collider for every visible mesh in `body` (itself included), placed by its transform
 * relative to the body and sized by its world scale, as react-three-rapier's
 * `createColliderPropsFromChildren` makes a group's or a model's colliders. Unlike there,
 * a geometry's off-centre middle is turned with its mesh.
 */
export const collidersFor = (body: Object3D, collider: BodyCollider): ReadonlyArray<Collider> => {
  body.updateWorldMatrix(true, true);
  bodyInverse.copy(body.matrixWorld).invert();
  return visibleMeshes(body).map((child) => placedCollider(child, collider));
};

/**
 * What a body's colliders are made from: each visible mesh's geometry and placement.
 * When it changes, the colliders must be made again.
 */
export const colliderSignature = (body: Object3D): string => {
  body.updateWorldMatrix(true, true);
  bodyInverse.copy(body.matrixWorld).invert();
  return visibleMeshes(body).map(meshSignature).join('|');
};
