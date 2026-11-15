# V2 model initialization and read-only review qualification

- result: complete
- claim: package-owned v2 model initialization and pinned read-only edition review retain checkpoint modes and independent graph/history state, with navigation-only updates and current selection policies.
- evidence: public strict/loose initialization and review tests, independent existing literals, installed Node/Bun/TypeScript consumers, navigation-whitelist regression and repository checks below.
- remaining uncertainty: v2 fork/append/comparison/ghosts/restore/playback, CLI/workbench, other adapters and wider C/Q/R qualification remain open; C1 is partial.
- next: v2 edition forking with immutable source provenance and a fresh target session retaining the selected checkpoint mode.

Measured parent: `bf115ad2`, isolated `codex/zloz-context-map` worktree.
See [ADR 0096](../../../docs/adr/0096-initialize-v2-models-and-review-editions.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

`createModelEditorV2` validates the complete canonical document, including current,
archived and pinned-origin snapshots, then delegates current-state initialization
to the existing v2 connection-document initializer. Its mode belongs to the current
snapshot; options cannot override it or inherit history/transient editor state.
Camera/read-only/history preferences retain their existing supported meanings.
Graph, camera and history are detached from the source and other initializations.
Each session starts at revision zero with empty Undo/Redo.

`createHistoryReviewV2` captures a deeply frozen detached edition pin and initializes
a separate graph in that edition's mode. A loose-only checkpoint stays loose when
the working editor is strict, and a strict checkpoint stays strict when present is
loose. The public `ZlozHistoryReviewV2` retains `editionId`, `edition` and a nested
editor with literal `readOnly: true`. Undo capacity is zero. Authored checkpoint
camera wins; an absent camera uses a detached copy of the working camera without
adding it to the pin. Only zoom limits, fit padding and copied surface size are
inherited. Invalid camera/range combinations reject rather than rewrite data.

`updateHistoryReviewV2` reuses the existing fail-closed navigation whitelist and core
reducer. Current selection policies still run against the review graph. Camera,
fit, focus, selection and surface measurement remain independent navigation;
authored edits, node measurement, connections and Undo/Redo return the original
review without entering the reducer. New editor events are not implicitly allowed.
Navigation retains the original pin and read-only state, never Applies/restores a
checkpoint or changes the working editor/history. Keep the complete returned
review and use this adapter; runtime editor records are not decoded wire data or
security capabilities. Independent native views still need distinct binding IDs.

No v1 contract or wire format changes. V2 fork, append, comparison/ghosts,
restore/playback, CLI/workbench and other adapters are not adopted here. No browser,
visual, real-device or human AT evidence is claimed for this headless slice.

## Behavioral evidence

Twelve new tests in `test/model-workflow-v2.test.ts` exercise public package exports:

- Strict and loose-only model initialization, exact authored data/camera, deep
  detachment, independent sessions, one normal edit/Undo and unchanged sources.
- Whole-document validation, including duplicate editions and unsupported archived
  or pinned-origin modes; v1 inputs reject rather than implicitly upgrade.
- Explicit camera/read-only/history options, undefined-camera fallback and source
  mode ownership even when preferences come from another editor with history.
- All four working/checkpoint mode combinations, with active working gestures,
  selection, clipboard and both Undo/Redo present. Reviews inherit none of those
  transients, retain detached immutable pins and leave present unchanged.
- Live selection vetoes and permitted selection/surface/camera/fit navigation,
  unchanged graph/pin/mode and empty review history; unchanged events retain identity.
- Editing, node measurement, wiring, clipboard and Undo/Redo proposals reject.
- Camera-less checkpoints, independent review navigation, pinned-origin review,
  zoom-range failure and unsupported mode/legacy input without source mutation.

The real installed consumer imports all three APIs and `ZlozHistoryReviewV2`, checks
strict working versus loose review mode, fresh histories and zero review Undo,
asserts literal read-only typing, navigates while retaining the pin and rejects
node measurement. These run against packed artifacts under Node/Bun and strict
TypeScript, not only direct source imports.

## Development and verification

The first test run failed at the missing public initializer export. After the
implementation, all twelve new cases passed. A temporary mutation bypassing the
navigation whitelist caused the edit/measurement rejection test to fail; restored
source returned all **33 focused workflow/model/history tests** to green. This
protects the review adapter beyond core read-only flags, because node measurement
is otherwise a legitimate core editor event. No mutated source remains.

`bun run test` completed with exit 0: core **751 pass**, workbench **169 pass**
and CLI **31 pass**, including real installed Node/Bun/TypeScript consumers. No
workspace failures; two existing promo skips remain separate.
`bun run check` completed with exit 0, including root lint/format and catalog/skill
checks. Existing Effect/TypeScript lint and Viz skill-version warnings remain
distinct from errors. Full `bun typecheck` completed with exit 0.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
all new function/type pages with warnings treated as errors.
Existing warnings/skips remain distinct from failures. No npm publication,
deployment, dependency/version change or full C1/parity completion.

Recommendation: **needs follow-up** for v2 forking and wider workflow adoption.
