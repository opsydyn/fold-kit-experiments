# ZLOZ API and type contracts

The ZLOZ API reference is generated with TypeDoc from public package entry points,
using the same tool as FoldKit Viz. It describes the source revision used for the
build; the packages remain local release candidates until separately published.

[Open the Zloz API reference](/fold-kit-experiments/zloz/api/).
The route is populated by the updated Pages workflow after merge/deployment.

The reference includes:

- `@opsydyn/foldkit-zloz`: graph/port types, editor state/events, serialization,
  history, layout publication, shared edge geometry, custom port anchors and connection-preview policies.
  The root also exports C4/DDD node descriptors, architecture presets/factory,
  shape geometry and undoable architecture/appearance events.
- `@opsydyn/foldkit-zloz/effect-ui`: the graph surface and the V3 group surface,
  inspector and clipboard controls for Effect UI components. C4 notation
  supports artwork slots, group headings and scoped themes.
- `@opsydyn/foldkit-zloz/foldkit`: view options, node/group shells, public
  interaction primitives, diagnostics and background contracts.
- `@opsydyn/foldkit-zloz-elk`: ELK layout options and adapter factory.
- `@opsydyn/foldkit-zloz-force`: force layout factory and support checks.
- `@opsydyn/foldkit-zloz-force/eligibility`: the lightweight eligibility entry.
- `@opsydyn/foldkit-zloz-mermaid`: Mermaid export options, identity metadata,
  conversion diagnostics and nested subgraph projections.
- `@opsydyn/foldkit-zloz-cli`: Effect CLI command tree, explicit-argv runner,
  versioned JSON responses and typed exit/I/O errors. The runtime is started only
  by the standalone executable. See the [CLI guide](../packages/foldkit-zloz-cli/README.md).

Preferred contracts use `Zloz*` types and `zloz*` views. Deprecated source aliases
remain available for existing integrations; see [migration notes](zloz-migration.md).

## Generate locally

```sh
bun run --filter @opsydyn/foldkit-zloz docs
```

Serve `packages/foldkit-zloz/docs/` with a static server. Generated HTML is ignored
by Git and built afresh for Pages. It is not included in the npm tarball. The
landing guide is maintained at `packages/foldkit-zloz/typedoc-readme.md`; the type
and API pages come directly from source exports and their TSDoc comments.

The core stays independent of FoldKit, browser globals and layout engines. The
application owns Model, commands and persistence; optional adapters remain
separate dependencies. See [the composition decision](adr/0004-composable-flow-presentation.md)
for the current extensibility boundaries.

### DDD preset views

The optional Foldkit entry exports `zlozDddNode`, `zlozDddGroup` and the public
`ZlozDddContentContext`, `ZlozDddContentRenderer`, `ZlozDddNodeOptions` types.
These views compose the eight existing semantic roles with core geometry and
live native controls. See the [DDD renderer guide](../packages/foldkit-zloz/README.md#ddd-preset-renderers)
for slots, caching, themes and portless boundary behavior.

### Editions and history

The pure core exports `captureEdition`, `appendEdition`, `serializeEditions`,
`parseEditions`, `createHistoryReview`, `updateHistoryReview`,
`isHistoryNavigationEvent`, `compareEditions` and their `ZlozEdition`,
`ZlozHistoryReview`, `ZlozHistoryChange`, `ZlozHistoryComparison` contracts.
The `/effect-ui` entry exports `historyGhosts` and
`NativeHistoryGhostArtwork`. See the [history guide](../packages/foldkit-zloz/README.md#named-editions-and-read-only-history)
for archive compatibility, navigation permissions and inert mark customization.

### Edition import and restore

`mergeEditions` adds parsed archives atomically with idempotent exact identities.
`resolveEditionRestore` and `restoreEdition` expose preview and one-step Undo
restoration with required freshness and current policy checks. Public contracts:
`ZlozEditionMergeDecision`, `ZlozEditionRestorePolicy`, `ZlozEditionRestoreOptions`,
`ZlozEditionRestoreDecision`, `ZlozEditionRestoreResult`. See the
[import/restore guide](../packages/foldkit-zloz/README.md#import-and-restore-editions)
for policy scope, graph-only semantics and conflict handling.

## Model documents and edition forks

Core exports `captureModelDocument`, `serializeModelDocument`, `parseModelDocument`,
`forkEdition` and `createModelEditor`, with `ZlozModelDocument`, `ZlozModelIdentity`,
`ZlozModelOrigin`, `ZlozEditionForkPolicy` and `ZlozEditionForkResult`.
The model envelope is independent of graph/snapshot/edition v1. Local diagram IDs
are preserved within a distinct host-allocated model identity. Immediate origin
pins the exact source edition; no mutable lookup or host-owned node-data keys are
used. A fork gets its own edition collection and fresh editor/Undo. See
[the package example](../packages/foldkit-zloz/README.md#fork-an-edition-into-another-model).

CLI exposes `readDocument` and `CliDocument` for metadata-preserving model or
snapshot input. `readGraph` deliberately rejects model envelopes. CLI validation
adds model identity/origin summary only for this new input kind. Mermaid
projections report model metadata and camera omissions and reject them by default.

### Atomic pattern insertion

Core exports `createArchitecturePattern`, `ArchitecturePattern`, `insertPattern`,
`ZlozPatternInsertionOptions`, `ZlozPatternInsertionPolicy` and
`ZlozPatternInsertionResult`. Supply a self-contained `ZlozGraph`, optional world
offset and current policies. The discriminated result is `inserted` (editor plus
node/edge ID maps), `unchanged`, or `blocked` (original editor and reason).
Invalid graph/offset data throws the canonical error. See the [package example](../packages/foldkit-zloz/README.md#atomic-architecture-patterns)
and [ADR 0023](adr/0023-insert-self-contained-patterns-atomically.md).

### Event-storming

Core's `EventStormingNodeArchitecture` adds command, domain-event, policy and actor
notes to the architecture union. `createArchitecturePattern('event-storming')`
uses the same atomic insertion API. The `/foldkit` entry exports
`zlozEventStormingNode`, `ZlozEventStormingNodeOptions`,
`ZlozEventStormingContentContext` and `ZlozEventStormingContentRenderer`.
Four scoped `eventStorming*` theme tokens customize role accents; content/control
slots and artwork caching follow the existing semantic renderer contracts. See
[the package example](../packages/foldkit-zloz/README.md#event-storming-notes)
and [ADR 0024](adr/0024-add-event-storming-process-notes.md).

### Edition playback

Core exports `createEditionPlayback`, `updateEditionPlayback`, `playbackEditionId`
and `editionPlaybackReason`, with `ZlozEditionPlayback`,
`ZlozEditionPlaybackOptions` and `ZlozEditionPlaybackEvent`. The pure cursor is
empty, paused or playing over a pinned ordered ID list; the host owns editions,
clock, read-only projection and subscription lifecycle. Reduced motion pauses
automatic play while manual stepping remains available. See the
[package example](../packages/foldkit-zloz/README.md#opt-in-edition-playback) and
[ADR 0025](adr/0025-add-opt-in-edition-playback.md).

### Playback controls

Core exports `resolveEditionPlaybackControls` and its `ZlozPlaybackControlName`,
`ZlozPlaybackControlEvent`, `ZlozPlaybackControl`, `ZlozPlaybackControlsContext`
and `ZlozPlaybackControlsOptions` contracts. Host restrictions add vetoes without
removing core playback guards or blocking an active Pause.

The `/effect-ui` entry exports `playbackControls`, `playbackControl`,
`playbackStatus`, `playbackReason`, `ZlozPlaybackControlsParts`,
`ZlozPlaybackControlsViewOptions` and `ZlozPlaybackTextOptions`. Native helpers,
ordered subsets, nullable slots and a layout hook separate behavior from visual
composition. See the [package example](../packages/foldkit-zloz/README.md#composable-playback-controls)
and [ADR 0026](adr/0026-compose-package-playback-controls.md).

### Edition scrubber

Core exports `resolveEditionScrubber`, `editionScrubberRequest` and
`resolveEditionSeek`, with `ZlozEditionSeekRequest`, `ZlozEditionSeekDecision`,
`ZlozEditionScrubberEntry`, `ZlozEditionScrubberOptions` and
`ZlozEditionScrubberContext`. Native ordinals become identity requests before
dispatch; fresh host state/policy determines whether an EditionSelected event is
ready, blocked or ignored.

The `/effect-ui` entry exports `editionScrubber`, `editionScrubberInput`,
`editionScrubberReadout`, `editionScrubberReason`, `editionSeekButton`,
`ZlozEditionScrubberParts` and `ZlozEditionScrubberViewOptions`. See the
[package example](../packages/foldkit-zloz/README.md#edition-scrubber-and-explicit-seeking)
and [ADR 0027](adr/0027-seek-editions-with-a-composable-scrubber.md).

### History comparison controls

Core exports `resolveHistoryComparisonControls`, `resolveHistoryComparisonRequest`
and the `ZlozHistoryComparisonControlsState`, `ZlozHistoryComparisonRequest`,
`ZlozHistoryComparisonDecision`, `ZlozHistoryComparisonControlsContext`,
`ZlozHistoryComparisonControlsOptions`, `ZlozHistoryGhostVisibility`,
`ZlozHistoryGhostPart`, `ZlozHistoryGhostControl`, `ZlozHistoryBaselineControl`,
`ZlozComparisonEdition` and `ZlozComparisonChoice` types. Pure contexts separate
stored preferences from effective visibility; fresh requests validate identity
and current host policy without editing history or Undo.

The `/effect-ui` entry exports `historyComparisonControls`,
`historyBaselineSelect`, `historyGhostToggle`,
`historyComparisonStatus`, `historyComparisonReason`,
`ZlozHistoryComparisonControlsParts`, `ZlozHistoryComparisonTextOptions` and
`ZlozHistoryComparisonControlsViewOptions`.
See the [package example](../packages/foldkit-zloz/README.md#composable-history-comparison-controls)
and [ADR 0028](adr/0028-compose-history-comparison-controls.md).

### History change navigation

Core exports `resolveHistoryChangeNavigator` and `resolveHistoryChangeFocus`,
with `ZlozHistoryChangeKind`, `ZlozHistoryChangeFilters`, `ZlozHistoryChangeItem`,
`ZlozHistoryChangeFilter`, `ZlozHistoryChangeEntry`,
`ZlozHistoryChangeFocusRequest`, `ZlozHistoryChangeFocusTarget`,
`ZlozHistoryChangeFocusDecision`, `ZlozHistoryChangeNavigatorOptions` and
`ZlozHistoryChangeNavigatorContext`. Explicit requests revalidate the comparison
pair, visible entity and current host policy before returning camera-only targets.
Core also exports the existing `fitNodes` geometry primitive so earlier node bounds
can frame a camera directly without constructing an editor graph.

The `/effect-ui` entry exports `historyChangeNavigator`,
`historyChangeFilter`, `historyChangeButton`, `historyChangeStatus`,
`historyChangeReason`, `ZlozHistoryChangeNavigatorHandlers`,
`ZlozHistoryChangeNavigatorParts` and `ZlozHistoryChangeNavigatorViewOptions`.
See the [package example](../packages/foldkit-zloz/README.md#composable-history-change-navigation)
and [ADR 0029](adr/0029-navigate-history-comparison-changes.md).

### Event-storming causal relationships

`ZlozEdge.architecture` accepts `ZlozEdgeArchitecture` / `EventStormingEdgeArchitecture`.
Core exports `isEdgeArchitecture`, `eventStormingRelationshipRules`,
`eventStormingParticipantRole`, `eventStormingRelationshipKey`,
`resolveEventStormingRelationship`, `eventStormingRelationshipPolicy` and
`createEventStormingPattern`. Configuration and result types are
`EventStormingParticipantRole`, `ZlozEventStormingRelationshipRule`,
`ZlozEventStormingRelationshipOptions` and `ZlozEventStormingRelationshipDecision`.

`EdgeArchitectureChanged` and `EditorPolicy.canChangeEdgeArchitecture` support
undoable, protected descriptor edits. Opt-in conventions compose with connection
and node-role policies; graph syntax validation remains separate from workshop
compatibility. See the [package example](../packages/foldkit-zloz/README.md#typed-event-storming-relationships)
and [ADR 0030](adr/0030-type-event-storming-causal-relationships.md).

### Causal relationship controls

Core exports `resolveEventStormingRelationshipControls` and
`resolveEventStormingRelationshipRequest`, with
`ZlozEventStormingRelationshipRequest`, `ZlozEventStormingRelationshipControlsOptions`,
`ZlozEventStormingRelationshipChoice`, `ZlozEventStormingRelationshipInference`,
`ZlozEventStormingRelationshipControlsContext` and
`ZlozEventStormingRelationshipEditDecision`. Requests recheck current inspector
identity, conventions, lifecycle and policy before producing an ordinary editor event.

The `/effect-ui` entry exports `eventStormingRelationshipControls`,
`eventStormingRelationshipSelect`, `eventStormingRelationshipInference`,
`eventStormingRelationshipStatus`, `eventStormingRelationshipReasons`,
`ZlozRelationshipTextOptions`, `ZlozEventStormingRelationshipControlsParts` and
`ZlozEventStormingRelationshipControlsViewOptions`. See the
[package example](../packages/foldkit-zloz/README.md#composable-causal-relationship-controls)
and [ADR 0031](adr/0031-compose-causal-relationship-controls.md).

### Causal relationship audit

Core exports `auditEventStormingRelationships`, `ZlozRelationshipAuditCode`,
`ZlozEventStormingRelationshipAuditEntry` and `ZlozEventStormingRelationshipAudit`.
The read-only report classifies all edges using the existing resolver and accepts
the same custom rules/role interpretation. See the
[core example](../packages/foldkit-zloz/README.md#read-only-causal-relationship-audit).

The Effect CLI adds `zloz relationships audit` with optional bounded data-only
`--rules` files and `CliAuditIncompatible`. Its audited response distinguishes
semantic incompatibility (exit 1) from malformed/configuration input (exit 2),
retains complete per-edge results and scopes models explicitly to their current
graph. See the [CLI contract](../packages/foldkit-zloz-cli/README.md#causal-relationship-audit)
and [ADR 0032](adr/0032-audit-causal-relationships-through-effect-cli.md).

### Edition-aware audit comparison

Core exports `compareModelEventStormingRelationships`,
`ZlozRelationshipAuditFinding`, `ZlozRelationshipAuditSource`,
`ZlozRelationshipAuditSelection`, `ZlozRelationshipAuditComparison` and
`ZlozRelationshipAuditComparisonDecision`. Explicit model-owned selectors return
a comparison or a blocked unknown-edition/baseline decision. Both sides use the
same conventions; findings are matched by edge ID and code. Full audits and
introduced/resolved/persisting projections remain available without editing data.
See the [core example](../packages/foldkit-zloz/README.md#edition-aware-audit-comparison).

The Effect CLI adds `relationships compare --baseline <id> [--edition <id>]`
and `CliAuditRegression`. Its compared response gates only newly introduced
findings (exit 1); no new findings exits 0 even when existing findings persist.
Selector/input errors exit 2. See the
[CLI contract](../packages/foldkit-zloz-cli/README.md#edition-aware-audit-comparison)
and [ADR 0033](adr/0033-compare-edition-relationship-audits.md).

### Composable audit comparison controls

Core exports `resolveAuditComparisonControls`, `resolveAuditComparisonRequest`,
`ZlozAuditFindingKind`, `ZlozAuditComparisonState`, `ZlozAuditFindingFocusRequest`,
`ZlozAuditComparisonRequest`, `ZlozAuditFindingItem`, `ZlozAuditFindingEntry`,
`ZlozAuditEditionControl`, `ZlozAuditFindingFilter`,
`ZlozAuditComparisonControlsOptions`, `ZlozAuditComparisonControlsContext` and
`ZlozAuditComparisonDecision`. The pure request resolver rechecks current scope,
filters and policy before returning a source-aware camera navigation event.

The `/effect-ui` entry exports `auditComparisonControls`,
`auditEditionSelect`, `auditFindingFilter`, and `auditFindingButton`.
Nullable slots customize layout, text, and numeric readouts. See the
[package example](../packages/foldkit-zloz/README.md#composable-audit-comparison-controls)
and [ADR 0034](adr/0034-compose-audit-comparison-controls.md).

### Portable review packets

The optional Mermaid package exports `createReviewPacket`, `ZlozReviewPacket`,
`ZlozReviewPacketOptions`, `ZlozReviewPacketDiagnostic`, `ZlozReviewSnapshot` and
`ZlozReviewPacketResult`. The pure builder composes core comparison and loss-aware
projections into a versioned, selected-snapshot export. The complete data-only
catalogue travels with chosen snapshots, findings and Mermaid identity metadata.
Core remains independent of the optional adapter. See the
[packet contract](../packages/foldkit-zloz-mermaid/README.md#portable-review-packets).

The Effect CLI adds `review packet --baseline <id> [--edition <id>]` with existing
input/rules/direction/loss-policy flags and `CliReviewInputRejected`. Creation
exits 0 even with introduced findings; projection rejection exits 1 and invalid
input/selectors exit 2. See the
[CLI contract](../packages/foldkit-zloz-cli/README.md#portable-review-packets)
and [ADR 0035](adr/0035-export-portable-review-packets.md).

`CliDiagnostic` also exposes an exact optional `side` field for packet diagnostics,
including projection rejection. Its schema retains that field when decoding;
existing command diagnostics omit it and retain their original JSON shape.

### Read-only review-packet readers (unreleased)

The optional Mermaid package exports `createReviewReader`, `reviewReaderForScope`,
`resolveReviewReader` and `updateReviewReader` with typed state, request, side,
options and update contracts. Its `/foldkit` entry exports `zlozReviewReader` and
view options/parts. Hosts own bounded IO, unique model-incarnation scopes and
detached read-only canvases. Stale, cancelled, invalid or protected reads retain
the last accepted packet and side; opening grants no model-edit authority.
See the [reader guide](../packages/foldkit-zloz-mermaid/README.md#read-only-packet-reader-unreleased)
and [ADR 0059](adr/0059-open-review-packets-with-detached-reader-controls.md).

### Modelling-patch proposals and dry runs (unreleased)

Core exports `captureModellingPatch` and `dryRunModellingPatch` with public source,
provenance, operation, proposal, change, loss, finding, candidate, preview and
options types. Six explicit node/edge add/replace/remove operations produce a
detached frozen prospective graph after source identity/revision/content and core
invariant checks. Review policies disclose blockers without hiding valid proposals.
No editor mutation or Apply authority follows from dry run. See the
[contract guide](../packages/foldkit-zloz/README.md#headless-modelling-patches-and-dry-runs-unreleased),
[ADR 0060](adr/0060-preview-bounded-modelling-patches-before-apply.md) and
[local evidence](../packages/foldkit-zloz/evidence/modelling-patch.md).

### Strict modelling-patch text decoding (unreleased)

Core exports `parseModellingPatch`, `ZlozModellingPatchParseOptions` and
`ZlozModellingPatchParseResult`. Decode one raw v1 proposal with bounded JSON
grammar/duplicate-key preflight followed by the existing object validator.
`parsed` contains owned frozen data; `rejected` contains a code, reason and JSON
Pointer path. Configuration can tighten the v1 character/depth/value caps.
Decoding grants no dry-run success or Apply authority. See the
[decoder guide](../packages/foldkit-zloz/README.md#strict-versioned-patch-decoding-unreleased)
and [ADR 0061](adr/0061-decode-versioned-modelling-patch-text-strictly.md).

### Reviewed patch Apply and controls (unreleased)

Core exports `resolveModellingPatchReview`, `resolveModellingPatchAcknowledgement`
and `applyModellingPatch`, plus identity, consent, options, review/request, receipt
and Apply-result types. The optional `/foldkit` entry exposes the native review,
acknowledgement and Apply helpers with nullable slots/layout and diagnostic controls.
Apply reconstructs current source and policy, requires exact-content acknowledgement,
and returns the editor and provenance receipt together after one Undo commit.
The Effect CLI adds inspect-only `patch dry-run` against a separate current source.
See [ADR 0062](adr/0062-complete-reviewed-patch-cli-and-atomic-apply.md) and
[completion evidence](../apps/zloz-demo/evidence/p2-completion.md).
