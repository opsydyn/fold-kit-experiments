# Composable DDD editing controls — local qualification, 2026-11-11

Continued in the isolated `codex/zloz-context-map` worktree from `9664ab7`.
See [ADR 0040](../../../docs/adr/0040-compose-ddd-relationship-editing-controls.md).

result: complete

claim: Package-level composable DDD relationship and side-role controls are implemented with live protection reasons and undoable edits, demonstrated in the workbench.

evidence: Core, native-view, installed-consumer and workbench tests; sequential workspace check/typecheck/test; production demo build; API documentation; Chromium interaction checks and inspected light/dark captures below.

remaining uncertainty: Local qualification only; hosted behavior and comprehensive assistive-technology acceptance remain unverified. No publishing or deployment performed. Reviews are self-review.

next: needs review; then implement a headless EventStorming-to-DDD mapping preview before conversion actions.

## Ownership and behavior

Core owns the pure context, identity/revision requests, fresh resolution and
convention/policy separation. The optional Foldkit entry owns native composable
pattern, upstream/downstream, status and reason helpers. The workbench composes
those public APIs in Inspect, checks model/epoch/active-inspector scope and applies
ordinary editor events with the current policy.

Pattern transitions preserve description and directional side-role values,
including authored absence. Explicit non-directional choices remove inapplicable
side fields atomically. Removing the last upstream role deletes the field; None
removes downstream. Unknown custom meaning remains current-only, clear is explicit,
and other-family meaning is protected. Read-only, gesture, busy, host veto and stale
revision/target protections remain live. No inferred DDD semantics or second draft.

The demo's Orders–Billing meaning-edit protection is an actual host metadata policy;
it covers direct EdgeArchitectureChanged events as well as controls. Other editor
operations retain their separate policies. Numeric diagnostics do not gate editing
or functional reasons. Nullable/custom wrappers and layout retain native semantics.
The duplicate floating toolbar is suppressed while the visible DDD inspector owns
those controls, and returns when the sidebar is collapsed.

## Behavioral evidence

- Test-first missing-export run failed, then control/renderer tests passed.
- An independent case demonstrated that catalogue defaults were incorrectly
  injected when directional roles had been omitted. It failed before the fix and
  passes after preserving authored absence explicitly.
- Core cases cover valid/empty sides, pattern transitions, custom catalogues,
  current-only unknown meaning, explicit clear, foreign-family protection,
  compatibility independent of enforcement, host vetoes, stale edge/revision,
  gestures/read-only, no-op, descriptions and ordinary Undo/Redo.
- SSR cases cover selected values, disabled controls with accessible reasons,
  custom wrappers/layout and independently omitted parts.
- Workbench cases cover one-Undo editing, direct protected events, stale model,
  epoch, hidden inspector, busy import, read-only source and minimal mode.
- Installed consumer fixtures exercise the public root edit/Undo contract under
  Node/Bun and Bundler/NodeNext, including required-revision type rejection; the
  optional view exports/types are checked from the real tarball too.

## Browser evidence

```sh
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/ddd-relationship-controls-browser.mjs
```

Chromium **151.0.7922.34**, 1600×1200, reduced motion. Passed actual side-role edits,
keyboard Space toggle, cleared-field JSON inspection, directional preservation,
symmetric transition/Undo, owner protection with visible/accessible reasons,
minimal/global diagnostics independence and immutable historical inspection.
Model snapshots were downloaded and compared; no page errors.

Existing Undo/Redo clears selection. The fixture explicitly reselects the same
edge before inspecting restored values. Native field values can precede the graph
update, so the fixture waits for semantic canvas badges before issuing dependent
edits; revision guards were retained. An early workspace test run overlapped a
demo rebuild and failed during module imports. The demo suite passed independently;
the final sequential workspace rerun passed after the completed build.

[Light capture](ddd-relationship-controls-light.png) ·
[Dark capture](ddd-relationship-controls-dark.png).
Both final images were visually inspected: protected fields and explanation in the
left pane, all context cards visible, no floating editor obscuring the diagram,
and the shared family themes. The browser also checks that collapsing the sidebar
restores the floating toolbar. Source: [browser fixture](ddd-relationship-controls-browser.mjs).

This is local browser/package evidence, not hosted, screen-reader or comprehensive
accessibility acceptance. No new codec, publication, deployment, bulk editing,
rewiring UI, frame projection or DDD CLI audit is claimed. Architecture, delivery
and test-quality review are self-review. Boundary verdict: **safe with noted risk**;
a ready event is advisory and must be applied immediately with current policy in
the correctly scoped host model.

## Final verification

All commands exited 0 against this isolated worktree:

- `bun run check` (existing repository warnings remain).
- `bun typecheck`.
- `bun run test` (existing skips remain).
- `bun run --filter @opsydyn/foldkit-zloz docs`.
- `bun run --filter @opsydyn/zloz-demo build`.
- `node apps/zloz-demo/evidence/ddd-relationship-controls-browser.mjs`.

The root check, typecheck, tests and documentation generation ran sequentially after the production build and browser run. Final Markdown formatting was followed by another root check. No dependency, manifest or codec changes.
