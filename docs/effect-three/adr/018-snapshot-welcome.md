# ADR-018: Snapshots of a world, and a newcomer welcomed with one

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/physicsSnapshot.test.ts` (a world stopping at
  `snapshotAt` on its way to `until`, reporting a snapshot there and going on; asked for
  one where it already waits, reporting there again with the same checksum; a run started
  `from` a snapshot reaching later steps as the world it was taken from, taking on its
  bodies rather than adding them or giving their impulses again; a body the snapshot lacks
  added and one the description lacks removed, joints kept; an engine that can neither
  snapshot nor restore reporting without and starting from the description; snapshots as
  text, and scene files keeping `snapshotAt` and `from`);
  `packages/effect-three-rapier/test/lockstep.test.ts` (both Rapier builds: the pile and
  throws snapshotted at step 60 and started from there reach every later step with the
  same checksums, and taking the snapshot changes nothing; a pendulum on a joint
  restored mid-swing ends where one never snapshotted does);
  `packages/effect-three-rapier/test/worker.test.ts` (a world in a worker snapshots, and
  starts from a snapshot, as one in the page does);
  `packages/effect-three-samples/test/tabletop.test.ts` (a newcomer starting from the
  leader's latest snapshot, at a check step, with the record still whole; one welcomed
  before there is a snapshot replaying from step 0; only the leader snapshotting); and
  headless Chromium on the promo's tabletop, three tabs: the second and third joined from
  snapshots at steps 480 and 2100 and every check agreed (38, 38 and 11); and again with
  the leader and the third stepping in workers and the second in the page (snapshots
  taken in a worker, restored in the page and in another worker): none out of step.
- References: Rapier's `World.takeSnapshot` and `World.restoreSnapshot` (0.21), which
  restore a world exactly: in a spike, a world restored from a snapshot and stepped 200
  more times matched the original to the bit. ADR-014, whose consequences asked for this.

## Context

A lockstep newcomer was welcomed with the whole record and replayed it from step 0, a
second of steps a frame: the longer the game, the longer the wait, and the more the
newcomer's catch-up depends on its frame rate (ADR-014's consequences).

## Decision

- **`physics({ snapshotAt })` is a stop on the way to `until`.** The world reports there
  (`PhysicsReached`) with `snapshot`, the world as text (base64), and goes on without
  waiting. Asked for at the step it already waits at, it reports there again with one.
- **`physics({ from: { step, snapshot } })` starts a run from a snapshot.** The world is
  made from it, counting on from its step; the scene graph takes on the bodies and joints
  it holds (`RestoredWorld`), adds what the description has that it lacks, and removes
  what it holds that the description does not. `from` is read when a run starts.
- **Engines opt in:** `PhysicsWorld.snapshot()` and `PhysicsEngine.restoreWorld()`. An
  engine without them reports without a snapshot and starts from the description. A world
  in a worker asks the worker for its snapshot, and the report waits for it.
- **Rapier's snapshot** is Rapier's own with an index of which bodies, colliders and
  joints are which, read without Rapier, so the page side of a worker knows what a world
  it restores holds.
- **The tabletop welcomes with a snapshot.** The leader snapshots its world at each check
  step (a stop already) and keeps the latest with the table as it was there (balls, throw
  count, tower build). A Welcome carries it as `start` alongside the whole record, which a
  replay link still needs; the newcomer's run starts `from` it, takes the inputs before
  its step as done, and replays only what came after.

## Consequences

- A newcomer catches up from at most a second behind the leader's world, however long
  the game has run.
- A snapshot is tens of kilobytes (about 21 KB for a dozen bodies), sent once per
  welcome. The leader makes one a second; nobody else does.
- A snapshot is the engine's: Rapier's standard and deterministic builds each restore
  their own. Peers must share a build, as lockstep already requires.
- Rollback is still not done; snapshots are what it would restore.
