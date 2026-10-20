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
import { Euler, Quaternion, type Scene } from 'three';

import { bodyId, type BodySource } from './bodySources.ts';
import type { Body, Joint, Physics, Vec3 } from './description.ts';
import { bodyEquals, collidersEqual, jointEquals, physicsEquals } from './equality.ts';
import type {
  BodyPose,
  Collision,
  PhysicsEngine,
  PhysicsJoint,
  PhysicsWorld,
  Quat,
} from './physics.ts';
import { createPhysicsDebug } from './physicsDebug.ts';

/** Two bodies began (`started`) or stopped touching: their nodes' keys, and instances'. */
export type BodyCollision = {
  readonly a: string;
  readonly aInstance?: string;
  /** The part of body `a` that touched (a mesh's or collider's name), when it has one. */
  readonly aPart?: string;
  readonly b: string;
  readonly bInstance?: string;
  readonly bPart?: string;
  readonly started: boolean;
};

/**
 * Two bodies pushing on each other harder than a threshold: their nodes' keys (and
 * instances'), and Rapier's contact force payload, as react-three-rapier's
 * `onContactForce`.
 */
export type BodyContactForce = {
  readonly a: string;
  readonly aInstance?: string;
  readonly aPart?: string;
  readonly b: string;
  readonly bInstance?: string;
  readonly bPart?: string;
  readonly totalForce: Vec3;
  readonly totalForceMagnitude: number;
  readonly maxForceDirection: Vec3;
  readonly maxForceMagnitude: number;
};

/**
 * A world driven by `physics({ until })` has reached that step and waits: its run, what
 * it has done (its step count since it was made), and a checksum of every body's pose
 * there, so peers that should agree can check that they do.
 */
export type PhysicsReached = {
  readonly run: number;
  readonly step: number;
  readonly checksum: string;
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
  /** Contact forces over their thresholds since the last call. */
  readonly drainContactForces: () => ReadonlyArray<BodyContactForce>;
  /** Steps the Model has asked for and the world has reached since the last call. */
  readonly drainReached: () => ReadonlyArray<PhysicsReached>;
  /**
   * Whether a world on `until` still owes steps, or a report: it needs frames even when
   * nothing else moves, and even under reduced motion, as other peers wait on it.
   */
  readonly owesSteps: () => boolean;
  readonly dispose: () => void;
};

const from = new Quaternion();
const to = new Quaternion();
const euler = new Euler();

const quatOf = (angles: Vec3): Quat => {
  from.setFromEuler(euler.fromArray([...angles]));
  return [from.x, from.y, from.z, from.w];
};

/** A joint for the engine: a fixed joint's frames turned into quaternions. */
const physicsJoint = ({ anchorA, anchorB, kind, contacts }: Joint): PhysicsJoint => ({
  anchorA,
  anchorB,
  contacts,
  kind:
    kind._tag === 'Fixed'
      ? { _tag: 'Fixed', frameA: quatOf(kind.frameA), frameB: quatOf(kind.frameB) }
      : kind,
});

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

/**
 * How far behind `until` (in seconds of simulation) a world may run at scene time's pace,
 * following an `until` that moves on as time passes; further back (a newcomer replaying,
 * a page that was busy), it goes straight there.
 */
const catchUpAfter = 0.25;

/** The most simulation a world on `until` runs in one frame, in seconds. */
const mostPerFrame = 1;

const checksumBytes = new DataView(new ArrayBuffer(8));

/** FNV-1a, a byte at a time. */
const mixByte = (hash: number, byte: number): number => Math.imul(hash ^ byte, 0x0100_0193) >>> 0;

const mixNumber = (hash: number, value: number): number => {
  checksumBytes.setFloat64(0, value);
  let mixed = hash;
  for (let i = 0; i < 8; i++) mixed = mixByte(mixed, checksumBytes.getUint8(i));
  return mixed;
};

const mixText = (hash: number, text: string): number => {
  let mixed = hash;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    mixed = mixByte(mixByte(mixed, code & 0xff), code >>> 8);
  }
  return mixed;
};

/**
 * A checksum of where every body is, by id: the bits of each pose's numbers, so peers
 * agree only if their worlds are the same to the last bit.
 */
const checksumOf = (poses: ReadonlyArray<readonly [string, BodyPose]>): string => {
  let hash = 0x811c_9dc5;
  for (const [id, { position, quaternion }] of poses.toSorted(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    hash = mixText(hash, id);
    for (const value of position) hash = mixNumber(hash, value);
    for (const value of quaternion) hash = mixNumber(hash, value);
  }
  return hash.toString(16).padStart(8, '0');
};

/** A change that needs a new body: another holder or kind, or colliders made otherwise. */
const remade = (hosted: Hosted, source: BodySource, signature: string): boolean =>
  hosted.source.holder !== source.holder ||
  hosted.source.body.collider !== source.body.collider ||
  !collidersEqual(hosted.source.body.colliders, source.body.colliders) ||
  hosted.signature !== signature;

/** Body settings other than its impulse differ. */
const resettled = (a: Body, b: Body): boolean =>
  !bodyEquals({ ...a, impulse: null }, { ...b, impulse: null });

/** Bodies `a` and `b` (by id) named by their nodes, instances and parts, where they have them. */
const named = (
  a: BodySource | undefined,
  b: BodySource | undefined,
  ids: {
    readonly a: string;
    readonly b: string;
    readonly aPart?: string;
    readonly bPart?: string;
  },
): Pick<BodyCollision, 'a' | 'aInstance' | 'aPart' | 'b' | 'bInstance' | 'bPart'> => {
  const aInstance = a?.instance;
  const bInstance = b?.instance;
  return {
    a: a?.key ?? ids.a,
    ...(aInstance === undefined ? {} : { aInstance }),
    ...(ids.aPart === undefined ? {} : { aPart: ids.aPart }),
    b: b?.key ?? ids.b,
    ...(bInstance === undefined ? {} : { bInstance }),
    ...(ids.bPart === undefined ? {} : { bPart: ids.bPart }),
  };
};

/** Creates the body host for a scene. Without an engine, bodies are ignored. */
export const createBodyHost = (engine: PhysicsEngine | undefined, scene: Scene): BodyHost => {
  let world: PhysicsWorld | undefined;
  let settings: Physics | null = null;
  const hosted = new Map<string, Hosted>();
  /** Joints made, by key. */
  const joined = new Map<string, Joint>();
  /** Bodies (re)made by the current sync: their joints went with the old ones. */
  const fresh = new Set<string>();
  let collisions: Array<BodyCollision> = [];
  let contactForces: Array<BodyContactForce> = [];
  const debug = createPhysicsDebug(scene);
  let last: number | undefined;
  let accumulator = 0;
  /** Steps taken since the world was made. */
  let steps = 0;
  /** The last `until` reported as reached. */
  let reported: number | undefined;
  let reached: Array<PhysicsReached> = [];

  /** Draws the world's lines while the description asks for them. */
  const drawDebug = (): void => {
    if (world !== undefined && settings?.debug === true) debug.show(world.debugLines());
    else debug.hide();
  };

  const dispose = (): void => {
    debug.hide();
    world?.dispose();
    world = undefined;
    settings = null;
    hosted.clear();
    joined.clear();
    accumulator = 0;
    last = undefined;
    steps = 0;
    reported = undefined;
    reached = [];
  };

  /** Whether this sync begins a new run: bodies start where the description puts them. */
  let restarting = false;

  const add = (active: PhysicsWorld, source: BodySource, signature: string): void => {
    const pose = restarting ? source.described() : source.pose();
    if (restarting) source.place(pose);
    active.add(source.id, source.body, source.colliders(), pose);
    if (source.body.impulse !== null) active.applyImpulse(source.id, source.body.impulse.impulse);
    hosted.set(source.id, { source, signature, previous: pose, current: pose, shown: pose });
    fresh.add(source.id);
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

  /** Makes each joint whose bodies both exist, again when either was remade or it changed. */
  const syncJoints = (active: PhysicsWorld, joints: ReadonlyArray<Joint>): void => {
    const seen = new Set<string>();
    for (const joint of joints) {
      seen.add(joint.key);
      const a = bodyId(joint.a.key, joint.a.instance);
      const b = bodyId(joint.b.key, joint.b.instance);
      const ready = hosted.has(a) && hosted.has(b);
      const made = joined.get(joint.key);
      if (
        made !== undefined &&
        ready &&
        !fresh.has(a) &&
        !fresh.has(b) &&
        jointEquals(made, joint)
      ) {
        continue;
      }
      if (made !== undefined) {
        active.removeJoint(joint.key);
        joined.delete(joint.key);
      }
      if (ready) {
        active.addJoint(joint.key, physicsJoint(joint), a, b);
        joined.set(joint.key, joint);
      }
    }
    for (const key of joined.keys()) {
      if (seen.has(key)) continue;
      active.removeJoint(key);
      joined.delete(key);
    }
  };

  const sync: BodyHost['sync'] = (physics, sources) => {
    if (physics === null || engine === undefined) {
      dispose();
      return;
    }
    // Another run: the world goes, and a new one counts from step 0.
    restarting = settings !== null && settings.run !== physics.run;
    if (restarting) dispose();
    if (world === undefined) world = engine.createWorld(physics);
    // Joints are made below, and `until` is the host's: neither is configured.
    else if (
      !physicsEquals(
        settings && { ...settings, joints: physics.joints, until: physics.until },
        physics,
      )
    ) {
      world.configure(physics);
    }
    settings = physics;
    scene.updateMatrixWorld();
    fresh.clear();
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
    syncJoints(world, physics.joints);
    restarting = false;
    drawDebug();
  };

  const kinematicTargets = (active: PhysicsWorld): void => {
    for (const [id, { source }] of hosted) {
      if (source.body.type === 'kinematic') active.moveKinematic(id, source.pose());
    }
  };

  const heard = (arrived: ReadonlyArray<Collision>, active: PhysicsWorld): void => {
    for (const collision of arrived) {
      collisions.push({
        ...named(hosted.get(collision.a)?.source, hosted.get(collision.b)?.source, collision),
        started: collision.started,
      });
    }
    for (const force of active.contactForces()) {
      const { a, b, aPart, bPart, ...payload } = force;
      contactForces.push({
        ...named(hosted.get(a)?.source, hosted.get(b)?.source, force),
        ...payload,
      });
    }
  };

  const step = (active: PhysicsWorld, seconds: number): void => {
    for (const body of hosted.values()) body.previous = body.current;
    kinematicTargets(active);
    heard(active.step(seconds), active);
    for (const [id, body] of hosted) body.current = active.pose(id) ?? body.current;
    steps += 1;
  };

  /**
   * What a world working elsewhere has sent back since the last frame: its collisions and
   * forces, and where its bodies are now. Whether anything is still to come back; never,
   * for a world that does what it is asked at once.
   */
  const collect = (active: PhysicsWorld): boolean => {
    if (active.received === undefined) return false;
    const { collisions: arrived, pending } = active.received();
    heard(arrived, active);
    for (const [id, body] of hosted) body.current = active.pose(id) ?? body.current;
    return pending;
  };

  /** On scene time: every whole step the time since the last frame holds. */
  const free = (active: PhysicsWorld, timeStep: number, delta: number): number => {
    accumulator += delta;
    while (accumulator >= timeStep) {
      step(active, timeStep);
      accumulator -= timeStep;
    }
    collect(active);
    return accumulator / timeStep;
  };

  /**
   * Toward `until`: at scene time's pace while close behind it, straight there (a step
   * budget a frame) when further back, never past it. A world that has reached it waits
   * there and reports it once, with the bodies' checksum.
   */
  const driven = (
    active: PhysicsWorld,
    run: number,
    timeStep: number,
    delta: number,
    until: number,
  ) => {
    accumulator += delta;
    const owed = Math.max(0, until - steps);
    const paced = Math.floor(accumulator / timeStep);
    const behind = owed > Math.ceil(catchUpAfter / timeStep);
    const count = Math.min(owed, behind ? owed : paced, Math.ceil(mostPerFrame / timeStep));
    for (let i = 0; i < count; i++) step(active, timeStep);
    accumulator = Math.max(0, accumulator - count * timeStep);
    const pending = collect(active);
    if (steps < until) return Math.min(1, accumulator / timeStep);
    // Waiting: time spent here is not owed once `until` moves on.
    accumulator = 0;
    // A world working elsewhere is there once all it was asked has come back, poses and all.
    if (steps === until && reported !== until && !pending) {
      reported = until;
      reached.push({
        run,
        step: steps,
        checksum: checksumOf([...hosted.keys()].flatMap((id) => posed(active, id))),
      });
    }
    return 1;
  };

  const posed = (active: PhysicsWorld, id: string): ReadonlyArray<[string, BodyPose]> => {
    const pose = active.pose(id);
    return pose === undefined ? [] : [[id, pose]];
  };

  const tick: BodyHost['tick'] = (elapsed, animating) => {
    const delta = last === undefined ? 0 : Math.min(0.5, Math.max(0, elapsed - last));
    last = elapsed;
    if (world === undefined || settings === null || settings.paused) return;
    // A world on `until` steps under reduced motion too: other peers wait on it.
    if (settings.until === null && !animating) return;
    scene.updateMatrixWorld();
    const progress =
      settings.until === null
        ? free(world, settings.timeStep, delta)
        : driven(world, settings.run, settings.timeStep, delta, settings.until);
    const alpha = settings.interpolate ? progress : 1;
    for (const body of hosted.values()) {
      if (body.source.body.type === 'dynamic') {
        body.shown = between(body.previous, body.current, alpha);
        body.source.place(body.shown);
      }
    }
    if (settings.debug) drawDebug();
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
    drainContactForces: () => {
      if (contactForces.length === 0) return contactForces;
      const drained = contactForces;
      contactForces = [];
      return drained;
    },
    drainReached: () => {
      if (reached.length === 0) return reached;
      const drained = reached;
      reached = [];
      return drained;
    },
    owesSteps: () =>
      world !== undefined &&
      settings !== null &&
      !settings.paused &&
      settings.until !== null &&
      (steps < settings.until || reported !== settings.until),
    dispose,
  };
};
