/**
 * Rapier physics for `@opsydyn/effect-three`: a `PhysicsEngine` that the scene graph
 * steps. Load it once, before making the environment, and pass it on:
 *
 * ```ts
 * const physics = await loadRapier();
 * const environment = EffectThreeFoldkit.makeEnvironment(window, { physics });
 * ```
 *
 * Bodies are described on meshes (`body()`) under a scene's `physics()`; this package
 * only turns those descriptions into Rapier bodies and colliders, as react-three-rapier's
 * `RigidBody` does (`ae5c3fe`, `src/utils/utils-rigidbody.ts` and `utils-collider.ts`).
 *
 * Rapier (`@dimforge/rapier3d-compat`) is Apache-2.0; its WebAssembly is embedded, so
 * nothing extra is fetched.
 *
 * @module
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type {
  Body,
  BodyPose,
  ColliderShape,
  Collision,
  Physics,
  PhysicsEngine,
  PhysicsWorld,
  Vec3,
} from '@opsydyn/effect-three';

type Rapier = typeof RAPIER;

const vector = ([x, y, z]: Vec3) => ({ x, y, z });

const rotation = ([x, y, z, w]: BodyPose['quaternion']) => ({ x, y, z, w });

/** Body types by our names. Kinematic bodies are position based, as react-three-rapier's default. */
const bodyTypes = {
  dynamic: RAPIER.RigidBodyType.Dynamic,
  fixed: RAPIER.RigidBodyType.Fixed,
  kinematic: RAPIER.RigidBodyType.KinematicPositionBased,
} satisfies Record<Body['type'], RAPIER.RigidBodyType>;

/** The collider description for a shape; a hull Rapier cannot build becomes a small ball. */
const colliderDesc = (rapier: Rapier, shape: ColliderShape): RAPIER.ColliderDesc => {
  switch (shape._tag) {
    case 'Cuboid':
      return rapier.ColliderDesc.cuboid(...shape.halfExtents).setTranslation(...shape.offset);
    case 'Ball':
      return rapier.ColliderDesc.ball(shape.radius).setTranslation(...shape.offset);
    case 'Hull':
      return rapier.ColliderDesc.convexHull(shape.points) ?? rapier.ColliderDesc.ball(1e-3);
    case 'Trimesh':
      return rapier.ColliderDesc.trimesh(shape.vertices, shape.indices);
  }
};

/** Applies a body's surface and mass settings to its collider. */
const surface = (collider: RAPIER.Collider, body: Body): void => {
  collider.setFriction(body.friction);
  collider.setRestitution(body.restitution);
  collider.setSensor(body.sensor);
  if (body.mass === null) collider.setDensity(1);
  else collider.setMass(body.mass);
};

/** Applies a body's motion settings. */
const motion = (rigidBody: RAPIER.RigidBody, body: Body): void => {
  rigidBody.setBodyType(bodyTypes[body.type], true);
  rigidBody.setLinearDamping(body.linearDamping);
  rigidBody.setAngularDamping(body.angularDamping);
  rigidBody.setGravityScale(body.gravityScale, true);
  rigidBody.enableCcd(body.ccd);
};

type Held = { readonly rigidBody: RAPIER.RigidBody; readonly collider: RAPIER.Collider };

const createWorld =
  (rapier: Rapier) =>
  (initial: Physics): PhysicsWorld => {
    const world = new rapier.World(vector(initial.gravity));
    const events = new rapier.EventQueue(true);
    const bodies = new Map<string, Held>();
    const keysByCollider = new Map<number, string>();

    const add: PhysicsWorld['add'] = (key, body, shape, pose) => {
      const desc = new rapier.RigidBodyDesc(bodyTypes[body.type])
        .setTranslation(...pose.position)
        .setRotation(rotation(pose.quaternion))
        .setLinvel(...body.linearVelocity)
        .setAngvel(vector(body.angularVelocity))
        .setLinearDamping(body.linearDamping)
        .setAngularDamping(body.angularDamping)
        .setGravityScale(body.gravityScale)
        .setCcdEnabled(body.ccd);
      const rigidBody = world.createRigidBody(desc);
      const collider = world.createCollider(
        colliderDesc(rapier, shape).setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS),
        rigidBody,
      );
      surface(collider, body);
      bodies.set(key, { rigidBody, collider });
      keysByCollider.set(collider.handle, key);
    };

    const remove: PhysicsWorld['remove'] = (key) => {
      const held = bodies.get(key);
      if (held === undefined) return;
      keysByCollider.delete(held.collider.handle);
      world.removeRigidBody(held.rigidBody);
      bodies.delete(key);
    };

    const collisionsOf = (): ReadonlyArray<Collision> => {
      const collisions: Array<Collision> = [];
      events.drainCollisionEvents((first, second, started) => {
        const a = keysByCollider.get(first);
        const b = keysByCollider.get(second);
        if (a !== undefined && b !== undefined) collisions.push({ a, b, started });
      });
      return collisions;
    };

    return {
      configure: (physics) => {
        world.gravity = vector(physics.gravity);
      },
      add,
      update: (key, body) => {
        const held = bodies.get(key);
        if (held === undefined) return;
        motion(held.rigidBody, body);
        surface(held.collider, body);
      },
      teleport: (key, pose) => {
        const held = bodies.get(key);
        if (held === undefined) return;
        held.rigidBody.setTranslation(vector(pose.position), true);
        held.rigidBody.setRotation(rotation(pose.quaternion), true);
        held.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        held.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      },
      moveKinematic: (key, pose) => {
        const held = bodies.get(key);
        if (held === undefined) return;
        held.rigidBody.setNextKinematicTranslation(vector(pose.position));
        held.rigidBody.setNextKinematicRotation(rotation(pose.quaternion));
      },
      applyImpulse: (key, impulse) => {
        bodies.get(key)?.rigidBody.applyImpulse(vector(impulse), true);
      },
      remove,
      step: (seconds) => {
        world.timestep = seconds;
        world.step(events);
        return collisionsOf();
      },
      pose: (key) => {
        const held = bodies.get(key);
        if (held === undefined) return undefined;
        const { x, y, z } = held.rigidBody.translation();
        const turn = held.rigidBody.rotation();
        return { position: [x, y, z], quaternion: [turn.x, turn.y, turn.z, turn.w] };
      },
      awake: () => {
        for (const { rigidBody } of bodies.values()) {
          if (rigidBody.isDynamic() && !rigidBody.isSleeping()) return true;
        }
        return false;
      },
      dispose: () => {
        bodies.clear();
        keysByCollider.clear();
        events.free();
        world.free();
      },
    };
  };

/**
 * Loads Rapier's WebAssembly and returns the engine. Call once per page; the engine makes
 * a world for each scene with physics.
 */
export const loadRapier = async (): Promise<PhysicsEngine> => {
  await RAPIER.init();
  return { createWorld: createWorld(RAPIER) };
};
