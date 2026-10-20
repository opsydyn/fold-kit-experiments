# ADR-014: The Model keeps the physics clock, and inputs land at a step

- Status: Accepted (2026-10-20), for physics shared in lockstep; rollback is still to
  come.
- Evidence: `packages/effect-three/test/physicsUntil.test.ts` (a world on `until` stops
  there and says so once, after that frame's collisions; what changes while it waits
  lands at that step, and four frame timings from 1/144 s to 0.4 s give the same reports;
  catching up a second of steps a frame, and scene time's pace close behind; stepping
  under reduced motion; asking for a frame when `until` moves on an asleep world; a new
  `run` starting over from the description), `test/timeline.test.ts` (inputs handed out
  at their step; a world driven by a timeline gives the same reports for five frame
  timings), `packages/effect-three-rapier/test/lockstep.test.ts` (real Rapier, both
  builds: a pile of boxes and balls thrown into it at scheduled steps, the same checksum
  at every step for three frame timings; leaving out the last throw changes the world
  after it and not before), `packages/effect-three-samples/test/tabletop.test.ts` (peers
  over a simulated network, a newcomer replaying the record, a third joining after
  throws from both and a rebuild, checks agreeing and a divergence found), and headless
  Chromium: three browser contexts (no shared channel) through the relay, and three tabs
  of one browser over the channel, throwing at the same tower. Every peer reached the
  same steps with the same checksums (105 checks agreed on one run, none out of step),
  including newcomers that replayed the record from step 0.
- References: classic deterministic lockstep with input delay (inputs scheduled a turn
  ahead, applied at a fixed simulation step); ADR-011 (record intent, not outcome) and
  ADR-013 (the lockstep protocol). Rapier's determinism notes: the `*-deterministic`
  builds give the same results on every platform for the same inputs at the same steps.

## Context

ADR-013 shares Edits, which are pure functions of the document. Physics is not: where a
body is belongs to Rapier, and a scene graph steps its world by scene time in fixed steps
from an accumulator (react-three-rapier's loop). Two peers that apply the same input in
the same lockstep turn still give it to their worlds after different numbers of steps,
because their frames fall differently, so their worlds drift apart from the first
throw. ADR-011 asked for the answer: the step count recorded with each input, and the
engine applying inputs at step boundaries.

## Decision

- **The Model can drive the world's clock: `physics({ until })`.** A world on `until`
  steps toward it in fixed steps, at scene time's pace while within a quarter second of
  it and straight there (up to a second of steps a frame) when further back, never
  past it. On reaching it the world waits and emits `PhysicsReached { run, step,
checksum }`, after the collisions of the steps that led there. Whatever the description
  changes while the world waits (an impulse, a new body, a removal, a teleport) is
  applied at that step, because nothing else steps it. `until: null` keeps the old,
  scene-time world.
- **The checksum is of every body's pose**, to the bit (FNV-1a over each pose's float64s,
  by body id), so peers that should agree can find out when they do not.
- **`physics({ run })` starts the world over.** A new number throws the world away and
  makes another at step 0, its bodies where the description puts them, not where the
  last world left them. Reports carry their run, so one from the old world, emitted
  between the Model's change and the next render, is told apart.
- **A world on `until` steps under reduced motion**, and asks for frames while it owes
  steps or a report, as other peers wait on it.
- **`Timeline` is the schedule as data.** Inputs stamped with their step, in order; a
  frontier the world may go to; `reach` for each report, `due` for what to apply there,
  and `until` for where to stop next. It is the record a replay keeps (ADR-011) and the
  one a lockstep session builds.
- **In a lockstep session, turn _t_'s inputs land at step _k·t_.** The frontier is the
  step of the next turn to apply, so the world waits there until that turn's inputs are
  known, then they land where it waits. A newcomer is welcomed with the whole record and
  replays it in a new run from step 0, catching up a second of steps a frame.
- **Peers share checks.** Every 60 steps each peer puts its checksum in its turn packet;
  the others compare it with theirs at that step (keeping their last thirty), so a world
  that went another way is found within a second of steps.
- **Rapier's deterministic build is an entry of its own,**
  `@opsydyn/effect-three-rapier/deterministic`, with
  `@dimforge/rapier3d-deterministic-compat` as an optional peer: the same engine over the
  build that is bit-identical across platforms. The engine now takes the Rapier module it
  runs on.

## Consequences

- A world on `until` lags the session by a turn or two (about 50 to 100 ms at the
  tabletop's 50 ms turns), the price of every input landing at a known step.
- The Model must change what the world sees only while the world waits: the inputs due
  at the step it reached. Reacting to the world's events (a collision that should remove
  a body) is the same: apply it at a report, not when the event arrives.
- Determinism covers the engine. What a scene feeds it must agree too: the same bodies,
  added in the same order, with the same colliders. Sines and cosines may round
  differently between browsers, so the tabletop turns nothing and sizes its ball collider
  explicitly; a rotated body or a collider measured from curved geometry is safe between
  machines on the same browser engine, and only checked there.
- A newcomer's catch-up is bounded by its frame rate: a second of steps a frame, and a
  frame for each stop along the record. Slow machines catch up slowly; nothing waits on
  them but their own view.
- An off-screen scene draws no frames, so its world waits there; lockstep goes on, and
  the world catches up when it is shown. A hidden page's timers slow to a second or
  more, so the tabletop steps out of a shared session while hidden and back in, as a
  newcomer, when shown.
- Rollback (predicting others' inputs and correcting) is not done: inputs wait for the
  turn that carries them. The record grows with the game; a snapshot welcome (Rapier can
  snapshot a world) would bound a newcomer's replay.
