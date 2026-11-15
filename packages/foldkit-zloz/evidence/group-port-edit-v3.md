# Headless v3 group-port edit qualification

result: complete
claim: Core plans and applies explicit group-port add/label/position/removal through the existing v3 transaction kernel, with live protection reasons and one full-document Undo unit. Qualified locally.
evidence: Literal group-document fixtures, `test/group-port-edit-v3.test.ts`, legacy/v3 editor regression tests and new installed Node/Bun/type consumer probes in `test/package.test.ts`.
remaining uncertainty: Local source and installed-package evidence only. Native controls, connection/reconnection planners and canonical v3 archive/adapter adoption remain open. No registry or hosted qualification is claimed.
next: Qualify headless v3 connection/reconnection plans through the same live-policy and Undo boundary.
recommendation: needs follow-up

## Contract and review

[ADR 0107](../../../docs/adr/0107-plan-v3-group-port-edits-through-live-transactions.md)
records ownership, scope, alternatives and acceptance. Architecture, delivery and
test-quality review are self-review. The headless core stays peer-free. Hosts own
session incarnation, lifecycle, current policies and publication of returned state.
Plans are runtime values, not portable authority or a new consent protocol.

Requests retain exact v3 source and one explicit edit. Add appends; label null
removes the optional field; position reuses the existing exclusive normalized
coordinate guard; removal includes every incident source/target edge. The complete
validated target preserves mode/capability/camera and unrelated content. Native
controls, connection edits, snapping, kind/identity changes and implicit capability
enablement are excluded.

A new internal nonpublishing transaction review is shared by existing v3 Apply
and the planner. Source/lifecycle guards run before edit planning. The proposed
change policies run once per preview/Apply, outside the input-error catch. Apply
rebuilds from intent, never a cached target. Rejected/no-op results keep editor,
revision and history identity; allowed deletion plus port removal is one Undo.
Travel rechecks current port/connection/deletion/whole-operation vetoes.

## Regression probes

- Pure preview with detached/frozen intent, before/after and complete effects;
  deterministic append identity, exact label/clear semantics and exclusive anchor/
  offset switching with independent expected world anchor `(500,155)`.
- All incident edges, unrelated-edge/descendant preservation, incoming loose
  edges, self-loop counted once and exact full-document Undo/Redo.
- All four port-policy vetoes, blank reasons, complete edge-deletion veto, whole
  operation veto, one proposed-change policy pass and propagated host defects.
- Ready preview followed by new protection; exact source/session/revision/mode/
  camera drift; busy/read-only/history-disabled/exhausted revision guards.
- Capability-disabled/ineligible groups, workshop portlessness, missing/duplicate
  identities, accessor rejection without evaluation, strict unknown edit fields,
  unsupported operations and invalid/exclusive geometry.
- No-op Redo retention, real-edit branching, fresh Undo/Redo protection and loose
  ordered connection meaning, architecture, metadata and world coordinates.
- Installed consumer imports all public functions/types, previews/removes/restores
  a boundary connection, rejects changed policy and compiles negative target-as-
  intent and undefined-label contracts under strict NodeNext and Bundler. Runtime
  checks execute under Node and Bun before optional Foldkit/Effect peers install.

## Verification

Qualified on 2026-11-15 in the isolated `codex/zloz-native-v2-workbench` worktree:

- Baseline `bun typecheck` and `bun run check`: passed before implementation.
- Final `bun run check`: passed Oxlint/Oxfmt, catalog and skill checks.
- Final `bun typecheck`: passed across the workspace; the focused core typecheck
  also passed during implementation.
- Final `bun run test`: passed across the workspace, including **863 core unit
  tests** across 133 files (**14 new planner cases**) and the cold npm tarball
  Node/Bun runtime and strict NodeNext/Bundler consumer probes. Existing
  build-dependent promo artifact checks retain their configured skips.
- `bun run --filter @opsydyn/foldkit-zloz docs`: passed; TypeDoc generated the
  new exports without warnings.
- Explicit `bun moon run root:pre-commit`: passed on all 10 staged files.
  Final receipt-only updates are staged and checked again at commit handoff.

The tarball test installs local artifacts into a clean consumer before optional
peers are added; this is installed evidence, not registry publication. No browser
acceptance, hosted CI run, deployment, PR/push or npm publication was performed.
