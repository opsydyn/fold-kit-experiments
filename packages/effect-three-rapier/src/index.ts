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
 * `RigidBody` does (`ae5c3fe`, `src/utils/utils-rigidbody.ts` and `utils-collider.ts`),
 * and joints into impulse joints, as its joint hooks do (`src/hooks/joints.ts`).
 *
 * Rapier (`@dimforge/rapier3d-compat`) is Apache-2.0; its WebAssembly is embedded, so
 * nothing extra is fetched.
 *
 * @module
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { interactionBits } from '@opsydyn/effect-three';
import type {
  Body,
  BodyPose,
  Collider,
  ColliderShape,
  Collision,
  Physics,
  ContactForce,
  JointLimits,
  JointMotor,
  PhysicsEngine,
  PhysicsJoint,
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
const shapeDesc = (rapier: Rapier, shape: ColliderShape): RAPIER.ColliderDesc => {
  switch (shape._tag) {
    case 'Cuboid':
      return rapier.ColliderDesc.cuboid(...shape.halfExtents);
    case 'Ball':
      return rapier.ColliderDesc.ball(shape.radius);
    case 'Hull':
      return rapier.ColliderDesc.convexHull(shape.points) ?? rapier.ColliderDesc.ball(1e-3);
    case 'Capsule':
      return rapier.ColliderDesc.capsule(shape.halfHeight, shape.radius);
    case 'Cylinder':
      return rapier.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
    case 'Cone':
      return rapier.ColliderDesc.cone(shape.halfHeight, shape.radius);
    case 'Trimesh':
      return rapier.ColliderDesc.trimesh(shape.vertices, shape.indices);
  }
};

/** A collider placed in its body. */
const colliderDesc = (rapier: Rapier, collider: Collider): RAPIER.ColliderDesc =>
  shapeDesc(rapier, collider.shape)
    .setTranslation(...collider.translation)
    .setRotation(rotation(collider.rotation));

/**
 * The events a body's colliders report: collisions always, contact forces over its
 * threshold when it has one (react-three-rapier's `onContactForce` turns on
 * `CONTACT_FORCE_EVENTS`).
 */
const reporting = (colliders: ReadonlyArray<RAPIER.Collider>, body: Body): void => {
  for (const collider of colliders) {
    if (body.contactForces === null) {
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      continue;
    }
    collider.setActiveEvents(
      RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
    );
    collider.setContactForceEventThreshold(body.contactForces);
  }
};

/**
 * Applies a body's surface and mass settings to its colliders. A given mass is shared
 * among them; otherwise each has density 1.
 */
const surface = (colliders: ReadonlyArray<RAPIER.Collider>, body: Body): void => {
  for (const collider of colliders) {
    collider.setFriction(body.friction);
    collider.setRestitution(body.restitution);
    collider.setSensor(body.sensor);
    if (body.mass === null) collider.setDensity(1);
    else collider.setMass(body.mass / colliders.length);
    collider.setCollisionGroups(interactionBits(body.collisionGroups));
    collider.setSolverGroups(interactionBits(body.solverGroups));
  }
};

/** Applies a body's motion settings. */
const motion = (rigidBody: RAPIER.RigidBody, body: Body): void => {
  rigidBody.setBodyType(bodyTypes[body.type], true);
  rigidBody.setLinearDamping(body.linearDamping);
  rigidBody.setAngularDamping(body.angularDamping);
  rigidBody.setGravityScale(body.gravityScale, true);
  rigidBody.enableCcd(body.ccd);
};

/** The limits a joint has, if it is a hinge or slider with limits. */
const limitsOf = (joint: PhysicsJoint): JointLimits | null =>
  joint.kind._tag === 'Revolute' || joint.kind._tag === 'Prismatic' ? joint.kind.limits : null;

/** The motor a joint has, if it is a hinge or slider with one. */
const motorOf = (joint: PhysicsJoint): JointMotor | null =>
  joint.kind._tag === 'Revolute' || joint.kind._tag === 'Prismatic' ? joint.kind.motor : null;

/** Drives a hinge or slider once made: Rapier's `configureMotor`, set on the joint. */
const drive = (made: RAPIER.ImpulseJoint, motor: JointMotor | null): void => {
  if (motor !== null && made instanceof RAPIER.UnitImpulseJoint) {
    made.configureMotor(motor.position, motor.velocity, motor.stiffness, motor.damping);
  }
};

/**
 * Limits a hinge or slider once made. React-three-rapier sets them on the joint data, but
 * Rapier's `JointData.intoRaw` (0.21) passes them on for prismatic joints only, so a
 * hinge's would be lost: they are set on the joint instead.
 */
const limit = (made: RAPIER.ImpulseJoint, limits: JointLimits | null): void => {
  if (limits !== null && made instanceof RAPIER.UnitImpulseJoint) made.setLimits(...limits);
};

/** Rapier's joint data for a joint, anchors in each body's space. */
const jointData = (rapier: Rapier, joint: PhysicsJoint): RAPIER.JointData => {
  const a = vector(joint.anchorA);
  const b = vector(joint.anchorB);
  const { kind } = joint;
  switch (kind._tag) {
    case 'Fixed':
      return rapier.JointData.fixed(a, rotation(kind.frameA), b, rotation(kind.frameB));
    case 'Spherical':
      return rapier.JointData.spherical(a, b);
    case 'Revolute':
      return rapier.JointData.revolute(a, b, vector(kind.axis));
    case 'Prismatic':
      return rapier.JointData.prismatic(a, b, vector(kind.axis));
    case 'Rope':
      return rapier.JointData.rope(kind.length, a, b);
    case 'Spring':
      return rapier.JointData.spring(kind.restLength, kind.stiffness, kind.damping, a, b);
  }
};

/** Which body a collider belongs to, and which part of it, by name. */
type Owner = { readonly key: string; readonly part?: string };

/** Two colliders' owners as an event's `a` and `b`, with their parts. */
const pair = (a: Owner, b: Owner) => ({
  a: a.key,
  b: b.key,
  ...(a.part === undefined ? {} : { aPart: a.part }),
  ...(b.part === undefined ? {} : { bPart: b.part }),
});

type Held = {
  readonly rigidBody: RAPIER.RigidBody;
  readonly colliders: ReadonlyArray<RAPIER.Collider>;
};

const createWorld =
  (rapier: Rapier) =>
  (initial: Physics): PhysicsWorld => {
    const world = new rapier.World(vector(initial.gravity));
    const events = new rapier.EventQueue(true);
    const bodies = new Map<string, Held>();
    /** Each collider's body, and the part of it the collider is (when named). */
    const keysByCollider = new Map<number, Owner>();
    const joints = new Map<
      string,
      { readonly joint: RAPIER.ImpulseJoint; readonly a: string; readonly b: string }
    >();

    const add: PhysicsWorld['add'] = (key, body, colliders, pose) => {
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
      const made = colliders.map((collider) =>
        world.createCollider(colliderDesc(rapier, collider), rigidBody),
      );
      surface(made, body);
      reporting(made, body);
      bodies.set(key, { rigidBody, colliders: made });
      made.forEach((collider, i) => {
        const part = colliders[i]?.part;
        keysByCollider.set(collider.handle, { key, ...(part === undefined ? {} : { part }) });
      });
    };

    const remove: PhysicsWorld['remove'] = (key) => {
      const held = bodies.get(key);
      if (held === undefined) return;
      for (const collider of held.colliders) keysByCollider.delete(collider.handle);
      // Rapier removes the body's joints with it; forget them, as their handles are reused.
      for (const [id, joined] of joints)
        if (joined.a === key || joined.b === key) joints.delete(id);
      world.removeRigidBody(held.rigidBody);
      bodies.delete(key);
    };

    const addJoint: PhysicsWorld['addJoint'] = (id, joint, a, b) => {
      const first = bodies.get(a);
      const second = bodies.get(b);
      if (first === undefined || second === undefined) return;
      const made = world.createImpulseJoint(
        jointData(rapier, joint),
        first.rigidBody,
        second.rigidBody,
        true,
      );
      limit(made, limitsOf(joint));
      drive(made, motorOf(joint));
      made.setContactsEnabled(joint.contacts);
      joints.set(id, { joint: made, a, b });
    };

    const removeJoint: PhysicsWorld['removeJoint'] = (id) => {
      const joined = joints.get(id);
      if (joined === undefined) return;
      world.removeImpulseJoint(joined.joint, true);
      joints.delete(id);
    };

    const collisionsOf = (): ReadonlyArray<Collision> => {
      const collisions: Array<Collision> = [];
      events.drainCollisionEvents((first, second, started) => {
        const a = keysByCollider.get(first);
        const b = keysByCollider.get(second);
        if (a !== undefined && b !== undefined) collisions.push({ ...pair(a, b), started });
      });
      return collisions;
    };

    /** Contact force events since the last call, kept across steps until asked for. */
    let forces: Array<ContactForce> = [];
    function recordForce(event: RAPIER.TempContactForceEvent): void {
      const a = keysByCollider.get(event.collider1());
      const b = keysByCollider.get(event.collider2());
      if (a === undefined || b === undefined) return;
      const total = event.totalForce();
      const direction = event.maxForceDirection();
      forces.push({
        ...pair(a, b),
        totalForce: [total.x, total.y, total.z],
        totalForceMagnitude: event.totalForceMagnitude(),
        maxForceDirection: [direction.x, direction.y, direction.z],
        maxForceMagnitude: event.maxForceMagnitude(),
      });
    }
    const drainForces = (): void => events.drainContactForceEvents(recordForce);

    return {
      configure: (physics) => {
        world.gravity = vector(physics.gravity);
      },
      add,
      update: (key, body) => {
        const held = bodies.get(key);
        if (held === undefined) return;
        motion(held.rigidBody, body);
        surface(held.colliders, body);
        reporting(held.colliders, body);
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
      addJoint,
      removeJoint,
      step: (seconds) => {
        world.timestep = seconds;
        world.step(events);
        drainForces();
        return collisionsOf();
      },
      contactForces: () => {
        const drained = forces;
        forces = [];
        return drained;
      },
      // react-three-rapier's Debug: Rapier's own line rendering of colliders and joints.
      debugLines: () => {
        const { vertices, colors } = world.debugRender();
        return { vertices, colors };
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
        joints.clear();
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
