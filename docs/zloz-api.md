# Foldkit Zloz API and type contracts

The Zloz API reference is generated with TypeDoc from public package entry points,
using the same tool as FoldKit Viz. It describes the source revision used for the
build; the packages remain local release candidates until separately published.

[Open the Zloz API reference](/fold-kit-experiments/zloz/api/).
The route is populated by the updated Pages workflow after merge/deployment.

The reference includes:

- `@opsydyn/foldkit-zloz`: graph/port types, editor state/events, serialization,
  history, layout publication, shared edge geometry, custom port anchors and connection-preview policies.
  The root also exports C4/DDD node descriptors, architecture presets/factory,
  shape geometry and undoable architecture/appearance events. These are headless
  contracts; opt-in C4 artwork lives in the optional view entry. DDD artwork and
  pattern builders remain subsequent slices.
- `@opsydyn/foldkit-zloz/foldkit`: view options, node/group shells, public
  interaction primitives, diagnostics and background contracts.
  Opt-in `zlozC4Node`/`zlozC4Group` presets expose content/control slots and scoped
  themes through the same public primitives.
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
The optional Foldkit entry exports `zlozHistoryGhosts` and
`ZlozHistoryGhostOptions`. See the [history guide](../packages/foldkit-zloz/README.md#named-editions-and-read-only-history)
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

The `/foldkit` entry exports `zlozPlaybackControls`, `zlozPlaybackControl`,
`zlozPlaybackStatus`, `zlozPlaybackReason`, `ZlozPlaybackControlsParts`,
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

The `/foldkit` entry exports `zlozEditionScrubber`, `zlozEditionScrubberInput`,
`zlozEditionScrubberReadout`, `zlozEditionScrubberReason`, `zlozEditionSeekButton`,
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

The `/foldkit` entry exports `zlozHistoryComparisonControls`,
`zlozHistoryBaselineSelect`, `zlozHistoryGhostToggle`,
`zlozHistoryComparisonStatus`, `zlozHistoryComparisonReason`,
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

The `/foldkit` entry exports `zlozHistoryChangeNavigator`,
`zlozHistoryChangeFilter`, `zlozHistoryChangeButton`, `zlozHistoryChangeStatus`,
`zlozHistoryChangeReason`, `ZlozHistoryChangeNavigatorHandlers`,
`ZlozHistoryChangeNavigatorParts` and `ZlozHistoryChangeNavigatorViewOptions`.
See the [package example](../packages/foldkit-zloz/README.md#composable-history-change-navigation)
and [ADR 0029](adr/0029-navigate-history-comparison-changes.md).
