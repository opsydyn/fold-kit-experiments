# EventStorming-to-C4 atomic Apply qualification

- result: complete
- claim: reviewed C4 conversion publishes all graph changes and a frozen provenance record together, with live gates and one Undo.
- evidence: public Apply tests, existing plan/preview suites, installed consumer and full workspace checks below.
- remaining uncertainty: host publication/storage, actual user acceptance, portable receipt decoding and hosted qualification remain open.
- next: compose guarded Apply and retained conversion records in one workbench update.

## Scope

See [ADR 0088](../../../docs/adr/0088-apply-c4-conversion-atomically.md).
Core rebuilds current mappings, placement/containment and exact consent. Source graph,
camera and revision must match the live editor; current session/document/editions and
choices must match affirmative review. Core relies on the host to supply the authentic
current document/session. This is not authentication or proof of a human action.

Expected denials return the same editor object and no conversion record. Lifecycle,
read-only, host busy and enabled Undo checks are live. Architecture, C4-specific label,
membership and whole-transaction policies see detached frozen current/proposed data;
a late veto cannot publish earlier approved changes. Explicit containment is protected
even when its parent ID is unchanged. Blank denial text remains a denial.

Plan validation and Apply use the same internal projection. Successful conversion
preserves source IDs, wiring, ports, geometry, host data, editions and ancestry;
changes only reviewed descriptors, names and membership/constraint fields. The
source, exact reviewed choices, loss acceptance and target document are retained in
a frozen in-memory record. One graph Undo/Redo switches the complete graph. The host
must retain the record and editor in the same synchronous update; records do not
become Undo history, credentials, or a supported portable import format.

## Verification

The initial failing test run recorded the missing public Apply export. Fifteen public
Apply tests now pass, covering:

- Complete conversion, plain communication, parent/constraint removal, retained
  geometry/data/editions, frozen provenance and one Undo/Redo.
- Live revision/graph/camera drift, missing source camera, session/document/choice/
  placement freshness and revoked consent.
- Read-only state, gestures, connections, label drafts, camera fits, external busy
  reason, disabled Undo, unresolved membership and all-retained no-op.
- Atomic denial/retry for every granular and whole-transaction hook, complete frozen
  proposed values, late membership veto and unchanged-parent containment declaration.
- Compatible system/container containment and incompatible role refusal.

The real installed-tarball consumer imports the public Apply function and result type,
converts its workshop, checks retained source identity and verifies one Undo restores
the workshop descriptor. Existing plan tests continue to cover strict malformed/
foreign choices, cycles, direct-member scope and no partial plans. No npm publishing.

Full `bun typecheck`, `bun run check` and `bun run test` completed locally with
exit 0. The core package passed **634 tests**, including the real installed consumer.
An additional affected-package typecheck passed after the final test additions.
Existing configured warnings/skips remain; this is not warning-free qualification.

A temporary mutation bypassed the membership veto: **three Apply tests failed**,
including unchanged-parent containment and late atomic rejection. Restoring the
original source returned all **15 Apply tests** to green. No mutated source remains.
API documentation generation (`bun run --filter @opsydyn/foldkit-zloz docs`)
completed with exit 0, including a final rebuild from restored source. Architecture,
boundary and test-quality reviews are self-review. Visual evidence is not applicable
to this headless slice; the workbench remains in plan review mode.

Recommendation: **needs follow-up** for workbench publication and portable receipt qualification.
