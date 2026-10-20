# ADR-011: Replays record what the player did; the simulation does the rest

- Status: Proposed (2026-10-18). A spike on the bowling sample is the evidence so far.
- Evidence: `packages/effect-three-samples/src/bowling/replay.ts`, `test/bowling-replay.test.ts`,
  and headless browser runs (Chromium, SwiftShader): a game of six rolls with varied
  start, line and speed, each rolled after a random pause, replayed from its link in a
  fresh page and again in the same page. Every roll knocked down the same pins, and the
  hardest contact force matched to the newton. Two separately played games with
  different pauses gave identical results (6, 1, 4, 2, 6, 0): the outcome is a function
  of the inputs, not of when they came.
- References: Rapier's determinism notes (rapier.rs, "Determinism"): with the same
  build, the same inputs at the same steps give the same results; the
  `*-deterministic` builds extend that across platforms.

## Context

A Foldkit Model is the whole truth of an application, and every change to it is a
Message. Replaying the Messages replays the application. A scene with physics is
different: where a body is belongs to the simulation, not the Model, and the events the
simulation reports (`Collision`, `ContactForce`, and the sensor events bowling counts
pins with) are Messages the Model receives but did not cause. Replaying those would
replay what happened without the world that made it happen.

Shareable runs, ghost replays, reproducible bug reports and lockstep multiplayer all
want the same thing: a run reproduced from a small record.

## Decision (proposed)

- **Record intent, not outcome.** A replay is the player's inputs (for bowling, each
  roll's start, line and speed), never the events the simulation produced from them.
  Replaying feeds the inputs back and lets the simulation produce the events again.
- **Make each input start from a state that does not depend on timing.** Physics steps
  are fixed, so the world is a function of its inputs and the steps between them. The
  number of steps between two inputs depends on how long the player took, so an input
  must meet a world that has stopped changing:
  - bodies an input sets in motion are created by it, with their impulse (a fresh body
    carries no history), rather than pushed after sitting for a while;
  - an input is accepted only once the world it acts on has come to rest: Rapier puts
    resting bodies to sleep after two seconds, and asleep they do not change at all.
- **Check the replay against the record.** The record keeps the outcomes too (pins
  knocked by each roll); a replay compares what it produced with them, so a divergence
  is found, not assumed away.
- **The record is data in the address.** Inputs and outcomes encode into a short
  fragment (`#replay=…`), decoded and validated before use: a link is a replay.

## Consequences

- Replays are exact on the same build, across page loads; across machines they rely on
  WebAssembly's deterministic floating point and, to be guaranteed, on Rapier's
  deterministic build (`@opsydyn/effect-three-rapier/deterministic` since ADR-014).
- Waiting for rest costs the player a moment between rolls; it is what makes the
  record small. Inputs that must land mid-motion (a flipper, a steering wheel) need the
  step count recorded with them, and the engine to apply inputs at step boundaries:
  the next step towards lockstep multiplayer. (Since built: `physics({ until })` and
  `Timeline`, ADR-014, which a replay can use for inputs at any step.)
- Foldkit DevTools time travel shows the Model at a past Message but not the physics
  world then; an event-sourced replay re-simulates instead. Checkpointing the world
  (Rapier can snapshot it) would join the two.
