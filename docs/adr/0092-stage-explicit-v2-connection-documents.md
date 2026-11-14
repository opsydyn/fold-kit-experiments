# ADR 0092: Stage explicit v2 connection documents before editor adoption

## Status

Accepted for the approved headless contract/compatibility slice, 2026-11-14.
Follows the C1 recommendation in the November 14 reconciliation. Architecture,
boundary, delivery and test-quality reviews are self-review.

## Decision

Introduce a standalone graph/snapshot **v2** connection document with required
`connectionMode: strict | loose`, authored graph and optional validated camera.
Construction defaults to strict when mode is absent and preserves an existing
explicit mode on recapture; text decoding requires a known mode.
Use dedicated capture/parse/serialize APIs. Leave legacy graph/snapshot serializers
at version 1 and all existing editor/model/edition/receipt/patch entry points strict.
A new mode is not an EditorOptions override or a hidden graph/data field.

The shared pure port-kind resolver permits only output→input under strict mode,
and any existing input/output pair under loose mode. Missing ports and unknown
modes reject. Source and target stay ordered; loose mode implies neither symmetric
DDD meaning nor edit authority. Reuse this resolver in legacy structural validation
and connection policy validation in strict mode. Existing source/target policy order,
duplicate/reconnect checks and human protection reasons remain unchanged.

V2 uses the same authored nodes, ordered endpoints, geometry, metadata, groups and
JSON data rules. Group ports remain forbidden; nested membership/world coordinates,
identity uniqueness and finite geometry remain validated. The explicit envelope,
mode, graph-level fields and camera fields are strict. Do not invent neutral ports,
change port kinds, infer direction or rewrite endpoints. Decode into detached frozen
data and revalidate typed records before serializing, including nonfinite JSON data.

## Compatibility boundary

Old v1 graph/snapshot readers reject both strict and loose v2 documents by version.
Explicit upgrade is `captureConnectionDocument(parseSnapshot(v1Text))`; it retains
all authored snapshot data under strict mode. No automatic migration happens while
loading old files. Strict v1 codec output and editor behavior remain unchanged.

Downgrade is **planning only**. If any ordered pair cannot satisfy v1 strict rules,
return deterministic incompatible edge IDs and no partial snapshot. Otherwise return
a prospective strict snapshot and explicit `loose-mode-removed` disclosure when the
source is loose, even when its current edges happen to fit strict mode. No file is
written, no port is rewritten and no current consent or Apply authority is granted.
The host must review future-authoring loss before explicitly saving that snapshot.

## Boundary and staged scope

Boundary verdict: safe with noted risk. Core owns mode/storage/structural decisions;
port-pair compatibility is distinct from duplicates, current lifecycle, per-port and
whole-edge policy, semantic conventions and edit authorization. This first slice
adds no loose editor initializer, creation/reconnection commit, gesture/chooser UI,
mode-changing event or Undo transaction. Existing strict editing remains qualified
by its regression suite. It is unsafe to unwrap a loose-only graph into legacy APIs;
those validators still reject it. No editor support is implied by shared data types.

Model/edition/archive, receipt, patch, layout, Mermaid/CLI and browser entry adoption
need explicit follow-up contracts; no v2 decoding support is added to them. Do not
unwrap v2 data into those APIs expecting mode preservation. In particular a
standalone v2 snapshot is not a version bump to all existing format-v1 archives.
No live edit means no new v2 Undo claim. One-Undo and live policy/lifecycle tests
become mandatory when editing is adopted; the matrix alone is not permission.
No new dependency, UI, default loosening, provider, release or deployment.

## Evidence and recovery

Use independent strict-v1 and loose-v2 literals; test all four kind combinations in
both modes, missing/unknown cases, strict defaults, envelope/camera/identity checks,
geometry/data/order/self/reverse/nesting preservation, freezing and serializer
validation. Exercise blocked and disclosed downgrades without source mutation.
Qualify current packed Node/Bun/TypeScript consumers and actual pinned pre-mode
source readers, including old-code rejection of v2 and unchanged v1 editing/Undo.
Run required repository checks and API docs. Recovery is retain source and decline
downgrade; no user model migration or working-editor mutation is performed.

Next: adopt the mode in a package-owned headless editor creation/reconnection path,
with explicit initializer/commit/source/history and portability boundaries, live
policy/lifecycle checks and one Undo. Native/custom controls follow that contract.
C1 remains partial until those paths and the agreed compatibility criteria close.
