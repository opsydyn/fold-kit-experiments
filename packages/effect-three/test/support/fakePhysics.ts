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
  Physics,
  PhysicsEngine,
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
  disposed: boolean;
};

export const fakePhysics = () => {
  const worlds: Array<FakeWorld> = [];
  const engine: PhysicsEngine = {
    createWorld: (initial: Physics) => {
      let gravity: Vec3 = initial.gravity;
      const bodies = new Map<string, FakeBody>();
      const calls: Array<string> = [];
      const queue: Array<Collision> = [];
      const world: FakeWorld = {
        calls,
        bodies,
        queue,
        disposed: false,
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
        },
        step: (seconds) => {
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
      };
      worlds.push(world);
      return world;
    },
  };
  return { engine, worlds };
};
