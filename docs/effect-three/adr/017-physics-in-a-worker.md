# ADR-017: Physics in a worker, behind the same engine contract

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/physicsElsewhere.test.ts` (a world whose calls
  are done only when the test delivers them: a world on `until` reported only once they
  are, with the report a world stepping on the spot gives, and its bodies shown where it
  put them; collisions heard in the frame after they come back);
  `packages/effect-three-rapier/test/worker.test.ts` (the lockstep pile and throws with
  the world behind `remotePhysics`, over a `MessageChannel` and in a real Bun `Worker`:
  the same reports, checksums and all, the same collisions, and the bodies shown where an
  engine in the page puts them; a world reported at step 0 giving the checksum of
  Rapier's single-precision poses, not the described ones, which failed before reports
  waited for every call's answer); and headless Chromium on the promo's tabletop, three
  tabs in one session, two with `?physics=worker` and one stepping in the page: no check
  out of step (56, 55 and 4 agreed); and a game recorded in the page, replayed with
  physics in a worker: 12 of the record's 12 checks matched. The promo's production build
  emits the worker as its own chunk.
- References: react-three-rapier steps in the page (`src/components/Physics.tsx` at
  `ae5c3fe`), with no worker option; Rapier's JavaScript bindings are synchronous over
  WebAssembly memory, so a world must live in the thread that steps it. ADR-014 for
  `until`, reports and checksums.

## Context

Roadmap 6 asks for Rapier in a Worker behind the same engine contract. `PhysicsWorld` is
synchronous: the scene graph calls `step` and reads collisions back, reads `pose` for
every body every frame, and reports `PhysicsReached` with a checksum of the poses as soon
as a world on `until` gets there. A worker answers later.

## Decision

- **Pipelined, not blocking.** In the page, `remotePhysics(port)` makes worlds that queue
  what they are asked and send a frame's worth in one message (after the frame's work,
  in a microtask). `pose`, `contactForces`, `debugLines` and `awake` answer from the last
  reply; a body placed in the page (added, teleported, removed) keeps that place until a
  reply from after it arrives. `awake` stays true while anything is unanswered, so frames
  keep coming.
- **One optional method on the contract:** `PhysicsWorld.received()` returns the
  collisions that came back since the last call and whether anything is still `pending`.
  The scene graph takes it every frame (with the forces and poses), and a world on `until`
  is reported as there only once nothing is pending, so the checksum is of the engine's
  own poses, as in the page. A world without it is unchanged.
- **In the worker, `servePhysics(port, engine)`** handles messages in order once the
  engine has loaded, makes and disposes worlds, does each batch of calls, and answers with
  the batch's collisions, forces, every body's pose and the debug lines while they are
  drawn. A batch that throws is answered with why, and the page raises it.
- **A separate entry, `@opsydyn/effect-three-rapier/worker`,** imports no Rapier: the page
  does not load the WebAssembly; the worker loads either build.

## Consequences

- What is shown lags what was asked by about a frame, and a world on `until` reports a
  frame later than one in the page. In lockstep a peer whose physics is in a worker trails
  slightly; every check still agrees.
- Messages are structured clones of descriptions, colliders (typed arrays) and poses: a
  world of hundreds of bodies sends hundreds of poses a frame.
- The protocol is engine-neutral: any `PhysicsEngine` can be served from a worker.
