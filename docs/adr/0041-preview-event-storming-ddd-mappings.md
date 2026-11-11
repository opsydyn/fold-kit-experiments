# ADR 0041: Preview EventStorming-to-DDD mappings before conversion

## Status

Accepted for the approved headless package slice, 2026-11-11.
Boundary review: **safe with noted risk**. Suggestions express toolkit conventions,
not discovered business truth, permission to edit or an executable conversion plan.

## Decision

Expose `previewEventStormingDddMapping` from the dependency-free Zloz root. Input
is a structurally valid current graph, optional per-ID DDD choices (null explicitly
retains workshop meaning) and the existing DDD relationship convention catalogue.
Output contains detached node/incident-edge decisions and prospective semantic-loss
disclosures, in source graph order. It returns no converted graph or editor event.

Inspect only EventStorming notes and their incident relationships. Existing DDD
nodes are compatible anchors; unrelated C4/untyped nodes remain untouched. Existing
DDD relationships are checked against proposed endpoints and cannot be overwritten
through workshop choices. Duplicate, missing or out-of-scope choices, incompatible
node kind, invalid descriptors and invalid conventions reject atomically.

The default explicitly named domain-event note proposes a DDD domain-event role.
Commands offer non-exhaustive aggregate-root/domain-service interpretations but
remain ambiguous: intent does not identify its handler. Policies remain ambiguous
even with a single domain-service candidate. Actors have no default DDD counterpart.
Explicit choices may select any valid DDD role compatible with the existing node
kind; no aggregate frames, bounded contexts, parentage or ports are synthesized.
Descriptions are inherited unless an explicit target supplies its own description.

Only authored causal `emits` proposes DDD tactical `emits`, checked through the
existing pure DDD resolver against all proposed endpoints. Other causal roles,
custom roles and untyped links require explicit retention or meaning. No label,
proximity, endpoint-only or context-boundary inference. Explicit edge choices use
the same DDD resolver and may be blocked without invalidating the whole preview.
A blocked edge is distinct from an unmapped edge. Explicit retention makes no DDD
compatibility claim. Every proposed replacement of a reserved workshop descriptor
is disclosed; original descriptors remain recorded alongside decisions. No format
or semantics-preserving equivalence is promised.

This preview reads graph values, not editor state, and never modifies graph,
history, editions or origin. It cannot authorize conversion. Hosts must recompute
when source, choices or conventions change. A later conversion transaction needs
its own model identity/freshness, live policy, lifecycle, loss consent, provenance
and atomic Undo checks. Disclosures here cover prospective reserved meaning only;
they are not a full projection/export loss audit.

## Simplicity and alternatives

Reuse the existing architecture guards and DDD logical resolver in one pure module.
Explicit per-ID choices make the preview composable without callback execution or
a second rules engine. Rejected alternatives: automatic conversion (conceals intent
and provenance), UI-owned inference (unavailable to agents/other consumers), or a
new mapping DSL/persistence schema (premature coupling). No dependencies, package,
codec change, C4 mapping, CLI, workbench UI, conversion, publishing or deployment.
The tradeoff is deliberately conservative suggestions and ephemeral choices.

## Verification and review

Tests first cover independent expected defaults, unresolved intent, explicit choices,
relationship compatibility, mixed-family preservation, invalid/duplicate scope,
detachment and unchanged graph/history. Packed Node/Bun consumers check the root
runtime and Bundler/NodeNext types. Run root lint/format, typecheck, workspace tests
and API documentation. Architecture, delivery and test-quality review are self-review.
Rollback is source reversion; no persisted graph data is migrated.

Next bounded work: compose a read-only preview in the workbench, with explicit
choices and visible ambiguity/loss reasons, before implementing conversion.
