# ADR 0104: Adopt native v2 authoring and review as one batch

## Status

Accepted for the approved native v2 audit/patch/conversion-receipt/review-packet
batch, 2026-11-15. Follows [ADR 0103](0103-qualify-v2-portable-adapter-boundaries.md).
Architecture, delivery and test-quality reviews are self-review.

## Contract and boundary

Complete the native package and CLI paths identified in ADR 0103 without
projecting loose graphs into v1 contracts. Preserve explicit source/checkpoint
modes, ordered port identities, provenance, live policies, loss acknowledgement
and atomic Undo. Validate portable evidence by recomputing its result before
read-only reopening. Keep old readers fixed at v1 and add explicit v2 entries.
No npm publishing, deployment, PR or workbench UI migration is included.

Core owns canonical values, domain meaning, review identity and editor transactions.
Mermaid composes selected snapshots, audits and projections. CLI owns bounded
UTF-8 I/O and protocol/exit selection; it performs no Apply. Hosts own session
identity, current model binding, persistence and publishing editor/receipt together.
Reports, content keys, actor declarations and imported receipts are never authority.

## Audit semantics

Add explicit connection-document audits and model comparison entries. Validate the
complete v2 document/model; each selected checkpoint uses its own mode. Reuse the
existing DDD and EventStorming domain rules and finding delta logic. Port kind is
structural connection eligibility, not a DDD side role or causal meaning. V2
comparison sides include their modes; a mode-only change does not invent an audit
finding. Validate catalogues even before returning unavailable-selector decisions.
Legacy DDD graph validation stays strict; existing EventStorming graph audit keeps
its documented caller-owned structural validation boundary.

## Modelling patches and receipts

`foldkit-zloz-patch` v2 adds required `connectionMode` to the exact model/session/
revision/graph source. Keep the six explicit add/replace/remove operations and
existing provenance/loss conventions. Mode is pinned source context; patches do
not infer or change it, manufacture ports or silently rewrite endpoints. Source
mode changes invalidate dry run/review even when both graphs are strict-compatible.
Own source data before reading mode, including rejecting accessors without running
them. Shared operation and policy engines serve both versions through fixed
version-specific capture wrappers.

Native Apply requires a v2 model session, exact live source/revision, editable/idle
state, enabled Undo, safe revision capacity, live granular/whole review policies
and matching affirmative review/loss consent. Policy callbacks receive frozen
validated values. Rebuild every check on Apply; return editor and receipt together
in one synchronous transaction. No-op and rejection retain working data. Full
mode-aware history preserves graph and mode through Undo/Redo.

`foldkit-zloz-patch-receipt` v2 retains the proposal, explicit mode-aware result
snapshot, next revision and recorded acknowledgement. It is graph-patch evidence,
not a whole-model archive or camera history. Reopening recomputes the proposal from
its captured source and verifies graph, unchanged mode, next safe revision and
recorded flags. It creates no live consent. Receipt formats remain distinct from
patch proposals; v1 proposal readers reject v2.

## Workshop conversions

Add explicit v2 preview, plan, consent and Apply entries for C4 and DDD. Reuse the
existing mapping, containment, disclosure and policy engines behind version-fixed
capture wrappers. Public generic types default to legacy v1; named v2 aliases make
consumer contracts explicit. Canonical v2 capture validates source, editions and
origin in their own modes. Do not alter endpoint kinds or infer containment.

Both conversion receipts keep their format names and use version 2, with complete
v2 source and target models. Apply checks graph, camera, mode, revision, v2 session,
lifecycle, policies, revision capacity and exact current loss consent. Preserve
archive/origin checkpoint modes and camera. One Undo reverses the complete graph
change without changing its mode.

Reopening strictly checks the declared version, options/choices, recorded acceptance
and complete target by rebuilding the plan and projection. Bound raw text and scan
depth/value counts and duplicate keys before domain decoding; own object inputs
before schema checks. Normalize syntax/scanner errors to the core error contract.
Check generated native receipts against reopening budgets before publication and
serialization. V1 wrappers/decoders retain their version and reject v2 envelopes.

## Portable review packets

`foldkit-zloz-review` v2 retains only the chosen baseline and selected/current v2
snapshots, complete per-snapshot modes, data-only conventions, mode-aware audit
comparison, v2 Mermaid bundles and loss findings. The role interpretation remains
`zloz-event-storming/v1`: domain rules have not changed with port eligibility.
The scope remains selected snapshots, not a full model/ancestry archive.

Use shared bounded scanning, strict side/identity checks and deterministic
recomputation for both packet versions. V1 readers remain fixed at v1. V2 creation
checks the default decoder budgets before returning success; CLI creation also
checks its stricter 1 MiB UTF-8 reopening budget. `report` accepts projection
omissions, never inconsistent evidence or malformed input. Opening either side
creates a new read-only checkpoint review with zero Undo, independently of working
history. No imported packet becomes an editor transaction or persistence command.

## Effect CLI and version selection

Explicitly select v1/v2 operations from validated canonical input, never port-kind
inference. Audit, edition comparison, patch dry run and packet creation/inspection
now support native v2. A proposal version must match its separately supplied source;
wrong versions cannot bypass dry run. Keep raw patch/packet text until the strict
bounded decoder has checked duplicate keys and depth.

C4 receipt inspection accepts v1/v2. Add read-only `ddd receipt inspect` (v1/v2)
and `patch receipt inspect` (v2). Receipt header classification uses bounded text
and native JSON syntax parsing; recursive domain decoding follows the strict raw
receipt reader. No generic recursive JSON schema precedes the v2 depth scanner.
Return structured evidence with explicit read-only authority, including recomputed
DDD/patch changes and loss findings alongside their complete receipts. Unsupported receipt
format/version exits 1; malformed/inconsistent input exits 2. Audits/regressions or
rejected projection/Apply previews retain their documented exit 1 behavior.
`readDocument`/`readGraph` stay v1-only embedding seams; `readPortableDocument` owns
the discriminated versioned document boundary. No CLI Apply command is introduced.

## Alternatives and review

Verdict: **safe with noted risk**. Reusing validated engines avoids divergent
policy/mapping logic. Reject silent mode erasure, port rewriting, widening old
readers, cached permission/consent, and independent copies of the conversion
engines. Parameterized internal captures keep default public v1 behavior; native
wrappers bind concrete model and wire versions. Mode remains a source invariant,
not a general patch operation in this batch.

Costs: more explicit versioned APIs and fixtures, extra bounded recomputation on
receipt/packet reopening, and host responsibility to keep source sessions/current
revision truthful. Decoder validation proves consistency, not authorship or trust.
Native workbench controls/file flows still need a mounted adoption slice; headless
and CLI completion does not establish full C1 parity or C2–C4/Q/R closure.

## Implementation and evidence

Core: shared audit delta/patch/conversion internals, fixed v1 wrappers, native v2
entry points and strict evidence codecs. Mermaid: v2 packet creation, shared strict
parser and read-only opening. CLI: version selection, bounded receipt readers,
structured inspection and explicit exits. No dependency or manifest change.

Tests cover literal v2 wire records, actual loose input-to-input connections,
old-reader rejection, source-mode freshness, live port protection, policy/consent,
atomic Undo, forged flags/results, duplicate/deep/oversized input, packet budgets,
read-only review independence and installed Node/Bun consumers. Run repository
lint/format, typecheck, full tests and API docs. See
[qualification](../../packages/foldkit-zloz/evidence/native-authoring-review-v2.md).

Next: one mounted native v2 authoring/review workbench slice using these APIs, with
visible loss review, receipt/packet downloads and read-only reopening evidence.

## Approved mounted adoption follow-through — 2026-11-15

The subsequent approved host slice extends `/history/`, which already owns a
canonical v2 model, mixed-mode archive and independent working Undo. It adds
Authoring and Portable review sections rather than widening the separate legacy
architecture workspace or projecting loose graphs into v1 controls.

A browser Command issues a fresh random page-session ID before authoring; the
model owns it. Source identity combines that ID with model identity and canvas
epoch, so reloading a page cannot reuse an old proposal incarnation. Failed
initialization has an explicit retry; late successful callbacks cannot rebind it.

Core retains proposal decoding, audit semantics, exact review keys, live policy
checks, atomic Apply and receipt validation. Mermaid retains packet construction
and strict reopening. The host binds model ID, session epoch and revision, owns
bounded UTF-8 file Commands and scoped downloads, and publishes the returned editor
and receipt together in one update. Imported patch/C4/DDD receipts and packets
create detached read-only before/after editors with ghosts; they never grant live
consent or replace the working model. Canvas epochs reject late events, and token,
epoch and revision checks reject cancelled or stale file completions. Changing
sections cancels reads and clears local Apply acknowledgement. Leaving an artifact
review restores the working canvas and its existing Undo.

Both reviewed-content and authored-loss acknowledgement are required for patches.
Packet projection losses need separate consent bound to the source and baseline.
The host limits reads and generated downloads to 1 MiB so it cannot produce an
artifact its own file controls refuse. Failures preserve the working editor and
retained receipts. Theme and Minimal preferences remain host-controlled; essential
loss and protection reasons remain visible. No parser, dependency, runtime,
protocol or public package API changes are introduced.

Implementation: `apps/zloz-demo/src/history-workbench/native-*`, composed by the
existing message/state/view. Regression tests cover stale mode/session/revision,
protection, incomplete consent, single Undo, retained receipts, invalid/oversized
UTF-8, strict conversion/packet decoding and detached reopening. Mounted evidence
uses real model upload, downloads and file reopening in both themes and at 390px.
See [qualification](../../apps/zloz-demo/evidence/native-authoring-workbench.md).
C4/DDD conversion authoring remains in the existing architecture workspace; this
slice adopts their native v2 receipt readers, not new conversion Apply controls.
C2–C4, broader C1 adoption, physical-device/manual AT and release gates remain open.
No publishing or deployment is included. Architecture, boundary and test review
are self-review: safe with noted risk at the host's session/file lifecycle boundary.
