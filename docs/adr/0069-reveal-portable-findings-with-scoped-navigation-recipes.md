# ADR 0069: Reveal portable findings with scoped navigation recipes

## Status

Accepted for the approved package-level finding navigation slice, 2026-11-13.
Architecture, boundary and test-quality reviews are self-review.

## Context and decision

ADRs 0067–0068 keep portable projection separate from SDK inspection and the working
model. Findings currently retain source IDs but require manual diagram inspection.
Add headless finding navigation to the private adapter's portable root. It uses
core only; no SDK, Effect, browser, new dependency or release integration.

Expose `resolveAlchemyFindingNavigator` and `resolveAlchemyFindingReveal`, with
readonly request/entry/target/decision contracts. Hosts supply a nonblank review
scope, the validated projection, its matching detached editor and an optional
protection reason. Controls identify findings by code plus nullable source ID,
never ordinal position. Requests bind both host review scope and the full canonical
serialized source descriptor. Descriptor content changes invalidate old requests
even when authors reuse a revision; equivalent reordered descriptors stay valid.
The source key is a stale-UI identity, not a secret, signature or permission.

Resolve declaration coverage to a node, edge coverage to its source-linked relation,
and containment coverage to the child node (no fabricated containment edge).
Null, absent, ambiguous or unmapped findings are unavailable with visible reasons.
Recheck read-only state, measured canvas, idle gesture, host protection, source
membership, current target existence, edge endpoints and core revealability at
activation. Hidden targets remain protected; collapsed ancestors can be expanded
by core's reveal action. Hosts remain responsible for supplying the matching editor
and encoding renderer-specific restrictions in their protection reason.

A ready decision returns a restricted navigation recipe: clear selection, reveal
and expand the target through core, then select exactly one node/relation. Reveal
precedes selection so visibility filters do not reject still-collapsed descendants.
The helper owns no state and never executes events. The host composes these through the
navigation-only history reducer, preserving graph, Undo and working-model state.
No Apply, import, persistence, SDK/provider execution or editing authority.

## Alternatives and consequences

Astro-only source-ID matching would duplicate contracts for consumers. Ordinals
break under reorder. Namespace/model/revision alone fail when content changes under
the same revision. A hash adds collision considerations without a need here; the
canonical descriptor is exact but costs serialization once per navigator resolution
and again at activation. Stored camera coordinates would become stale; core reveal
uses current geometry and visibility. A navigation-only event recipe composes with
existing hosts without coupling the portable entry to Foldkit views.

## Implementation and verification

Add `finding-navigation.ts` and root exports/types; retain private status and the
SDK-free runtime/type import graph. Extend literal-fixture and packed-consumer
qualification for native node/relation targeting, source labels, source identity,
reorder, missing/hidden targets, duplicate/unbound findings, busy/protected/writable
states, collapsed descendants and immutable graph/Undo. Wire a typed workbench
message and accessible per-finding Reveal actions with availability reasons and
selection feedback. Preserve last good review when draft/file input fails and
reject old buttons after a new review. Keep focus on the invoking sidebar action.
Run package/workbench tests, root typecheck/check/all tests, private artifact checks
and production build sequentially. Retain inspected light/dark browser evidence,
including keyboard reveal, relation selection, Minimal mode and exact working-model
preservation. Rollback is local revert; source formats and stored models do not
change. SDK typing/core publication gates remain as documented in ADR 0067.
