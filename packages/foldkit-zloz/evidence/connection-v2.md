# Headless v2 connection-mode contract qualification

- result: complete
- claim: explicit standalone v2 documents and a shared strict/loose port-kind matrix are implemented while legacy v1 codecs/editors remain strict; downgrade is review planning only.
- evidence: independent v1/v2 literals, endpoint/codec/immutability/regression tests, installed consumers, pinned actual pre-mode Node/Bun code and repository checks below.
- remaining uncertainty: loose editor/interaction and model/archive/patch/receipt/layout/Mermaid/CLI adoption are not implemented by this slice; broader C1/C/Q/R qualification stays open.
- next: adopt the explicit mode in package-owned headless editor initialization and creation/reconnection commits with live policies, history boundaries and one Undo, before UI controls.

See [ADR 0092](../../../docs/adr/0092-stage-explicit-v2-connection-documents.md).

## Public contract and boundaries

`resolveConnectionPortPair` checks kinds only, never permission. Strict output→input
is the default; loose accepts all four combinations of existing input/output kinds.
Ordered endpoints, source/target IDs, port kinds and semantic descriptors are not
rewritten. Missing ports and unknown modes reject. Core structural validation and
legacy connection validation now share that matrix **in strict mode**, preserving
existing creation/reconnection policy order, duplicate checks and protection reasons.

Dedicated capture/parse/serialize APIs own standalone v2 connection documents,
required `connectionMode` and optional camera. Construction defaults to strict only
when the mode is absent; recapture preserves an existing explicit mode. Text decoding
requires known version/mode and validates authored graph/group/geometry/JSON fields.
Envelope, graph-level and camera keys are strict. Data detaches/freezes; serializer
validation precedes JSON encoding so nonfinite payloads do not become null.

Downgrade planning gives no current consent, edit capability or file output.
Loose-only edges return deterministic incompatible IDs without a partial snapshot.
Strict-compatible loose documents return a prospective v1 snapshot with explicit
mode-removal loss, because future authoring semantics would change. No kinds,
ports or identities are manufactured. Retain the source and decline a downgrade
if the prospective strict representation is unsuitable.

V2 is not a hidden EditorOptions override. Current editor/model/edition/receipt/
patch/layout/Mermaid/CLI paths retain their old supported boundaries and do not
acquire v2 decoding here. Do not extract raw graph data and expect those APIs to
preserve its mode. This slice introduces no new editor transaction or loose Undo
claim; live authorization and one-Undo qualification are mandatory on adoption.
No native/custom view or new visual evidence is claimed for this headless slice.

## Tests and compatibility proof

Sixteen new public tests cover the complete kind matrix in both modes, defaults,
missing/unknown cases, literal v2 capture/serialization and frozen authored data,
explicit v1 upgrade, old API rejection, immutable blocked/disclosed downgrades,
strict envelope/camera/identity/group checks, pre-encoding nonfinite-data rejection,
reverse/self connections and nested world-coordinate/parent-constraint retention.
The existing connection-validation regression cases cover live callback order,
replacement semantics, arbitrary endpoint identity, duplicates and stale host lookup.
Full workspace qualification also retains the existing strict editor/Undo tests.

The actual installed consumer imports the new functions/types, decodes the independent
loose literal, preserves its port kind, checks blocked downgrade and strict defaults,
and compiles a negative unknown-mode fixture. Node/Bun and strict TypeScript consumer
results are recorded with final package checks; no npm publication is involved.

`bun packages/foldkit-zloz/evidence/connection-v2-compat.ts` builds actual core source
from pinned pre-mode commit `f9052013` in a temporary directory. Its driver runs
under Node and Bun. [Recorded result](connection-v2-compat.json) includes the full
baseline, measured parent, old bundle digest and new loose-wire digest. Both
runtimes verify literal v1 reading, v2 strict graph-reader rejection, v2 loose
snapshot-reader rejection, loose-only payload refusal by the old editor, explicit
v1 downgrade readability, and unchanged legacy editing/one Undo. This is one pinned
pre-mode artifact, not proof for every historical package or higher-level archive.
The script owns/removes its temporary fixtures and changes no historical artifact.

## Development and final verification

The initial new tests failed at missing exports. A negative TypeScript fixture's
expect-error directive was moved onto its actual invalid declaration after formatting
split the callback; final typechecks were rerun. A recapture regression ensures an
existing loose mode is preserved rather than defaulted away. The final boundary
also validates typed data before encoding, avoiding silent normalization of NaN.
These development failures are not passing evidence.

Full `bun typecheck` completed with exit 0 after the negative-fixture fix.
A temporary mutation bypassed strict kind enforcement: **eight tests failed**,
including legacy validation/editing and downgrade protection. Restoring the source
returned all **20 focused contract/connection-validation tests** to green. No mutated
source remains. Final `bun run check` and `bun run test` completed with exit 0.
Core recorded **689 passing tests**, including installed Node/Bun and TypeScript
consumers; the workbench recorded **166** and CLI **31**. The full workspace run
reported no failures; two existing promo tests remain skipped.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
the new public functions and type pages with warnings treated as errors. Reviews are
architecture/boundary/delivery/test-quality self-review. Existing warnings/skips remain distinct from failures. No provider,
version bump to existing archives, full C1/parity closure, publishing or deployment.

Recommendation: **needs follow-up** for headless editor adoption, with C1 partial.
