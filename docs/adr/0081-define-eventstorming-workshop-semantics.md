# ADR 0081: Define EventStorming workshop semantics before renderers

## Status

Accepted for the approved headless vocabulary slice, 2026-11-13. Extends the
existing architecture, causal convention, codec, history and mapping contracts.
Architecture/boundary, delivery and test-quality reviews are self-review.

## Decision

Extend the existing event-storming node family with three distinct meanings:

- `external-system`: ordinary causal participant, authored as outside the workshop's
  modelled control. This is neither a network resource nor an inferred C4 system.
- `hotspot`: ordinary portless annotation, with required authored `status: open |
resolved`. Label/description hold the concern; resolution is a workshop fact,
  not evidence of software correctness or an executable workflow.
- `lane`: portless `kind: group` organizational frame. Existing parentId membership,
  world coordinates, nested groups and group movement/resize rules apply. A lane
  neither declares a DDD aggregate/bounded context nor imposes a timeline, ownership,
  causal ordering, layout algorithm or executable boundary.

Keep descriptors strictly role-specific. Status belongs only to hotspots; invalid
status, incompatible kind/ports and unknown fields reject. Presets are headless
catalogue entries, not a claim of new artwork. Expose a pure semantic projection
for participant/annotation/frame consumers. Reuse existing graph/snapshot/model/
edition codecs and architecture-change Undo; preserve legacy inputs. Older readers
may reject the additive roles; no wire version or publication change is implied.

Add an opt-in `eventStormingWorkshopRelationshipRules` catalogue; keep the existing
default unchanged so old builtin review packets remain reproducible. In this
explicit workshop convention, external systems may issue commands,
handle commands and emit domain events. Existing rule keys stay issues/handles/
emits with widened supported roles, not new edge descriptors. The default catalogue
continues to block external-system edges; hosts opt into the broader convention. Other relationships
need explicit custom conventions. Annotation/frame roles are never causal roles,
even through roleOf delegation. Port validation remains independent and strict.
These are toolkit conventions, not a universal EventStorming grammar.

DDD mapping previews report all three roles unmapped by default with specific
reasons; no automatic system/context/aggregate inference. Explicit compatible DDD
choices or retention remain available through the existing provenance/loss-consent
pipeline. Hotspot status is part of reserved workshop meaning, preserved in source
provenance and disclosed when meaning is replaced. A lane cannot bypass kind checks.

Existing optional note artwork declines the new roles. Built-in SVG planning reports
unsupported new-role artwork; explicit host SVG/fallback declarations remain the
escape hatch with existing fidelity reporting. Mermaid's existing semantic-loss
reporting must account for the descriptors. No new renderer, theme tokens, sidebar,
connections to annotations, annotation anchors, separate lane membership storage,
C4 conversion, execution, dependencies, release or deployment in this slice.

## Why and alternatives

Treating every new role as a causal sticky creates meaningless hotspot/lane edges.
Encoding metadata in host data defeats a first-class strict contract. Introducing
separate annotation/frame stores would require a new cross-cutting persistence and
editing lifecycle before those stores offer value. A discriminated role union in
the existing authored node model preserves established identity/history/tooling.
Required hotspot status avoids defaulting missing information to resolution.

The cost is deliberate compatibility work wherever role vocabularies are exhausted:
causal rules/CLI, mapping preview, generic export fidelity and packed types. Rendering
must follow as its own slice. Revisit hotspot anchoring, workshop read models or
automatic lane layouts only with a separately approved contract.

## Implementation and evidence

1. Literal v1 fixture for all three roles and independent invalid variants.
2. Core type/validator/preset/semantic projection and causal convention tests.
3. Strict graph/snapshot/model/edition/review receipt compatibility; one-step
   architecture/status changes with Undo, protection, membership and deletion.
4. Explicit mapping/retention/loss-provenance and export guard tests.
5. Installed core consumers, Effect CLI data-only rules and existing causal/DDD
   regressions; root check/typecheck/tests and API docs before commit.
6. README/roadmap and an evidence receipt, retaining D1b/C/Q/R gates. No screenshots
   are claimed for this headless slice; renderer acceptance comes next.

Rollback before release is a revert/rebuild. Saved new-role documents require a
reader supporting these additive descriptors; no silent downgrade is provided.
