# ADR-007: Physics is a pose source, described as data

- Status: Accepted (2026-10-16).
- Evidence: `packages/effect-three/src/kernel/physics.ts` and `bodies.ts`,
  `packages/effect-three-rapier`, `test/physics.test.ts` (kernel, with a fake engine),
  `packages/effect-three-rapier/test/rapier.test.ts` (real Rapier), the toybox sample.
- References: react-three-rapier at `ae5c3fe` (2.2.0): `src/components/Physics.tsx`,
  `src/utils/utils-collider.ts`, `src/utils/utils-rigidbody.ts`.

## Context

In react-three-rapier, `<Physics>` owns a Rapier world stepped in `useFrame`, and each
`<RigidBody>` mutates its object's transform every frame. Applications push bodies around
through refs (`api.applyImpulse`) and learn of contacts through callbacks.

Here the scene is a description derived from the Model, and the kernel must stay free of
Effect and of any particular engine.

## Decision

- **Bodies are data on meshes.** `mesh({ body: body({ type, collider, mass, friction,
restitution, damping, gravityScale, ccd, sensor, linearVelocity, angularVelocity,
impulse }) })` under `scene({ physics: physics({ gravity, paused, timeStep,
interpolate }) })`, with react-three-rapier's and Rapier's defaults.
- **The simulation owns a dynamic body's pose.** The description says where it starts;
  changing its position or rotation later teleports it there at rest. A kinematic body
  follows its node's transform (transitions and behaviours included); a fixed one stays.
- **Kicks are data with an identity.** `impulse: { id, impulse }` is applied once, when
  its `id` is new, so re-rendering never applies it twice.
- **The kernel steps, an engine simulates.** The kernel works out colliders from the
  mesh's geometry and world scale (react-three-rapier's auto colliders), steps on scene
  time in fixed steps with the delta clamped to 0.5 s, interpolates poses between steps,
  and converts them into each parent's space. A `PhysicsEngine` is a small synchronous
  contract; `@opsydyn/effect-three-rapier` implements it with Rapier, keeping its 15 MB of
  WebAssembly out of the core.
- **Collisions are scene events.** `Collision { a, b, started }` travels with pointer
  events; Foldkit's `onCollision` maps it to a Message.
- **Frames stop when everything sleeps.** A world asks for frames only while a dynamic body
  is awake, so a settled scene costs nothing.
- **Loading is the environment's.** `makeEnvironment(window, { physics: loadRapier() })`
  takes the engine or its promise; each scene mount waits for it, and a failed load is a
  `FailedScene`.

## Consequences

- Physics state lives outside the Model, like a playing video: DevTools time travel
  replays Messages but not the simulation's exact state. The Model holds what matters to
  the app (what exists, where it was dropped, the kicks, the collisions it counted).
- Dynamic bodies ignore their node's transitions and behaviours: the simulation writes
  their pose last.
- Not yet: joints, instanced bodies (react-three-rapier's `InstancedRigidBodies`), bodies
  on groups and borrowed models, compound colliders, contact forces, and the debug view.
