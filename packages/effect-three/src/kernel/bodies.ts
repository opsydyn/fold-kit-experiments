/**
 * Rigid bodies for a scene graph's nodes: a physics world kept in step with the
 * description, advanced on scene time, its poses written back to the nodes (or, for an
 * instances node, to each instance's matrix).
 *
 * Behavioural reference: react-three-rapier at `ae5c3fe`, `src/components/Physics.tsx`:
 * fixed steps from an accumulator, the frame delta clamped to 0.5 s, nothing stepped while
 * paused, and each body placed between its last two simulated poses (`interpolate`),
 * converted from world space into its parent's space.
 *
 * @module
 */
import { Quaternion, type Scene } from 'three';

import type { BodySource } from './bodySources.ts';
import type { Body, Physics } from './description.ts';
import { bodyEquals, physicsEquals } from './equality.ts';
import type { BodyPose, PhysicsEngine, PhysicsWorld } from './physics.ts';

/** Two bodies began (`started`) or stopped touching: their nodes' keys, and instances'. */
export type BodyCollision = {
  readonly a: string;
  readonly aInstance?: string;
  readonly b: string;
  readonly bInstance?: string;
  readonly started: boolean;
};

type Hosted = {
  source: BodySource;
  /** What its colliders were made from; a change makes them again. */
  signature: string;
  previous: BodyPose;
  current: BodyPose;
  /** Where it was last placed, between `previous` and `current`. */
  shown: BodyPose;
};

export type BodyHost = {
  /** Brings the world in line with the description's physics and its bodies. */
  readonly sync: (physics: Physics | null, sources: Iterable<BodySource>) => void;
  /** Steps the world to scene time `elapsed` and moves dynamic bodies to their poses. */
  readonly tick: (elapsed: number, animating: boolean) => void;
  /** Whether the simulation still moves anything. */
  readonly needsFrame: () => boolean;
  /** Collisions since the last call. */
  readonly drainCollisions: () => ReadonlyArray<BodyCollision>;
  readonly dispose: () => void;
};

const from = new Quaternion();
const to = new Quaternion();

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

/** A change that needs a new body: another holder or kind, or colliders made otherwise. */
const remade = (hosted: Hosted, source: BodySource, signature: string): boolean =>
  hosted.source.holder !== source.holder ||
  hosted.source.body.collider !== source.body.collider ||
  hosted.signature !== signature;

/** Body settings other than its impulse differ. */
const resettled = (a: Body, b: Body): boolean =>
  !bodyEquals({ ...a, impulse: null }, { ...b, impulse: null });

/** A collision between bodies `a` and `b` (by id), named by their nodes and instances. */
const named = (
  a: BodySource | undefined,
  b: BodySource | undefined,
  ids: { readonly a: string; readonly b: string; readonly started: boolean },
): BodyCollision => {
  const aInstance = a?.instance;
  const bInstance = b?.instance;
  return {
    a: a?.key ?? ids.a,
    ...(aInstance === undefined ? {} : { aInstance }),
    b: b?.key ?? ids.b,
    ...(bInstance === undefined ? {} : { bInstance }),
    started: ids.started,
  };
};

/** Creates the body host for a scene. Without an engine, bodies are ignored. */
export const createBodyHost = (engine: PhysicsEngine | undefined, scene: Scene): BodyHost => {
  let world: PhysicsWorld | undefined;
  let settings: Physics | null = null;
  const hosted = new Map<string, Hosted>();
  let collisions: Array<BodyCollision> = [];
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

  const add = (active: PhysicsWorld, source: BodySource, signature: string): void => {
    const pose = source.pose();
    active.add(source.id, source.body, source.colliders(), pose);
    if (source.body.impulse !== null) active.applyImpulse(source.id, source.body.impulse.impulse);
    hosted.set(source.id, { source, signature, previous: pose, current: pose, shown: pose });
  };

  const syncBody = (active: PhysicsWorld, source: BodySource): void => {
    const existing = hosted.get(source.id);
    const signature = source.signature();
    if (existing === undefined || remade(existing, source, signature)) {
      if (existing !== undefined) active.remove(source.id);
      add(active, source, signature);
      return;
    }
    const before = existing.source.body;
    const { body } = source;
    if (resettled(before, body)) active.update(source.id, body);
    if (body.type !== 'kinematic' && existing.source.placement !== source.placement) {
      const pose = source.described();
      active.teleport(source.id, pose);
      existing.previous = pose;
      existing.current = pose;
      existing.shown = pose;
      source.place(pose);
    } else if (body.type === 'dynamic') {
      // A description change elsewhere (an instance's colour, say) may have rewritten it.
      source.place(existing.shown);
    }
    if (body.impulse !== null && body.impulse.id !== before.impulse?.id) {
      active.applyImpulse(source.id, body.impulse.impulse);
    }
    existing.source = source;
  };

  const sync: BodyHost['sync'] = (physics, sources) => {
    if (physics === null || engine === undefined) {
      dispose();
      return;
    }
    if (world === undefined) world = engine.createWorld(physics);
    else if (!physicsEquals(settings, physics)) world.configure(physics);
    settings = physics;
    scene.updateMatrixWorld();
    const seen = new Set<string>();
    for (const source of sources) {
      seen.add(source.id);
      syncBody(world, source);
    }
    for (const id of hosted.keys()) {
      if (seen.has(id)) continue;
      world.remove(id);
      hosted.delete(id);
    }
  };

  const kinematicTargets = (active: PhysicsWorld): void => {
    for (const [id, { source }] of hosted) {
      if (source.body.type === 'kinematic') active.moveKinematic(id, source.pose());
    }
  };

  const step = (active: PhysicsWorld, seconds: number): void => {
    for (const body of hosted.values()) body.previous = body.current;
    kinematicTargets(active);
    for (const collision of active.step(seconds)) {
      collisions.push(
        named(hosted.get(collision.a)?.source, hosted.get(collision.b)?.source, collision),
      );
    }
    for (const [id, body] of hosted) body.current = active.pose(id) ?? body.current;
  };

  const tick: BodyHost['tick'] = (elapsed, animating) => {
    const delta = last === undefined ? 0 : Math.min(0.5, Math.max(0, elapsed - last));
    last = elapsed;
    if (world === undefined || settings === null || settings.paused || !animating) return;
    const timeStep = settings.timeStep;
    accumulator += delta;
    scene.updateMatrixWorld();
    while (accumulator >= timeStep) {
      step(world, timeStep);
      accumulator -= timeStep;
    }
    const alpha = settings.interpolate ? accumulator / timeStep : 1;
    for (const body of hosted.values()) {
      if (body.source.body.type === 'dynamic') {
        body.shown = between(body.previous, body.current, alpha);
        body.source.place(body.shown);
      }
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
