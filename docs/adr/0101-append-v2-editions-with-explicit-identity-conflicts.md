# ADR 0101: Append v2 editions with explicit identity conflicts

## Status

Accepted for the approved package append slice, 2026-11-15. Follows
[ADR 0100](0100-navigate-v2-changes-with-explicit-mode-inspection.md).
Architecture, delivery and test-quality reviews are self-review.

## Decision

Add core `appendEditionV2(editions, edition)` with `ZlozEditionAppendResultV2`.
Reuse the v2 archive codec to validate/detach the complete existing archive,
including unselected entries and duplicate IDs, then capture/validate the proposed
checkpoint through `captureEditionV2`. Invalid typed/wire-shaped data throws the
existing core validation error before any result is returned. V1 records require
an explicit upgrade. No mode is inferred from ports or from a containing model.

A fresh ID yields `appended` with a detached deeply frozen archive in existing
order plus the proposed checkpoint. Preserve every checkpoint's explicit mode,
camera, authored graph/port IDs, geometry, payloads and metadata. The host supplies
identity/name verbatim; no timestamps, counters, clocks or names are invented.
Caller-owned arrays, checkpoints and nested data are neither mutated nor frozen.

A reused ID never appends, renames or overwrites. Preserve the established v1
append rejection rule even when the repeated checkpoint is identical. Return a
blocked result with `duplicate-edition` for identical canonical JSON values or
`edition-conflict` for different values. Both carry a readable reason and detached
frozen existing/proposed pins for read-only comparison, but no archive to publish.
The result discriminator prevents a blocked append from exposing an editions field.

Reuse the established internal JSON-value equality helper. Use ordinal key sorting
rather than locale collation, which can compare distinct composed/decomposed
Unicode keys equally and make insertion order affect equality. This shared
correctness fix retains the promised object-key-order insensitivity for v1 and v2
comparisons without changing persisted wire data. Object-key order is irrelevant; identity/name, snapshot mode, camera, authored payload/geometry and
array order participate. Node/edge array order can carry authored presentation
order and is not normalized. This is checkpoint equality, not just stable-ID graph
semantic equality: even a mode-only, camera-only or name-only difference conflicts.
Hosts can pass the returned pins to `compareEditionsV2`; its narrower graph/mode
flags deliberately exclude camera and checkpoint metadata.

## Alternatives and boundary review

Boundary verdict: **safe with noted risk**. Core owns list validation, immutable
append and conflict classification. The host owns archive selection, wider model
ownership/identity allocation, any live application permissions and persistence.
An append result is local data, not permission to write a model or external store.
Compose success through `captureModelDocumentV2` when updating a canonical model;
this helper does not validate a containing model's current snapshot or origin.
No editor, review, Undo, restore, playback or policy cache is owned here.

Simplicity check: reuse codecs and equality rather than add another decoder,
editor reducer or policy framework. Codec roundtrips intentionally validate/copy
the whole archive; no throughput claim or cached validation is introduced. A new
capture abstraction is unnecessary for this bounded API. Idempotent identical
append was considered but rejected to preserve append semantics; additive import
with idempotency belongs to the separate merge contract. Silent replacement or
mode downgrade would erase checkpoint intent. V1 append behavior is unchanged.

No wire format, dependency/version change, publication or deployment. V2 merge,
restore/playback, CLI/workbench adoption and wider C/Q/R qualification remain
open; C1 stays partial. No visual control is added in this headless slice.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/edition-append-v2.md) records
all mode combinations, loose-only data, full-archive/candidate validation,
duplicate/conflict separation, immutable pins, model/history composition,
installed consumers, an identity-guard mutation and repository checks.

Next: atomic v2 edition merge with idempotent identical imports and explicit
identity conflicts, preserving modes before restore/playback adoption.
