# ADR-001: Greenfield implementation instead of extending three-effect

- Status: Accepted (2026-10-14)
- Deciders: project owner
- Evidence: [PLAN.md §7](../PLAN.md), [spike results](../spike-results.md)

## Context

The brief asks for an Effect-native, declarative Three.js library with a thin Foldkit adapter. [OpenAgentsInc/three-effect](https://github.com/OpenAgentsInc/three-effect) already provides "Effect and Foldkit bindings for resource-scoped Three.js scenes". We can extend it or start fresh and use it, React Three Fiber, Drei, three.js and Foldkit as references.

## Comparison (verified 2026-10-14)

| Criterion           | Extend three-effect                                                                          | Greenfield                                           |
| ------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Effect              | `4.0.0-beta.94`                                                                              | `4.0.0` (Foldkit's exact peer)                       |
| Foldkit             | `0.102.1` (66 minor versions behind)                                                         | `0.168.0`                                            |
| TypeScript / three  | 6.0.3 / 0.184                                                                                | 7.0.2 / 0.186.1                                      |
| Reconciler          | 207 LOC; `kind: string`, `props: unknown`; imperative `update()` returning `boolean \| void` | typed closed catalogue; pure `diff → Op[]` + applier |
| Disposal            | handles with `dispose: () => void` and a custom `SceneResourceScope`                         | Effect `Scope`, `acquireRelease`, `RcMap`            |
| Foldkit integration | scene-specific custom elements (`oa-spinning-cube`, …), a renderer per element               | one generic declarative scene element (ADR-002)      |
| Surface             | 60+ primitive modules (HUD, MMO entities, controllers, particles)                            | vertical slice only                                  |
| Lint ruleset fit    | `import * as Three`, untyped props; not designed for oxlint-effect                           | designed for it (ADR-003)                            |
| Activity            | 128 commits, 9 stars, last push 2026-07-14                                                   | —                                                    |
| Licence             | Apache-2.0                                                                                   | MIT                                                  |

## Decision

Build greenfield. Treat three-effect, R3F, Drei, three.js and Foldkit as references. Don't copy code from any of them.

Extending three-effect would mean replacing its reconciler, its disposal model, its Foldkit integration and its dependency baseline. That is a rewrite that would also inherit a large surface the brief explicitly excludes ("Avoid premature Drei parity, scene-specific helpers, ECS systems or physics engines").

## What we take from each reference (ideas, not code)

- **three-effect:** a consumer typecheck project (`tsconfig.consumer.json`), headless capture scripts, the idea of a frame clock primitive and replayable proofs.
- **React Three Fiber:** host-config catalogue, `frameloop: always | demand | never` + `invalidate()`, raycast-based pointer events, an opt-out of disposal for borrowed objects.
  - **Avoid:** implicit recursive disposal of shared resources, and a loader cache that never releases.
- **Drei:** nothing for the slice. Revisit for loaders and controls after v0.
- **three.js:** `dispose()` contracts, `renderer.info.memory` as a leak oracle, `setAnimationLoop`, `WebGPURenderer`'s async `init()`.
- **Foldkit:** `Canvas.view` as the API shape precedent, `Mount` scope semantics, Schema-decoded `CustomElement` events, `viewStateChanges` for time travel.

## Consequences

- No inherited API debt. Every public API is designed against the lint ruleset and strict TypeScript from the start.
- More initial work than a fork, estimated at 19–24 engineer-days for the slice (PLAN §8).
- Clean-room rule: if any code is ever ported from three-effect (Apache-2.0), keep its NOTICE and attribution, and record it in this ADR.
