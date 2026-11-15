# ADR 0040: Compose DDD relationship and side-role editing controls

## Status

Accepted for the approved package/workbench slice, 2026-11-11.
Boundary review: **safe with noted risk**. Compatibility is a convention; policy,
lifecycle and source identity independently decide whether editing is available.

## Decision and simplicity

Extend the existing descriptor and ordinary EdgeArchitectureChanged transaction
with pure DDD control contexts and request resolution. Keep native composable
Foldkit controls in the optional view entry. No schema, persistence format,
package, dependency or rendering-side state is added.

Requests carry current edge identity and editor revision, plus a pattern key or
side-role intent, not cached descriptors or authorization. The host also checks
model/session identity and its active inspector. Resolve again from current state,
conventions and live policy, then apply immediately through updateEditor with the
same policy. Ready is an advisory event, not a permission grant for later use.

Pattern selection preserves authored description; directional-to-directional
changes preserve side roles. An explicit symmetric/tactical/custom pattern change
removes side fields that its syntax cannot carry, atomically with one Undo. Enabling
upstream roles preserves authored ordering; removing the last removes the field,
never stores an invalid empty list. Downstream has an explicit None choice. Same
values are no-ops. Unknown stored custom patterns remain visible as current-only
choices; clearing DDD meaning is explicit. Other-family meaning cannot be cleared
or overwritten by this inspector. There is no inferred DDD meaning.

Controls expose per-choice compatibility separately from edit restrictions.
Conventions do not silently enable enforcement. Host vetoes, read-only, gestures,
missing targets and host busy reasons are live. Native selectors, checkboxes,
status and visible reasons have independent nullable renderer/layout/attribute
seams. No numeric diagnostics are required to use the controls.

The workbench consumes public helpers in the left sidebar, demonstrates custom
wrappers and switchable protection of the Orders→Billing contract, and retains
its existing presentation toggle. The actual host policy protects direct events
too. Historical inspection stays read-only; stale model/epoch/revision or changed
inspector requests cannot change another edge. Undo/Redo stays editor-owned.

Alternatives: app-only forms would not ship reusable behavior; a duplicated draft
would introduce synchronization and partial-commit states; embedding policy results
or descriptors in messages would replay stale decisions. Derive controls from the
single graph model and reuse the current transaction boundary instead. Omit bulk
editing, source rewiring, new audit/CLI commands, frame projections, publication
and deployment.

## Implementation and evidence

- Pure DDD context/request module, public root types/functions, internal shared
  convention validation; optional native view helpers and public types.
- Test first: side toggles/None, pattern transitions, descriptions, unknown custom
  meaning, other-family protection, policy vs compatibility, stale revision/target,
  read-only/gestures, one Undo, no-op and direct protected events.
- SSR custom/omitted slots, native names, selected values and disabled reasons;
  installed root/view APIs under Node/Bun and Bundler/NodeNext.
- Workbench integration tests; light/dark browser editing, protection reasons,
  semantic preview, Undo/Redo, minimal mode and unchanged read-only snapshots.
- Root check/typecheck/test, production workbench build and API docs.
  Architecture, delivery and test-quality reviews are self-review.

Rollback removes the additive control APIs and app integration. Documents keep
existing DDD semantics and all v1 codecs remain unchanged. Related: ADR 0038/0039.
