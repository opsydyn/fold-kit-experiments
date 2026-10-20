/**
 * A tiny physics engine for testing the kernel's side: dynamic bodies fall under gravity
 * (semi-implicit Euler), nothing collides unless a test queues a collision, and every
 * call is logged.
 */
import type {
  Body,
  BodyPose,
  Collider,
  Collision,
  ContactForce,
  Physics,
  PhysicsEngine,
  PhysicsJoint,
  PhysicsWorld,
  Vec3,
} from '../../src/kernel/index.ts';

type FakeBody = {
  body: Body;
  colliders: ReadonlyArray<Collider>;
  pose: BodyPose;
  velocity: [number, number, number];
};

export type FakeWorld = PhysicsWorld & {
  readonly calls: Array<string>;
  readonly bodies: Map<string, FakeBody>;
  readonly queue: Array<Collision>;
  readonly forces: Array<ContactForce>;
  readonly joints: Map<
    string,
    { readonly joint: PhysicsJoint; readonly a: string; readonly b: string }
  >;
  disposed: boolean;
  /** Steps taken. */
  steps: number;
};

/** What a fake world's snapshot holds: its gravity, bodies and joints. */
type FakeState = {
  readonly gravity: Vec3;
  readonly bodies: ReadonlyArray<readonly [string, FakeBody]>;
  readonly joints: ReadonlyArray<
    readonly [string, FakeWorld['joints'] extends Map<string, infer J> ? J : never]
  >;
};

/** Every fake world's snapshot: its bytes are its index here. */
const taken: Array<FakeState> = [];

/**
 * The fake engine. With `snapshots` (the default) its worlds take snapshots and it makes
 * worlds from them; without, it can do neither, as an engine that cannot.
 */
export const fakePhysics = ({ snapshots = true }: { readonly snapshots?: boolean } = {}) => {
  const worlds: Array<FakeWorld> = [];
  const make = (initial: Physics, state?: FakeState): FakeWorld => {
    let gravity: Vec3 = state?.gravity ?? initial.gravity;
    const bodies = new Map<string, FakeBody>(state?.bodies ?? []);
    const calls: Array<string> = [];
    const queue: Array<Collision> = [];
    const forces: Array<ContactForce> = [];
    const joints: FakeWorld['joints'] = new Map(state?.joints ?? []);
    const world: FakeWorld = {
      calls,
      bodies,
      queue,
      forces,
      joints,
      contactForces: () => forces.splice(0),
      // One line per body: from its position, a unit up.
      debugLines: () => {
        const vertices = new Float32Array(bodies.size * 6);
        [...bodies.values()].forEach(
          (
            {
              pose: {
                position: [x, y, z],
              },
            },
            i,
          ) => {
            vertices.set([x, y, z, x, y + 1, z], i * 6);
          },
        );
        return { vertices, colors: new Float32Array(bodies.size * 8).fill(1) };
      },
      disposed: false,
      steps: 0,
      configure: (physics) => {
        calls.push('configure');
        gravity = physics.gravity;
      },
      add: (key, body, colliders, pose) => {
        calls.push(`add ${key}`);
        bodies.set(key, { body, colliders, pose, velocity: [...body.linearVelocity] });
      },
      update: (key, body) => {
        calls.push(`update ${key}`);
        const held = bodies.get(key);
        if (held !== undefined) held.body = body;
      },
      teleport: (key, pose) => {
        calls.push(`teleport ${key}`);
        const held = bodies.get(key);
        if (held !== undefined) {
          held.pose = pose;
          held.velocity = [0, 0, 0];
        }
      },
      moveKinematic: (key, pose) => {
        calls.push(`kinematic ${key} ${pose.position.join(',')}`);
        const held = bodies.get(key);
        if (held !== undefined) held.pose = pose;
      },
      applyImpulse: (key, impulse) => {
        calls.push(`impulse ${key} ${impulse.join(',')}`);
        const held = bodies.get(key);
        if (held !== undefined) {
          held.velocity = [
            held.velocity[0] + impulse[0],
            held.velocity[1] + impulse[1],
            held.velocity[2] + impulse[2],
          ];
        }
      },
      remove: (key) => {
        calls.push(`remove ${key}`);
        bodies.delete(key);
        for (const [id, held] of joints) if (held.a === key || held.b === key) joints.delete(id);
      },
      addJoint: (id, joint, a, b) => {
        calls.push(`join ${id}`);
        joints.set(id, { joint, a, b });
      },
      removeJoint: (id) => {
        calls.push(`unjoin ${id}`);
        joints.delete(id);
      },
      step: (seconds) => {
        world.steps += 1;
        for (const held of bodies.values()) {
          if (held.body.type !== 'dynamic') continue;
          held.velocity = [
            held.velocity[0] + gravity[0] * held.body.gravityScale * seconds,
            held.velocity[1] + gravity[1] * held.body.gravityScale * seconds,
            held.velocity[2] + gravity[2] * held.body.gravityScale * seconds,
          ];
          const [x, y, z] = held.pose.position;
          held.pose = {
            position: [
              x + held.velocity[0] * seconds,
              y + held.velocity[1] * seconds,
              z + held.velocity[2] * seconds,
            ],
            quaternion: held.pose.quaternion,
          };
        }
        return queue.splice(0);
      },
      pose: (key) => bodies.get(key)?.pose,
      awake: () =>
        [...bodies.values()].some(
          (held) => held.body.type === 'dynamic' && held.velocity.some((v) => v !== 0),
        ),
      dispose: () => {
        world.disposed = true;
      },
      ...(snapshots
        ? {
            snapshot: () => {
              calls.push('snapshot');
              taken.push(structuredClone({ gravity, bodies: [...bodies], joints: [...joints] }));
              return Uint8Array.of(taken.length - 1);
            },
          }
        : {}),
    };
    worlds.push(world);
    return world;
  };
  const engine: PhysicsEngine = {
    createWorld: (initial) => make(initial),
    ...(snapshots
      ? {
          restoreWorld: (initial, snapshot) => {
            const state = taken[snapshot[0] ?? -1];
            if (state === undefined) throw new Error('Not a fake world’s snapshot');
            return {
              world: make(initial, state),
              bodies: state.bodies.map(([key]) => key),
              joints: state.joints.map(([id]) => id),
            };
          },
        }
      : {}),
  };
  return { engine, worlds };
};
