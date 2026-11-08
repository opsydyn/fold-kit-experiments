# ADR 0018: Add portable editions and read-only history

## Status

Accepted for the approved named-edition, rewind and comparison-ghost slice,
2026-11-08. Related: ADR 0005 and ADR 0017.

## Decision and contract

The dependency-free core owns immutable named snapshots, archive validation,
comparison and a read-only review adapter. The optional Foldkit entry owns a
composable inert ghost overlay. Astro composes controls and demonstrates the
public APIs. No new package or dependency is needed.

`captureEdition` takes caller-owned identity/name and a canonical graph/optional
camera snapshot, validates it through the existing codec, detaches and deeply
freezes it. No timestamp, domain identity or editor freshness revision is invented.
`appendEdition` rejects duplicate IDs. `serializeEditions`/`parseEditions` use a
separate `foldkit-zloz-editions` version-1 envelope with an editions array; nested
snapshots retain the canonical graph contract. Reserved fields and archive
versions reject unknown values. The existing graph/snapshot document stays at
version 1 without added history fields. Archives include captured editions only,
not an implicit copy of a potentially unsaved working document.

The working editor remains the host's source of truth. `createHistoryReview`
constructs a separate read-only editor; `updateHistoryReview` accepts an explicit
navigation/selection allowlist and ignores every other event, including Undo and
node measurement. New EditorEvent variants do not gain historical permissions
implicitly. Returning to the present discards the review session, preserving the
working graph, camera, clipboard, freshness token and Undo stack. Read-only review
is an application correctness boundary, not security against a host rewriting
its own JavaScript state.

`compareEditions` matches stable IDs. Node meaning includes labels, architecture,
data, containment and port identities/kinds/labels; layout includes positions,
sizes, appearances, port positions and constraints. Edge endpoints/labels/data
are meaning; path style and core-computed paths are layout. JSON object key order
is ignored. Host renderer output, custom routing, derived execution and runtime
messages are not captured or replayed. Missing means added/removed, not a guessed
rename. Pure comparisons are advisory review data, not executable migration plans.

Ghosts show baseline outlines and edge geometry plus movement connectors, with
added/removed/changed treatments. Canonical node geometry is reused. Their SVG
creates no editor nodes, ports, focus targets, hit regions or Undo entries. Global,
node, edge and movement visibility are independently configurable, as are inert
mark callbacks. An accessible textual comparison must accompany visual-only SVG.
The demo's Minimal mode masks ghosts without resetting preferences.

## Alternatives, boundary review and consequences

Boundary review: **safe with noted risk**. Edition serialization is domain data;
filesystem, storage and network remain host Commands/adapters. The separate
collaboration proposal is not activated or replaced. Full snapshots cost space
proportional to captured model size; no compression, incremental journal or
performance superiority is claimed. Hosts choose retention and I/O size budgets.

Reusing the editor's past/future arrays would couple durable documents to session
Undo. Treating its monotonic freshness token as an edition would break stale-layout
protection. Capturing arbitrary Foldkit runtime models would entangle host services,
commands and transient state with portable graph history. A new event store or
collaboration runtime is unnecessary for this bounded slice.

## Qualification and deferred scope

Exercise literal archive fixtures, invalid versions/records/cameras/duplicates,
deep detachment/freezing, stable-ID semantic/layout comparisons, blocked edits
and measurements, retained present identity, and installed consumers. Browser
checks must cover rewind/navigation/return, ghosts/toggles, light/dark, canonical
export and unchanged present Undo. Independent review is unavailable in this
session; architecture, delivery and test review are self-review.

Restore-as-new-transaction, forks/merge, playback, archive import UI, automatic
persistence, collaborative history and agent history commands are separate slices.
The workbench explicitly labels session ownership and provides archive download;
core parsing already supports reopening by consumers. This is snapshot review,
not a claim of deterministic event replay. Reverting adds no graph migration.
