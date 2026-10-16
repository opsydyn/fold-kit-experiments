/**
 * Rigid bodies for a scene graph's meshes: a physics world kept in step with the
 * description, advanced on scene time, its poses written back to the meshes.
 *
 * Behavioural reference: react-three-rapier at `ae5c3fe`, `src/components/Physics.tsx`:
 * fixed steps from an accumulator, the frame delta clamped to 0.5 s, nothing stepped while
 * paused, and each mesh placed between its last two simulated poses (`interpolate`),
 * converted from world space into its parent's space.
 *
 * @module
 */
import { Euler, Matrix4, type Mesh, type Object3D, Quaternion, type Scene, Vector3 } from 'three';

import type { Body, MeshNode, Physics } from './description.ts';
import {
  bodyEquals,
  geometryRefEquals,
  physicsEquals,
  rotationEquals,
  vec3Equals,
} from './equality.ts';
import {
  type BodyPose,
  type Collision,
  colliderFor,
  type PhysicsEngine,
  type PhysicsWorld,
} from './physics.ts';

/** A mesh that may have a body: its key, description and hosted object. */
export type BodiedMesh = { readonly key: string; readonly node: MeshNode; readonly object: Mesh };

type Hosted = {
  readonly object: Mesh;
  node: MeshNode;
  previous: BodyPose;
  current: BodyPose;
};

export type BodyHost = {
  /** Brings the world in line with the description's physics and its meshes' bodies. */
  readonly sync: (physics: Physics | null, meshes: Iterable<BodiedMesh>) => void;
  /** Steps the world to scene time `elapsed` and moves dynamic meshes to their poses. */
  readonly tick: (elapsed: number, animating: boolean) => void;
  /** Whether the simulation still moves anything. */
  readonly needsFrame: () => boolean;
  /** Collisions since the last call. */
  readonly drainCollisions: () => ReadonlyArray<Collision>;
  readonly dispose: () => void;
};

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();
const parentInverse = new Matrix4();
const euler = new Euler();
const from = new Quaternion();
const to = new Quaternion();

const poseOf = (object: Object3D): BodyPose => {
  object.matrixWorld.decompose(position, quaternion, scale);
  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
};

const worldScale = (object: Object3D): Vector3 => {
  object.matrixWorld.decompose(position, quaternion, scale);
  return scale.clone();
};

/**
 * The world pose a node's description puts it at: its position and fixed rotation (or
 * the rotation shown, for a spin) in its parent's space.
 */
const describedPose = (object: Object3D, node: MeshNode): BodyPose => {
  position.fromArray(node.position);
  if (node.rotation._tag === 'Fixed')
    quaternion.setFromEuler(euler.fromArray([...node.rotation.euler]));
  else quaternion.copy(object.quaternion);
  matrix.compose(position, quaternion, object.scale);
  if (object.parent !== null) matrix.premultiply(object.parent.matrixWorld);
  matrix.decompose(position, quaternion, scale);
  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
};

/** Writes a world pose to an object, in its parent's space, keeping its scale. */
const place = (object: Object3D, pose: BodyPose): void => {
  object.matrixWorld.decompose(position, quaternion, scale);
  position.fromArray(pose.position);
  quaternion.fromArray(pose.quaternion);
  matrix.compose(position, quaternion, scale);
  if (object.parent !== null)
    matrix.premultiply(parentInverse.copy(object.parent.matrixWorld).invert());
  matrix.decompose(object.position, object.quaternion, scale);
};

/** The pose `alpha` of the way from `a` to `b`: positions lerped, rotations slerped. */
const between = (a: BodyPose, b: BodyPose, alpha: number): BodyPose => {
  if (alpha >= 1) return b;
  from.fromArray(a.quaternion);
  to.fromArray(b.quaternion);
  from.slerp(to, alpha);
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * alpha,
      a.position[1] + (b.position[1] - a.position[1]) * alpha,
      a.position[2] + (b.position[2] - a.position[2]) * alpha,
    ],
    quaternion: [from.x, from.y, from.z, from.w],
  };
};

/** A change that needs a new collider: its kind, the geometry or the mesh's scale. */
const reshaped = (a: MeshNode, b: MeshNode): boolean =>
  a.body?.collider !== b.body?.collider ||
  !geometryRefEquals(a.geometry, b.geometry) ||
  !vec3Equals(a.scale, b.scale);

/** Body settings other than its impulse differ. */
const resettled = (a: Body, b: Body): boolean =>
  !bodyEquals({ ...a, impulse: null }, { ...b, impulse: null });

const moved = (a: MeshNode, b: MeshNode): boolean =>
  !vec3Equals(a.position, b.position) || !rotationEquals(a.rotation, b.rotation);

/** Creates the body host for a scene. Without an engine, bodies are ignored. */
export const createBodyHost = (engine: PhysicsEngine | undefined, scene: Scene): BodyHost => {
  let world: PhysicsWorld | undefined;
  let settings: Physics | null = null;
  const hosted = new Map<string, Hosted>();
  let collisions: Array<Collision> = [];
  let last: number | undefined;
  let accumulator = 0;

  const dispose = (): void => {
    world?.dispose();
    world = undefined;
    settings = null;
    hosted.clear();
    accumulator = 0;
    last = undefined;
  };

  const add = (active: PhysicsWorld, { key, node, object }: BodiedMesh, body: Body): void => {
    const pose = poseOf(object);
    active.add(key, body, colliderFor(object.geometry, body.collider, worldScale(object)), pose);
    if (body.impulse !== null) active.applyImpulse(key, body.impulse.impulse);
    hosted.set(key, { object, node, previous: pose, current: pose });
  };

  const syncBody = (active: PhysicsWorld, mesh: BodiedMesh, body: Body): void => {
    const existing = hosted.get(mesh.key);
    if (
      existing === undefined ||
      existing.object !== mesh.object ||
      reshaped(existing.node, mesh.node)
    ) {
      if (existing !== undefined) active.remove(mesh.key);
      add(active, mesh, body);
      return;
    }
    const before = existing.node.body;
    if (before === null || resettled(before, body)) active.update(mesh.key, body);
    if (body.type !== 'kinematic' && moved(existing.node, mesh.node)) {
      const pose = describedPose(mesh.object, mesh.node);
      active.teleport(mesh.key, pose);
      existing.previous = pose;
      existing.current = pose;
      place(mesh.object, pose);
    }
    if (body.impulse !== null && body.impulse.id !== before?.impulse?.id) {
      active.applyImpulse(mesh.key, body.impulse.impulse);
    }
    existing.node = mesh.node;
  };

  const sync: BodyHost['sync'] = (physics, meshes) => {
    if (physics === null || engine === undefined) {
      dispose();
      return;
    }
    if (world === undefined) world = engine.createWorld(physics);
    else if (!physicsEquals(settings, physics)) world.configure(physics);
    settings = physics;
    scene.updateMatrixWorld();
    const seen = new Set<string>();
    for (const mesh of meshes) {
      const body = mesh.node.body;
      if (body === null) continue;
      seen.add(mesh.key);
      syncBody(world, mesh, body);
    }
    for (const key of hosted.keys()) {
      if (seen.has(key)) continue;
      world.remove(key);
      hosted.delete(key);
    }
  };

  const kinematicTargets = (active: PhysicsWorld): void => {
    for (const [key, body] of hosted) {
      if (body.node.body?.type === 'kinematic') active.moveKinematic(key, poseOf(body.object));
    }
  };

  const tick: BodyHost['tick'] = (elapsed, animating) => {
    const delta = last === undefined ? 0 : Math.min(0.5, Math.max(0, elapsed - last));
    last = elapsed;
    if (world === undefined || settings === null || settings.paused || !animating) return;
    const step = settings.timeStep;
    accumulator += delta;
    scene.updateMatrixWorld();
    while (accumulator >= step) {
      for (const body of hosted.values()) body.previous = body.current;
      kinematicTargets(world);
      for (const collision of world.step(step)) collisions.push(collision);
      for (const [key, body] of hosted) body.current = world.pose(key) ?? body.current;
      accumulator -= step;
    }
    const alpha = settings.interpolate ? accumulator / step : 1;
    for (const body of hosted.values()) {
      if (body.node.body?.type === 'dynamic')
        place(body.object, between(body.previous, body.current, alpha));
    }
  };

  return {
    sync,
    tick,
    needsFrame: () => world !== undefined && settings !== null && !settings.paused && world.awake(),
    drainCollisions: () => {
      if (collisions.length === 0) return collisions;
      const drained = collisions;
      collisions = [];
      return drained;
    },
    dispose,
  };
};
