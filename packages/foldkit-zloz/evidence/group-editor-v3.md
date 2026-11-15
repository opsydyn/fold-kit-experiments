# Explicit v3 editor and document Undo qualification

result: complete
claim: Core initializes an explicit headless v3 session and applies exact-source complete-document transactions with capability-preserving Undo/Redo and live policy checks. Legacy sessions remain fixed at v1/v2.
evidence: Independent literal v3 fixtures, `test/group-editor-v3.test.ts`, existing legacy/editor/patch tests, and installed consumer probes in `test/package.test.ts`.
remaining uncertainty: Local source/package evidence only. Native controls, group gesture plans, clipboard, canonical model/edition archives, patches/receipts/packets, CLI, layout and SVG/PNG/Mermaid adoption remain version-required. No hosted verification, publication or deployment is claimed.
next: Qualify headless group-port edit/connection planners and complete group movement/deletion plans before native controls.

## Contract and ownership

[ADR 0106](../../../docs/adr/0106-initialize-v3-editor-sessions-with-document-history.md)
defines the distinct session. `createGroupEditorV3` owns a complete valid document,
starts revision zero with empty bounded history, requires a host-allocated session
incarnation and never enables capabilities implicitly. The session has a single
`document`, with no legacy graph root. It is trusted runtime state, not a portable
archive. Hosts update live read-only/activity state in their immutable model and
must not reuse a session identity after reopening.

`captureGroupEditorSourceV3` records exact session/revision/full document freshness,
not permission. Apply and source-bound Undo/Redo validate document ownership and
current source, recheck lifecycle/read-only/history/revision capacity, then run the
shared complete entity policy inventory and a whole-document veto. Policy inputs
are frozen validated data. Unexpected callback/implementation exceptions propagate;
known validation errors return blocked data without publishing a partial editor.
Invalid source accessors are rejected before evaluation. Blocked/no-op results
retain the original editor and history references.

Successful transactions retain one full document frame, including coordinate
space, mode, capability and optional camera. Undo/Redo preserve their own frame's
settings while revision increases. Source-bound travel reruns current granular
and complete-operation protections in the travel direction; it does not replay
old permission. New Apply clears Redo; no-op retains it. History defaults to 100,
maximum 1000; disabled history blocks authored transactions.

Targets express all intended changes. The kernel never invents a group drag,
expansion, reparent or deletion plan. Explicit world-position changes affect each
listed child once. Changing group/ordinary node kind cannot reuse port identities: this symmetric
guard prevents accepting a promotion whose inverse would be intrinsically
blocked. Explicit old-port/connection handling or port identity replacement may
be part of the same complete transaction. Complete valid target deletion and port removal respect every
changed port and removed/reconnected edge. Future interaction planners still need
their own descendant/ancestor coverage qualification.

## Regression and installed probes

- Detached/frozen initialization, exact envelope, unique incarnation, invalid
  options/versions and runtime legacy reducer/commit rejection.
- World-coordinate group/child movement once with preserved endpoint identity,
  one Undo frame, restored camera and exact Redo.
- Portless mode/capability changes, ported frames, strict/loose eligibility and
  complete per-frame capability preservation.
- Stale/reused sources, session mismatch, full-document drift and monotonic
  revisions after Undo; bounded/branching history and no-op Redo retention.
- Live busy/read-only/history-disabled/exhausted protections on Apply and travel;
  invalid capability, dangling references and ported lane/hotspot rejection.
- Movement/resize policy vetoes, complete group/descendant/incident-edge deletion,
  port remove/add and connection vetoes during Undo/Redo, explicit ungroup refusal,
  whole-operation veto and propagated policy defects without mutation.
- Unsupported native events and each advertised adapter boundary return a visible
  version-required decision with the original session. Standalone v3 document
  serialization remains available.

The cold npm tarball consumer imports all public session functions and types,
executes Apply/Undo/Redo and stale-source/boundary checks under Node and Bun without
Foldkit/Effect/React/ELK peers, and compiles strict NodeNext/Bundler negative cases
for legacy session misuse, bare-graph initialization and source-free history.
This is installed local evidence, not registry publication or UI acceptance.

## Verification

Qualified locally on 2026-11-15 in the isolated
`codex/zloz-native-v2-workbench` worktree:

- `bun run check`: passed (Oxlint, Oxfmt, catalog and skill checks).
- `bun typecheck`: passed across the workspace. The final affected-package
  typecheck also passed after the last source-freshness regression was added.
- `bun run test`: passed across the workspace, including **849 core unit tests**
  across 132 files (**17 new v3 session cases**) and the installed npm tarball
  Node/Bun runtime and strict NodeNext/Bundler consumer test. Existing
  build-dependent Viz/Zloz promo artifact checks retain their configured skips;
  no new browser/hosted evidence is inferred from this run.
- `bun run --filter @opsydyn/foldkit-zloz docs`: passed; TypeDoc generated the new
  exports without warnings.
- `bun moon run root:pre-commit`: passed Oxfmt, Oxlint, catalog and skills on all
  12 staged files, invoked explicitly. The final documentation-only receipt
  adjustment was staged and checked again before commit.

An initial sandboxed workspace run stopped at an existing fixture's Bun cache
write. The full rerun with cache access passed; no production change was needed
for that environmental failure. No browser evidence is expected for this
headless-only slice. No publishing, deployment or hosted CI run was performed.
