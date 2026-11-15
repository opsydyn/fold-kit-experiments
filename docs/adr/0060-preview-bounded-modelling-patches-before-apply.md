# ADR 0060: Preview bounded modelling patches before Apply

## Status and scope

Accepted for the approved first P2 slice, 2026-11-13. Architecture/boundary,
delivery and test-quality reviews are self-review: **safe with noted risk**.
Core owns graph meaning and validation; optional Mermaid, CLI and workbench stay
consumers. No dependency, editor event, Apply, CLI command, file parser, publication,
PNG or Alchemy is added. Existing graph/model/packet formats remain unchanged.

## Decision and domain contract

Expose a data-only `ZlozModellingPatch` proposal in the dependency-free core, plus
`captureModellingPatch` and `dryRunModellingPatch`. This is a graph proposal, not
a model archive, review packet, conversion receipt or executable editor event.
Hosts supply IDs; core generates no identity, timestamps or side effects.

The proposal has format `foldkit-zloz-patch`, version 1, a nonblank patch ID and:

- `source`: model ID, unique editor/model-incarnation session ID, nonnegative safe
  integer revision and the complete expected authored graph. The host supplies the
  corresponding current source separately to dry run. All identity fields,
  revision and graph content must match; object property order is insignificant,
  graph array order is significant. Undo must retain the monotonic editor revision.
  Cameras, selection, editions and Undo are outside graph-patch scope, so navigation
  alone does not invalidate a proposal. Session/revision claims are not authority.
- `provenance`: nonblank reason, actor kind (`human`, `agent` or `tool`) and ID,
  plus data-only `{ kind, id }` references. These are unsigned caller assertions,
  not authentication, permission, lineage or renewed conversion-loss consent.
- `operations`: bounded explicit `node.add`, `node.replace`, `node.remove`,
  `edge.add`, `edge.replace`, `edge.remove`. Each has a unique nonblank operation
  ID. Add/replace carries a complete node/edge; remove carries its target ID.
  Replacement preserves the payload's target ID; it cannot rename an entity.
  One operation per entity kind/ID per patch prevents hidden overwrites and
  add/remove cancellation. Node and edge namespaces remain distinct.

Add requires absence; replace/remove requires presence. Replacements are complete,
not recursive merges. Removals never cascade or detach children/incident edges.
The combined prospective graph must satisfy existing graph validation: parents,
cycles, ports, endpoints, semantic descriptors and authored geometry. Structural
validity does not run domain convention audits or establish architectural correctness. Internal
operation order does not require intermediate validity; a child may precede its
parent and an edge its new nodes. Existing array order is preserved, replacements
keep their index and additions append in operation order within each entity kind.
Explicitly list edge/child removals or replacements needed for deletion. No implicit
ID allocation, reconnect, graph repair, snapping or layout is performed.

Capture validates exact proposal/source/provenance/operation envelope fields and
bounded plain JSON data, then detaches and deeply freezes the complete proposal.
Fixed limits: 1,000 operations, depth 64, 100,000 JSON values, 2,000,000 characters
in any string and aggregate string/key content. Reject functions, undefined,
non-finite numbers, cycles, custom prototypes, accessors, symbols and sparse arrays
rather than coercing/dropping them. Graph payload extensions remain data-only and
are retained under existing graph validation; envelope extensions reject. These
limits bound traversal, not peak memory, network bytes or wall-clock time. No raw
JSON parser is exposed in this slice; transports must preserve duplicate-key and
byte-limit protection before providing objects. A future codec needs its own
strict text boundary rather than generic JSON.parse as an implied trust boundary.

Dry run rejects malformed, stale, conflicting or invalid proposals with structured
findings and no prospective graph. A valid proposal returns its exact frozen graph,
ordered before/after changes, findings and conservative authored-data losses:
removals report the removed entity; replacements list every changed/removed prior
top-level field. Added fields alone are not losses. Equal replacements/empty patches
produce a no-op finding. Loss disclosure is not acceptance and does not block
inspection; future Apply must establish explicit review/consent semantics.

Live pure policies are separate from portable data: optional host `blockedReason`,
per-change `canChange` and whole-proposal `canPatch`. All receive detached frozen
values. Any returned string, including blank, blocks with a visible reason; null
or undefined permits review. Valid but protected proposals still return the exact
graph/changes/losses, with `type: blocked`; otherwise `type: reviewable`. These are
review policies, not automatic evaluation of EditorPolicy or permission to edit.
Callback exceptions propagate as host programming failures. Every future Apply
must independently rebuild the proposal, recheck current source, granular editor
and host policies, lifecycle, permission and consent, then publish once with one
Undo and provenance. A cached dry run or imported proposal can never authorize it.

## Alternatives and consequences

JSON Patch permits arbitrary paths into session/editor state and ambiguous array
identity; imperative editor-event replay can silently ignore invalid/denied edits
or create multiple Undo entries. A typed six-operation graph vocabulary preserves
stable identity and core invariants without exposing editor internals. Source
revision alone can collide across sessions or divergent graphs; the complete
expected graph makes review reproducible and catches mismatched content.
Costs are larger proposals, conservative replacement-loss reports and a deliberately
limited vocabulary. Domain-specific field operations and raw text codecs require
separate decisions. This slice closes only the headless contract portion of P2.

## Implementation and acceptance

Add a core module and public types/functions without importing an adapter/editor.
Tests start red for exact candidate output, all six operations, source mismatch,
policy blockers, explicit deletion dependencies, loss disclosure, no-op, malformed
and bounded data, frozen ownership and editor/Undo preservation. Add an independent
literal JSON fixture and real installed Node/Bun consumer with Bundler/NodeNext
qualification. Generate an inspectable dry-run JSON example; update package guide,
API docs and P2 roadmap status without claiming Apply/CLI completion. Run root
lint/format, typecheck, all workspace tests and TypeDoc, keeping shared-dist builders
sequential. Rollback is a local revert before publication, without data migration.
