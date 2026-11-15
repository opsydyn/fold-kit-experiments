# V2 history/workflow batch qualification

result: complete for the approved local v2 history/workflow batch.

claim: mixed-mode merge, review, playback and atomic restore/Undo are package-owned and mounted.

evidence: full tests, typecheck, lint/format, API docs, production build and mounted Chromium all passed; details below.

remaining uncertainty: human assistive technology, other browsers/devices, current CI, hosted use and v1-only portable adapters remain unqualified.

next: reconcile portable-adapter gaps into one bounded v2 compatibility batch.

Measured parent: `a5d90525`, isolated `codex/zloz-context-map` worktree.
See [ADR 0102](../../../docs/adr/0102-complete-v2-history-workflows.md).
Architecture, delivery and test-quality reviews are self-review.

## Accepted batch boundary

The approved completion gate is a mixed-mode archive merged, reviewed with ghosts
and change navigation, played/rewound, restored and undone without losing modes or
changing independent working/review histories. Package APIs implement the rules;
the mounted `/history/` workspace composes them in the shared sidebar shell.
No npm publication/deployment or broader C1/C2–C4/Q/R closure is claimed.

## Delivered package contract

- `mergeEditionsV2`: validate both full collections; detach/freeze; skip identical
  IDs/data; append new IDs in incoming order; block all additions on conflict with
  frozen review pins and no archive. Malformed/duplicate-within-input data throws.
- V2 model sessions: full `connectionHistory` graph/mode frames own Undo/Redo;
  native `past`/`future` graph arrays are derived compatibility projections. Shared
  commits, pointer gesture completion, measurement, redo invalidation and limits
  keep them synchronized. Legacy/standalone sessions keep fixed-mode graph history.
- V2 restore preview/apply: current revision, lifecycle, editable state, enabled
  Undo and fresh whole/granular policies. Mode-only changes are transactions;
  graph+mode exact repeats are no-ops. One Undo/Redo restores graph and mode together.
  Working camera, archive and origin are not rewritten. Frozen data reaches policy;
  thrown/vetoed callbacks produce no replacement editor.
- Pinned v2 playback wraps the existing ID/timing transport. Each review initializes
  in checkpoint mode with zero Undo; automatic play is opt-in, reduced motion
  pauses it, and manual stepping/rewind remain available.
- `displaySide` lets ghosts use the other checkpoint's geometry and movement toward
  the displayed side while preserving chronological added/removed meaning. Mode
  inspection does not emit a reveal event or initialize/move the working camera.
- A loose-only clipboard survives cross-mode Undo. Paste in strict mode rejects
  visibly without changing graph/history/Redo; returning to loose permits it.

No transient history, controller, timer or review state enters canonical wire data.
Hosts own model binding, immutable edition identity, preview pin binding, external
busy work and persistence. Public results are not authorization proofs.

## Tests, regressions and mutation sensitivity

Seven new core workflow tests cover atomic/idempotent/conflicting mixed-mode merge,
full-collection validation, actual input→input loose edges, graph+mode Restore/
Undo/Redo through ordinary edits, mode-only/no-op restore, limits, measurement and
native drag history projections, live policies, stale revisions, read-only/busy/
legacy rejection, policy failure, pinned playback, reduced motion and clipboard
compatibility after cross-mode Undo.

Two new presentation tests cover baseline ghost geometry/direction and retention
of chronological added/removed meaning. Existing presentation and legacy ghost
coverage remains green. The final affected core/view/workbench subset reports
**20 pass**; focused workflow runs and the full workspace suite are separate below.

The initial package tests failed at missing public exports. A temporary history
mutation retaining current mode during Undo instead of the saved frame caused
**three tests to fail**; restoring source returned the tests to green. A side-aware
ghost regression initially rendered baseline geometry instead of the other side;
its actual transform assertion failed and now passes. The clipboard regression
initially threw a core validation error on strict paste; it now rejects with a
notice while preserving data and Redo. No mutated source remains.

The real installed consumer imports new APIs/types under Node/Bun and strict
TypeScript, checks mixed-mode merge/idempotency, a mode-only restore with one
Undo/Redo, pinned mixed-mode playback and independent working history. A negative
fixture rejects unsupported mode values in full history frames. Existing v1/pre-v2
reader fixtures and legacy app/package tests remain in the full suite.

## Compatibility matrix

| Boundary                                            | Qualified behavior                                                                                      | Evidence / remaining scope                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Canonical v2 models/editions                        | Modes retained per current, archive and origin checkpoint; no runtime history serialized                | Existing model/document fixtures plus workflow and mounted roundtrip tests                |
| V2 editor restore                                   | Graph+mode transaction requires an opted-in v2 model session; standalone legacy sessions block          | New package tests and installed consumer                                                  |
| Native graph controls                               | Graph history arrays remain projections; drag/measurement and clipboard crossing retain mode invariants | Workflow and existing editor tests                                                        |
| Legacy readers/writers                              | V1 readers reject v2 envelopes; explicit v2 snapshots cannot pass v1 writers                            | Existing `model-document-v2.test.ts` fixtures and new file Command tests                  |
| Existing architecture workspace                     | Retains its established strict/v1 workflow, independently of new history workspace                      | Existing 169 workbench regressions plus new history workspace tests                       |
| Mermaid/patches/receipts/review packets/CLI/layouts | No blanket v2 adoption or implicit mode-erasing projection                                              | Separate version/capability decisions remain open; new UI exposes supported v2 files only |

## Mounted evidence and development limits

[Workbench qualification](../../../apps/zloz-demo/evidence/history-workflow-v2.md)
records real local production Chromium flows, light/dark/minimal screenshots and
validated model/archive downloads. This is mounted evidence, unlike the earlier
static comparison fixtures. Nine new app/file tests cover stale callbacks, live
protection, independent sessions/history, bounded UTF-8 reading and transport.

Development checks found a boolean ARIA pressed value where the FoldKit builder
requires a string, and an exact-optional renderer property that needed omission
rather than explicit undefined. Lint checks led to scoped URL ownership, explicit
failure-message recovery and justified Schema.Unknown casts. Mounted playback
exposed passive measurement and idle cancellation interrupting the transport;
regressions now cover both. A harness selector for the world transform was also
corrected. Development failures are not passing evidence.

## Repository verification

`bun run test` completed with exit 0: core **810 pass**, workbench **178 pass**,
CLI **31 pass**, no workspace failures. The two existing promo skips remain
separate. Final affected tests passed after the ARIA token corrections. Final
lint/format and full `bun typecheck` completed with exit 0. Existing lint/Viz
skill-version warnings and nonfatal sandbox Vite listen diagnostics remain
separate from code errors. API documentation generation completed with exit 0,
as did the production build. The refreshed mounted Chromium run passed all
assertions, including active-section ARIA pressed and decorative ghost ARIA hidden
tokens, with zero page errors. Light/dark/minimal screenshots were inspected.

No human screen-reader/device/cross-browser, current CI, registry or hosted
qualification is inferred from local Chromium. Recommendation: **needs follow-up**
for a separately bounded portable-adapter compatibility batch. The approved v2
history/workflow scope is complete with the checks recorded above.
