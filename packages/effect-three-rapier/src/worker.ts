/**
 * Physics in a worker, behind the same engine contract (ADR-017). In the page,
 * `remotePhysics(worker)` is a `PhysicsEngine` whose worlds send what the scene graph asks
 * of them to the worker, a frame's worth in one message, and answer from what the worker
 * last sent back. In the worker, `servePhysics(self, loadRapier())` does what each world
 * is asked with a real engine and sends back the steps' collisions and forces and every
 * body's pose. Nothing here imports Rapier, so the page does not load its WebAssembly.
 *
 * ```ts
 * // physics.worker.ts
 * import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
 * import { servePhysics } from '@opsydyn/effect-three-rapier/worker';
 * servePhysics(self, loadRapier());
 *
 * // the page
 * import { remotePhysics } from '@opsydyn/effect-three-rapier/worker';
 * const worker = new Worker(new URL('./physics.worker.ts', import.meta.url), { type: 'module' });
 * const environment = EffectThreeFoldkit.makeEnvironment(window, { physics: remotePhysics(worker) });
 * ```
 *
 * The stepping is pipelined: what a world shows and reports lags what it was asked by
 * the time the worker takes to answer, about a frame. A world on `physics({ until })` is
 * reported as there only once all it was asked has come back, so its checksum is the one
 * an engine in the page would give, a frame later.
 *
 * @module
 */
import type {
  Body,
  BodyPose,
  Collider,
  Collision,
  ContactForce,
  DebugLines,
  Physics,
  PhysicsEngine,
  PhysicsJoint,
  PhysicsWorld,
  Vec3,
} from '@opsydyn/effect-three';

/** One thing a world is asked to do, as `PhysicsWorld`'s method of that name. */
export type Call =
  | { readonly _tag: 'Configure'; readonly physics: Physics }
  | {
      readonly _tag: 'Add';
      readonly key: string;
      readonly body: Body;
      readonly colliders: ReadonlyArray<Collider>;
      readonly pose: BodyPose;
    }
  | { readonly _tag: 'Update'; readonly key: string; readonly body: Body }
  | { readonly _tag: 'Teleport'; readonly key: string; readonly pose: BodyPose }
  | { readonly _tag: 'MoveKinematic'; readonly key: string; readonly pose: BodyPose }
  | { readonly _tag: 'ApplyImpulse'; readonly key: string; readonly impulse: Vec3 }
  | { readonly _tag: 'Remove'; readonly key: string }
  | {
      readonly _tag: 'AddJoint';
      readonly id: string;
      readonly joint: PhysicsJoint;
      readonly a: string;
      readonly b: string;
    }
  | { readonly _tag: 'RemoveJoint'; readonly id: string }
  | { readonly _tag: 'Step'; readonly seconds: number };

/** What the page sends the worker. Batches are numbered from 1 for each world. */
export type ToWorker =
  | { readonly _tag: 'Create'; readonly world: number; readonly physics: Physics }
  | {
      readonly _tag: 'Batch';
      readonly world: number;
      readonly batch: number;
      readonly calls: ReadonlyArray<Call>;
    }
  | { readonly _tag: 'Dispose'; readonly world: number };

/** What the worker sends back after each batch, or why one could not be done. */
export type FromWorker =
  | {
      readonly _tag: 'Done';
      readonly world: number;
      readonly batch: number;
      readonly collisions: ReadonlyArray<Collision>;
      readonly contactForces: ReadonlyArray<ContactForce>;
      readonly poses: ReadonlyArray<readonly [string, BodyPose]>;
      readonly awake: boolean;
      /** The world as lines, while it is configured to draw them. */
      readonly debugLines: DebugLines | null;
    }
  | { readonly _tag: 'Failed'; readonly world: number; readonly reason: string };

/**
 * Either end of the channel: a `Worker` in the page, the worker's own global scope (`self`)
 * inside it, or a `MessagePort`.
 */
export type PhysicsPort = {
  readonly postMessage: (message: unknown) => void;
  readonly addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  /** A `MessagePort`'s: it delivers nothing to its listeners until started. */
  readonly start?: () => void;
};

const noLines: DebugLines = { vertices: new Float32Array(), colors: new Float32Array() };

/**
 * A world in the worker, as the page sees it: `heard` takes what the worker sends back,
 * and `forget` is called when it is disposed.
 */
const remoteWorld = (
  id: number,
  port: PhysicsPort,
  forget: () => void,
): { readonly world: PhysicsWorld; readonly heard: (message: FromWorker) => void } => {
  let calls: Array<Call> = [];
  let flushing = false;
  let disposed = false;
  /** Batches sent, and the last one the worker has answered. */
  let sent = 0;
  let answered = 0;
  let collisions: Array<Collision> = [];
  let forces: Array<ContactForce> = [];
  let awake = false;
  let lines = noLines;
  const poses = new Map<string, BodyPose>();
  /** Bodies placed here: an answer to a batch sent before then would put them back. */
  const placedIn = new Map<string, number>();

  const flush = (): void => {
    flushing = false;
    if (disposed || calls.length === 0) return;
    sent += 1;
    const message: ToWorker = { _tag: 'Batch', world: id, batch: sent, calls };
    calls = [];
    port.postMessage(message);
  };
  /** Queues a call; the frame's calls go together, once what asked for them is done. */
  const call = (next: Call): void => {
    calls.push(next);
    if (flushing) return;
    flushing = true;
    queueMicrotask(flush);
  };
  const place = (key: string, pose: BodyPose | undefined): void => {
    if (pose === undefined) poses.delete(key);
    else poses.set(key, pose);
    placedIn.set(key, sent + 1);
  };

  const heard = (message: FromWorker): void => {
    if (disposed) return;
    if (message._tag === 'Failed') {
      // Nothing in the page can do it instead: say so where the page's errors go.
      queueMicrotask(() => {
        throw new Error(`Physics in the worker failed: ${message.reason}`);
      });
      return;
    }
    answered = message.batch;
    collisions.push(...message.collisions);
    forces.push(...message.contactForces);
    awake = message.awake;
    lines = message.debugLines ?? noLines;
    for (const [key, pose] of message.poses) {
      if ((placedIn.get(key) ?? 0) <= message.batch) poses.set(key, pose);
    }
  };

  const world: PhysicsWorld = {
    configure: (physics) => call({ _tag: 'Configure', physics }),
    add: (key, body, colliders, pose) => {
      call({ _tag: 'Add', key, body, colliders, pose });
      place(key, pose);
    },
    update: (key, body) => call({ _tag: 'Update', key, body }),
    teleport: (key, pose) => {
      call({ _tag: 'Teleport', key, pose });
      place(key, pose);
    },
    moveKinematic: (key, pose) => call({ _tag: 'MoveKinematic', key, pose }),
    applyImpulse: (key, impulse) => call({ _tag: 'ApplyImpulse', key, impulse }),
    remove: (key) => {
      call({ _tag: 'Remove', key });
      place(key, undefined);
    },
    addJoint: (jointId, joint, a, b) => call({ _tag: 'AddJoint', id: jointId, joint, a, b }),
    removeJoint: (jointId) => call({ _tag: 'RemoveJoint', id: jointId }),
    // Its collisions come back later, through `received`.
    step: (seconds) => {
      call({ _tag: 'Step', seconds });
      return [];
    },
    contactForces: () => {
      const drained = forces;
      forces = [];
      return drained;
    },
    debugLines: () => lines,
    pose: (key) => poses.get(key),
    // Moving, as far as the page knows, until the worker has answered everything.
    awake: () => awake || calls.length > 0 || answered < sent,
    dispose: () => {
      disposed = true;
      calls = [];
      forget();
      const message: ToWorker = { _tag: 'Dispose', world: id };
      port.postMessage(message);
    },
    received: () => {
      const drained = collisions;
      collisions = [];
      return { collisions: drained, pending: calls.length > 0 || answered < sent };
    },
  };
  return { world, heard };
};

/**
 * A physics engine in a worker, for the page: each world it makes is made in the worker
 * that `servePhysics` runs in, on the far end of `port`.
 */
export const remotePhysics = (port: PhysicsPort): PhysicsEngine => {
  const worlds = new Map<number, (message: FromWorker) => void>();
  let made = 0;
  port.addEventListener('message', (event) => {
    // SAFETY: only `servePhysics` posts on this channel, and only `FromWorker` messages.
    const message = event.data as FromWorker;
    worlds.get(message.world)?.(message);
  });
  port.start?.();
  return {
    createWorld: (physics) => {
      made += 1;
      const id = made;
      const create: ToWorker = { _tag: 'Create', world: id, physics };
      port.postMessage(create);
      const { world, heard } = remoteWorld(id, port, () => worlds.delete(id));
      worlds.set(id, heard);
      return world;
    },
  };
};

type Served = {
  readonly world: PhysicsWorld;
  readonly keys: Set<string>;
  debug: boolean;
};

/** Does one call to a world; a step's collisions are added to `collisions`. */
const perform = (served: Served, next: Call, collisions: Array<Collision>): void => {
  const { world } = served;
  switch (next._tag) {
    case 'Configure':
      world.configure(next.physics);
      served.debug = next.physics.debug;
      return;
    case 'Add':
      world.add(next.key, next.body, next.colliders, next.pose);
      served.keys.add(next.key);
      return;
    case 'Update':
      world.update(next.key, next.body);
      return;
    case 'Teleport':
      world.teleport(next.key, next.pose);
      return;
    case 'MoveKinematic':
      world.moveKinematic(next.key, next.pose);
      return;
    case 'ApplyImpulse':
      world.applyImpulse(next.key, next.impulse);
      return;
    case 'Remove':
      world.remove(next.key);
      served.keys.delete(next.key);
      return;
    case 'AddJoint':
      world.addJoint(next.id, next.joint, next.a, next.b);
      return;
    case 'RemoveJoint':
      world.removeJoint(next.id);
      return;
    case 'Step':
      collisions.push(...world.step(next.seconds));
  }
};

/** Does a batch to a world and says what came of it. */
const answer = (id: number, batch: number, served: Served, calls: ReadonlyArray<Call>) => {
  const collisions: Array<Collision> = [];
  for (const next of calls) perform(served, next, collisions);
  const poses: Array<readonly [string, BodyPose]> = [];
  for (const key of served.keys) {
    const pose = served.world.pose(key);
    if (pose !== undefined) poses.push([key, pose]);
  }
  const done: FromWorker = {
    _tag: 'Done',
    world: id,
    batch,
    collisions,
    contactForces: served.world.contactForces(),
    poses,
    awake: served.world.awake(),
    debugLines: served.debug ? served.world.debugLines() : null,
  };
  return done;
};

/**
 * Serves the worlds a page's `remotePhysics` makes, with `engine` (or the engine it is
 * loading): in the worker, `servePhysics(self, loadRapier())`. Messages are handled in
 * the order they came, once the engine has loaded.
 */
export const servePhysics = (
  port: PhysicsPort,
  engine: PhysicsEngine | Promise<PhysicsEngine>,
): void => {
  const loaded = Promise.resolve(engine);
  const worlds = new Map<number, Served>();
  const handle = (ready: PhysicsEngine, message: ToWorker): void => {
    if (message._tag === 'Create') {
      worlds.set(message.world, {
        world: ready.createWorld(message.physics),
        keys: new Set(),
        debug: message.physics.debug,
      });
      return;
    }
    const served = worlds.get(message.world);
    if (served === undefined) return;
    if (message._tag === 'Dispose') {
      served.world.dispose();
      worlds.delete(message.world);
      return;
    }
    port.postMessage(answer(message.world, message.batch, served, message.calls));
  };
  let queue: Promise<void> = Promise.resolve();
  port.addEventListener('message', (event) => {
    // SAFETY: only `remotePhysics` posts on this channel, and only `ToWorker` messages.
    const message = event.data as ToWorker;
    queue = queue
      .then(() => loaded)
      .then((ready) => handle(ready, message))
      .catch((cause: unknown) => {
        const failed: FromWorker = {
          _tag: 'Failed',
          world: message.world,
          reason: cause instanceof Error ? cause.message : String(cause),
        };
        port.postMessage(failed);
      });
  });
  port.start?.();
};
