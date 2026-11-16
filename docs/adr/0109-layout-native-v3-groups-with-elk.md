# ADR 0109: Layout native v3 groups through the optional ELK adapter

## Status

Accepted, 2026-11-16. User approved native v3 ELK layout, workbench demonstration,
tests, visual evidence, roadmap reconciliation and a commit in the isolated worktree.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision and contract

Keep the complete v3 document in a source-bound native layout request. The
peer-free core validates complete geometry and publishes through the existing
v3 transaction kernel, rechecking session/revision/document, lifecycle and live
move/resize/commit protections. One layout is one full-document Undo unit.
Group-port definitions, endpoint identities, metadata, modes, capabilities and
camera are preserved. Layout changes world positions and group bounds only.

The optional ELK package exposes a distinct native v3 engine. Reuse the engine
translation where qualified, without forging a legacy editor or downgrading a
ported graph. Host-owned active request identity rejects superseded completions;
engine failures never publish partial geometry. The Foldkit workbench carries
transient routes tied to the complete laid-out document and hides them during
movement/collapse projections. Routes are not portable authored edges.

The demo stores pending requests in Model and runs ELK in a Command. It rechecks
the current working state and policy at completion; review/gestures block Apply.
Show RIGHT/DOWN layout, visible errors/protection reasons and Undo in both themes.

## Alternatives and consequences

A bare-graph call to the legacy adapter would erase capability authority and is
rejected. Moving ELK into core would add a mandatory engine dependency and is
rejected. A separate copied translator would drift from established geometry
fixes; share translation with explicit version-aware validation instead.

Real ELK tests must qualify hierarchical port behavior before declaring support.
Unrepresentable/invalid engine output is a visible failure, never permission to
remove ports, rewrite edges or publish incomplete coordinates. SVG/PNG and other
v3 adapters remain separate work. No publication or deployment is part of this
slice; rollback is the local commit revert without a wire-format migration.

## Implementation and verification

- `packages/foldkit-zloz/src/group-layout-v3.ts`: distinct request/result/apply
  types; share only capability-independent layout geometry/hint validation with
  `layout.ts`, and reuse authored constraints from `group-operations-v3.ts`.
- `packages/foldkit-zloz-elk/src/index.ts`: shared private translation with explicit
  native validation; fixed-position compound ports, complete world bounds and
  final authored-anchor joins. Keep existing worker ownership and legacy entry.
- Native controller/view: transient document-bound routes; no portable format
  change. Demo `group-workbench/main.ts`: request in Model, ELK in Command,
  completion-time live checks, visible status and logical cancellation.
- [x] Core regression tests cover stale/incomplete output, containment,
      constraints, live policies and exact one-frame Undo.
- [x] Real-engine RIGHT/DOWN tests cover nested ported groups, ancestor edges,
      custom anchors, empty/disconnected/loose documents and explicit label/header hints.
- [x] Browser captures show connected group ports in light/dark and a visible
      minimal-mode veto; app tests cover delayed completion boundaries.
- Required delivery evidence: lint/format, workspace typechecks/tests, installed
  consumers, API docs and production demo build, linked from the qualification
  receipt. Commit locally; publishing/deploying is a separate scope.
