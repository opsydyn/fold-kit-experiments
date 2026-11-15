# Canonical v2 model and edition qualification

- result: complete
- claim: explicit canonical v2 codecs retain each current/edition/pinned-origin mode, enforce validated identity/provenance, and provide explicit v1 upgrade and whole-result downgrade review without adopting editor/history workflows.
- evidence: independent nonempty model/archive literals, public codec/upgrade/projection tests, actual pinned old source under Node/Bun, installed consumers and repository checks below.
- remaining uncertainty: v2 canonical initialization/fork/append/review/compare/restore/playback, other portable adapters, CLI/workbench and broader C/Q/R qualification remain open; C1 is partial.
- next: adopt v2 in package-owned model initialization and read-only edition review, preserving checkpoint mode and independent session/history before wider workflow adoption.

Measured parent: `36de608a`, isolated `codex/zloz-context-map` worktree.
See [ADR 0095](../../../docs/adr/0095-stage-canonical-v2-model-and-edition-documents.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered contract

`ZlozModelDocumentV2` owns current snapshot, named editions and nullable immediate
parent provenance. `ZlozEditionV2` and pinned `ZlozModelOriginV2.edition` each own a
complete explicit v2 connection snapshot. Modes may differ across checkpoints;
none supplies a default to another. Format names remain `foldkit-zloz-model` and
`foldkit-zloz-editions`, with numeric envelope version 2. V1 and v2 codecs remain
separate; no clocks, identities or provenance are invented.

Typed constructors/serializers validate before encoding, revalidate detached data
and deeply freeze it. Exact envelope/model/edition/origin fields, explicit known
snapshot modes/versions, unique archive identities and valid parent identity are
required. Existing graph/port/group/geometry/JSON/camera grammar is reused. Pure
core codecs impose no host byte/time limits and add no I/O or dependencies.

Explicit v1 upgrades retain all supported authored data/cameras and mark every
checkpoint strict. Existing v2 snapshots reject rather than resetting mode.
Current v1 snapshot writers now refuse explicit non-v1 versions or non-strict
modes before their graph-only return; model/edition constructors inherit the
safeguard. Ordinary strict-editor v1 saves remain supported. Deliberately unwrapping
raw graph data can still discard intent. Historical implementations may lack this
raw-record guard; the old-reader proof qualifies versioned wire rejection.

Downgrade plans inspect current, every edition and pinned origin. A loose-only edge
anywhere blocks the entire legacy result. There is no partial archive/document,
filtered history, omitted origin, manufactured port or edge rewrite. Otherwise
prospective v1 data is exposed with path-qualified mode-removal findings for each
loose checkpoint, including strict-compatible graphs. Sources/findings detach and
freeze. Plans carry no file write, mode mutation, current consent or Apply grant.
No editor/history workflow or UI evidence is claimed for this headless slice.

## Tests and compatibility

Four independent JSON fixtures define v1/v2 model and edition envelopes. Nonempty
node/edge/port records are copied from the independently authored strict connection
literal, not library encoder output. Current snapshots, editions and pinned origin
retain explicit cameras and identities. The separate loose-only literal exercises
ordered input→input edges and authored payloads.

Twelve new public tests cover exact literal wire values, mixed checkpoint modes,
detach/freeze and recapture; explicit upgrade and cross-version refusal; loose-only
present/history/origin blockers; every compatible mode-removal loss; whole-archive
paths and unusual IDs; duplicate/malformed/future/unknown/absent fields and modes;
pre-encoding nonfinite data; and current v1 writer rejection versus ordinary strict
saving. Existing connection-document/model regressions remain in the focused run.
Installed package consumers import v2 types/functions, retain pinned mode, roundtrip
archives, inspect downgrade findings and compile a negative missing-mode fixture
under Node/Bun and strict TypeScript.

[Compatibility script](model-v2-compat.ts) builds actual core source from pinned
pre-canonical commit `36de608a` in its owned temporary directory. Node and Bun run
that old bundle, reading independent v1 model/archive data, rejecting strict,
loose-only and mixed-mode v2 model envelopes plus strict/loose v2 edition envelopes,
reading the explicit whole-model v1 downgrade and performing unchanged legacy model
editing with one Undo. [Recorded results](model-v2-compat.json) include full commit
IDs and bundle/wire digests. This is one actual old source artifact, not a simulated
reader or proof for every registry release. Only owned temporary files are removed.

## Development and final checks

Initial tests failed at missing public APIs. Fixture expectations were corrected
to the authored edge ID. Exact comparisons against untrusted JSON literals use
Node's deep equality to avoid widening fixture strings into domain types. An
unknown-return JSON helper was replaced by local parse/assert boundaries. A
regression reproduced v1 constructors silently dropping explicit v2 intent; the
writer guard now rejects those calls while a strict-editor save still passes.
A temporary bypass of pinned-origin validation caused one test to fail. Restoring
the source returned all **32 focused tests** to green. No mutated source remains.
Development failures are not passing evidence. Final repository/consumer/docs
results are recorded below; existing warnings/skips are not failures.

`bun run test` completed with exit 0: core **739 pass**, workbench **169 pass**,
CLI **31 pass**, including packed Node/Bun and strict TypeScript consumers. No
workspace failures; two existing promo tests remain skipped. The final stronger
focused rerun recorded **32 pass**. `bun run check` completed with exit 0; existing
Effect/TypeScript lint and Viz skill-version warnings remain distinct from errors.

Full `bun typecheck` completed with exit 0.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
the canonical v2 function/type pages with warnings treated as errors.

Recommendation: **needs follow-up** for canonical workflow adoption. No publishing,
deployment, dependency/version change or full C1/parity closure.
