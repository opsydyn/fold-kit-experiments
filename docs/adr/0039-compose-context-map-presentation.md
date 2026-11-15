# ADR 0039: Compose context-map presentation from DDD contracts

## Status

Accepted for the approved package primitives and workbench slice, 2026-11-11.
Boundary verdict: **safe with noted risk**. Presentation shows authored intent;
it does not certify a valid domain model or equate influence with data flow.

## Decision and simplicity

Reuse ADR-0038 descriptors and conventions. Add a pure context-map relationship
projection to core, plus optional Foldkit connector and label primitives. The
projection reports pattern, participants, side badges, intended direction and any
semantic restriction. Unrecognized custom meanings have no assumed direction.
Validation never silently rewrites a draft. Built-in direction remains visible
when a host convention omits that built-in; a reason explains the restriction.

Use existing resolved paths and arrow marker IDs. Symmetric connectors omit the
arrow; directed patterns retain source-upstream → target-downstream. Core retains
hit targets, selection, reconnection and label editing; renderers decorate only.
Native label actions respect read-only and selection protection. Nullable part,
path and layout renderers, attributes and host labels keep composition open.
Scope/role badges are semantic content, independent of optional numeric diagnostics.

Allow the existing custom edge-label hook to present an unlabeled connection even
when unselected or read-only. Undefined keeps the previous default visibility;
null suppresses the label. This avoids fabricating a stored label to show meaning.
No default canvas style or automatic renderer activation changes for consumers.

Ship a detached four-context starter in the package, also available through atomic
pattern insertion. Normal ports belong to connectable context cards; no group
endpoint or frame store is introduced. The app consumes public APIs, demonstrates
all four strategic patterns and can disable context-map presentation. Its existing
semantic-policy opt-in composes DDD with EventStorming, retaining host restrictions.

Alternatives: app-only SVG would not ship reusable behavior; new geometry or
boundary ports would mix semantic and structural concerns; stored presentation
flags would add unnecessary persistence. Keep current geometry, codecs, Undo and
policies. Omit new semantic editing UI, frame projections, persistence formats,
collaboration, publication and deployment. No new dependency or performance claim.

## Implementation and verification

- Core context projection and starter, root exports, existing pattern catalogue.
- Optional Foldkit connector, side-badge and label composition, public view types.
- Regression tests for arrows, custom/nullable slots, missing labels, protected
  actions, unknown conventions, detached starters and atomic insertion/Undo.
- Qualify installed root/view APIs with TypeScript Bundler/NodeNext and Node/Bun.
- Workbench tests and real-browser light/dark evidence: toggle, selection, label
  editing/Undo, semantic preservation, read-only history and minimal mode.
- Root check/typecheck/tests, API docs and production workbench build.
  Architecture, delivery and test-quality reviews are self-review.

Rollback removes additive APIs and renderer opt-in; no model migration is needed.
Existing DDD meaning and Mermaid loss behavior remain authoritative.
