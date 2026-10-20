# ADR-012: Scene tooling comes from the schemas and the kernel's own diff

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/sceneFile.test.ts` (every generated scene saved
  and read back unchanged, 100 runs of the property arbitraries; files without later
  fields read at their defaults), `test/history.test.ts`, `test/sceneChanges.test.ts`,
  `scripts/scene-diff.ts`, and the arrange sample's branching undo.

## Context

Roadmap "Beyond parity" 4 asks for tooling an editor needs: save and load, undo, and
scene diffs a reviewer can read. React Three Fiber leaves each to the application,
because a scene there is a tree of live objects. Here a scene is data with a schema, the
Model is immutable, and the kernel already computes what changed between two
descriptions to apply it.

## Decision

- **Files are the schema's encoding in a versioned envelope.** `SceneFile.save` writes
  `{ format: 'effect-three/scene', version: 1, scene }` as indented JSON through
  `SceneSchema`; `SceneFile.read` decodes it to a `Result`, failing with
  `UnreadableScene` and the schema's own account of where. Fields added later decode at
  their builders' defaults (as stored descriptions already do), so the version changes
  only for a change that defaults cannot bridge, and a reader then migrates.
- **Reading checks shapes, not scene rules.** Duplicate keys and unknown behaviours
  depend on what the app registers; `reconcile` already rejects them whole as
  `InvalidScene`. A file is read once and judged where it is used.
- **History is a tree of Model values.** Values are never changed in place, so keeping
  every one costs references. `History.record` after an undo starts a branch and keeps
  the old future; redo follows the branch last taken; `chooseBranch` and `jumpTo` take
  another. It is pure data with a schema (`SceneSchema.History(value)`), so it can sit
  in a Foldkit Model and be saved with it.
- **Diffs for review are the kernel's operations, named.** `sceneChanges` runs `diff`
  (what reconcile would apply) and compares the scene-wide settings the graph applies
  beside it, then the HUD's and render textures' scenes; `formatChanges` writes one line
  per change. `bun run scene:diff a.json b.json` prints them for two files. A behaviour
  named in either scene counts as known: a review judges what changed, not what an app
  registered.

## Consequences

- A saved scene is reviewable as text and as a list of changes, and a diff of two files
  says exactly what reconciling one into the other would do.
- History holds every state ever recorded; an app that records continuously should
  record at the end of a gesture (as the arrange sample does on a gizmo's `Finished`),
  not on every frame.
- Still to come under 4: an inspector generated from the scene schemas.
