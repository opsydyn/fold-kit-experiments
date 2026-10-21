# ADR-019: Rollback for physics in lockstep, from snapshots the world keeps

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/physicsSnapshot.test.ts` (a world keeping its
  latest stops, a run going back to one and on again to the same world, a stop no longer
  kept starting over from step 0, and a run from a snapshot going straight to `until`);
  `packages/effect-three-samples/test/tabletop.test.ts` (stand-in worlds over a network
  that delays every message: predicting peers rolling back and agreeing at every step both
  reached, a predicting peer playing with one that does not, and a predicting peer's own
  throw on its table a turn after the click where the other's takes several);
  `packages/effect-three-samples/test/tabletopRapier.test.ts` (the tabletop's Models
  driving scene graphs on Rapier's deterministic build, messages two turns late: 5 and 3
  rollbacks, and the two worlds' checksums equal at every check step both reached; again
  with one peer not predicting); and headless Chromium: three predicting tabs (every check
  agreed; one tab rolled back twice), three browser contexts through the relay, and three
  tabs with physics in workers, none out of step.
- References: rollback netcode (GGPO): run ahead on the inputs you have, keep the states
  you passed, and when an input arrives for a step you passed, restore the state before
  it and simulate forward again. ADR-014 (lockstep physics), ADR-018 (snapshots).

## Context

In lockstep (ADR-014) every input waits for the turn that carries it: a peer's own throw
shows a turn or two after the click (two turns of lead, about 100 ms, plus the network).
ADR-018 gave worlds snapshots, so a world can go back.

## Decision

- **`physics({ keep })`**: a world keeps snapshots of its latest stops itself (bytes, never
  through the Model), and `physics({ from: { step, snapshot: null } })` starts a run from
  the one it kept at that step, discarding what it kept after. A run from a snapshot goes
  straight to `until` in its first frame, however close: a rollback re-simulates at once.
  A step it did not keep starts over from the description.
- **The tabletop predicts with `?predict=1`.**
  - Its world runs to the turn it sends next, not the turn all have sent.
  - Its own throws are scheduled when their packet goes out, at that packet's turn: certain,
    since lockstep applies them there.
  - When a turn is applied, its plays (in the session's order) replace what was scheduled
    at its step; if they differ and the world may have passed that step, the Model rolls
    back: a new run from the latest kept stop at or before it, with the table as it was
    there (the Model remembers the table at each stop) and the timeline from there on.
  - Checks and the welcome's snapshot count only once every input before their step is
    certain (the step is at or before the applied turn's), so peers compare only worlds
    that will not change.
- **Lockstep bounds it.** A peer sends at most `lead` turns ahead of the applied turn, so a
  predicting world is at most a few steps ahead and rolls back a few steps; it keeps twelve
  stops.

## Consequences

- A predicting peer sees its own throws at once; another's throw that lands where its world
  has been moves the table to where it should be (a correction a few steps long).
- Each stop costs a snapshot (tens of kilobytes, in the page; through a worker, a round trip
  that delays the report a frame). Peers that never predict are unchanged.
- The prediction is that others did nothing. Late throws are what it gets wrong; they are
  rare between tabs and frequent over a slow network.
