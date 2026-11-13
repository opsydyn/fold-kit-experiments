# ADR 0062: Complete reviewed patch CLI and atomic Apply

## Status and scope

Accepted for the user's consolidated P2 completion request, 2026-11-13. Extends
ADRs 0060/0061. Architecture/boundary, delivery and test-quality reviews are
self-review, safe with noted risk. Complete the current P2 chain in one local
slice: CLI dry run, package review/consent/Apply controls and workbench guarded
review with retained/downloadable provenance. No npm publication, deployment,
PNG rasterizer, Alchemy activation or claim of full React Flow parity.

## Decision

Keep proposal decoding and dry run in core. Add package-owned review resolution
and native/composable Foldkit controls. Review binds acknowledgement of changes
and losses to the complete canonical proposal and prospective graph. A matching
patch ID alone is insufficient. Live source, editor lifecycle and policies are
recomputed on Apply; imported dry-run output/receipts never grant authority.

Apply accepts the current editor plus host model/session identity and a proposal.
Build the current source from the editor's actual graph/revision. Re-run dry run,
check read-only/busy/Undo/revision capacity, live host blocking reason and review
policies, and require exact-content acknowledgement for changed proposals.
Evaluate existing EditorPolicy mutation hooks for semantic/appearance/waypoint,
movement/resize, port addition/removal/label/position, reconnection/connection/port
and complete deletion changes. Port kind changes require remove/add review; side and anchor changes require position review;
port order changes require position protection. Whole-patch/per-change review
hooks cover other authored fields (label/data/membership/path style/extensions).
Selection/snap callbacks are interaction preferences, not patch mutation authority.
Connection checks use the validated target graph and exclude the proposed edge
itself; reconnection locks use the frozen source graph. Granular preexisting-edit
hooks use source values/graph; newly added ports/nodes are checked against the
validated target graph. Pure callbacks receive frozen copies.

A denied/invalid/stale proposal returns the unchanged original editor; no partial
commit, selection update or history mutation. No-op returns unchanged without a
receipt. Success commits the complete graph once and returns editor plus a frozen
unsigned receipt containing the exact proposal/source/provenance, target graph,
resulting revision and explicit reviewed/loss acknowledgement. Host publishes
editor and receipt together synchronously. One Undo restores the whole source;
Redo restores target. Receipt retention is independent of Undo and is not an
Apply capability. Receipt readback is outside P2's required Apply criterion.

The Effect CLI adds `patch dry-run --input <patch|-> --source <model> --session <id>
--revision <n>`. Source must be a canonical model document, separately read; model
ID comes from that document. Never infer the live source from the patch. Only
one input may consume stdin. Existing bounded 1 MiB fatal UTF-8 IO and injectable
platform services remain authoritative. Emit protocol v1 additive operation
`patch-dry-run` with the full preview as data. Exit 0 for reviewable proposals,
including disclosed losses/no-op; exit 1 for structurally decoded but stale/invalid
proposals; exit 2 for decode/IO/invocation errors. No file writes or CLI Apply.

Workbench adds a left-sidebar Patch review section using package controls. Native
File IO is a bounded fatal UTF-8 Command with model/session/read tickets; stale,
cancelled, protected and failed reads preserve the last accepted proposal. A local
starter creates a proposal from the live model, not a hidden reset or imported
permission. The original canvas stays visible. Review exposes source/provenance,
changes/losses/findings and expandable before/after data; explicit acknowledgement
and Apply are separate actions. Apply is guarded again by active section, lifecycle,
model identity/revision and current editing policies. The host retains and downloads
the receipt with editor publication. Theme/minimal preferences hide presentation
counts/instructions independently of functional findings and actions.

## Alternatives and consequences

Replaying editor events could silently ignore denied operations and create multiple
Undo entries. Committing a cached graph would bypass changed source/policy/consent.
A single rebuilt transaction reuses graph invariants and explicit mutation hooks.
Costs include synchronous bounded validation, potentially large content keys and
receipts, conservative loss reports and a deliberately inspect-only CLI.

P2's local functional closure is not the entire dated core audit: D1–D2/C1–C4
compatibility decisions and Q1–Q4 qualification remain explicitly tracked. This
bundle removes the current P2 dependency chain so PNG can be the next functional
work; Alchemy remains a separate integration decision without provider activation.

## Verification

Test Apply freshness, exact acknowledgement, every mutation-policy family,
read-only/busy/no-Undo, no-op, all-or-nothing publication, one Undo/Redo and receipt
retention. Test native/custom/minimal controls and stale requests. Test Effect CLI
file/stdin, separate source, decode errors and exit status, plus actual installed
Node/Bun consumers. Test workbench read races, protection, failed reads, receipt
and editor atomicity. Build and capture Chromium light/dark/minimal, failed reads,
protected Apply and Undo. Run root lint/format, typecheck, all workspace tests,
TypeDoc and production build sequentially for shared dist. Rollback before
publication is a local revert; no existing model wire migration is introduced.
