# ADR 0095: Stage canonical v2 model and edition documents

## Status

Accepted for the approved headless contract and compatibility slice, 2026-11-14.
Follows [ADR 0094](0094-adopt-loose-mode-in-native-port-interactions.md).
Architecture, delivery and test-quality review are self-review.

## Context and decision

Standalone v2 snapshots and fixed-mode editor sessions retain loose intent, while
canonical model and edition archives still use v1. A model-wide preference would
silently reinterpret historical or pinned-origin checkpoints. Add dedicated
`ZlozModelDocumentV2`, `ZlozModelOriginV2` and `ZlozEditionV2` contracts and explicit
capture/parse/serialize APIs. Canonical model and edition envelopes retain their
existing format names and use numeric version 2. Each `snapshot` is a complete
`ZlozConnectionDocument` with required version 2 and `connectionMode`.

Mode belongs to each checkpoint. Current, archived and pinned-origin snapshots may
have different explicit modes; none overrides or supplies a default to another.
This is a data contract, not a mode-changing editor event. IDs/names, authored
ports/endpoints, metadata, geometry and optional cameras remain local to each
snapshot. Existing portless-group/world-coordinate/finite-data rules remain.
Duplicate edition IDs reject the entire archive. Origin is null or the existing
immediate-parent identity/name plus pinned edition; a model cannot name itself as
its immediate parent. No identity, time, counters or provenance are invented.

The codecs validate typed inputs before encoding, revalidate detached encoded data
and deeply freeze their output. Envelope/model/edition/origin fields are exact;
unknown versions/modes/fields, absent checkpoint modes, malformed JSON, duplicate
IDs and invalid snapshot/provenance data reject. Reuse the existing v2 snapshot
validator internally rather than duplicating graph semantics. Pure codecs do not
supply host byte/time limits.

## Compatibility and explicit migration

V1 public readers stay v1-only and their wire output remains version 1. V2 readers
are v2-only. `upgradeModelDocumentToV2` and `upgradeEditionsToV2` explicitly copy
validated v1 checkpoints into strict v2 snapshots, including pinned provenance.
They inspect original snapshots and reject already-v2 data rather than resetting
an existing mode to strict. Recapture through the v2 APIs preserves every mode.

The current v1 snapshot writer now rejects an explicit non-v1 snapshot version or
an explicit non-strict mode, before its graph-only early return. Edition/model
constructors and writers inherit that guard. This closes the serializer hazard
noted in ADR 0093: loose editor states and v2 records must use v2 codecs or a
reviewed downgrade. Saving an ordinary strict editor remains supported and
produces the same v1 data. Deliberately extracting a raw graph can still discard
mode; types/shape compatibility are not a capability or migration protocol.
Historical implementations may lack this raw-record guard. Only versioned v2
wire rejection is qualified against the pinned old implementation.

Downgrade planning is whole-model/whole-archive review. Check the current snapshot,
every edition and pinned origin. Any loose-only edge blocks the whole result;
there is no partial legacy document/archive, filtered history, missing origin,
manufactured port or edge rewrite. Otherwise return prospective v1 data and
`loose-mode-removed` findings for **each** loose checkpoint, even if all current
pairs fit strict rules. Findings identify exact snapshot paths and incompatible
edge IDs. The detached source remains available. Review does not write a file,
change mode, carry present consent or authorize Apply. Caller review must precede
explicit serialization of the prospective v1 result.

## Boundary review and alternatives

Boundary verdict: **safe with noted risk**. Core owns formats, snapshot validation,
identity/provenance and projections. No browser, I/O, provider or CLI dependency
enters core. Separate named versioned APIs prevent old defaults from becoming
implicit migrations. A top-level mode was rejected because it would overwrite
history; silently upgrading old decoders or dropping incompatible historical data
would break intent and provenance. Automatically switching editors or changing
all portable formats would exceed this approved contract slice.

V2 model initialization, fork, append/review/compare/restore/playback, patches,
receipts, layouts, Mermaid/CLI and workbench imports remain separate adoption
boundaries. Do not pass v2 records to those v1 APIs expecting mode preservation;
current v1 constructors reject explicit v2 snapshots. V2 callers can use the
existing standalone initializer on an explicitly selected v2 snapshot, but no
canonical workflow adapter is added here. No npm publishing, version bump or
deployment occurs. C1 and broader C/Q/R gates remain partial.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/model-v2.md) links independent
nonempty v1/v2 literals, live old-reader checks under Node/Bun, installed consumer
and package tests. The old-reader probe builds actual core source from pinned
pre-canonical commit `36de608a`; it is not a simulated parser or a universal
historical-registry claim.

Next: package-owned v2 model initialization and read-only edition review, retaining
each snapshot's mode and independent session/history, before fork/restore/playback
and workbench adoption.
