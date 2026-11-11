# Atomic DDD Apply and portable provenance — local qualification, 2026-11-11

result: complete

claim: The package stages and checks live EventStorming-to-DDD conversion, commits
all descriptor changes as one graph Undo step and returns an immutable portable
receipt retaining the complete before/after documents and reviewed mappings.

evidence: Ten focused tests, real packed root consumers and sequential workspace
qualification described below. Final root check/typecheck/test and API docs exited 0.

remaining uncertainty: Headless local evidence only. Host supplies current model/
session identity and external busy conditions and owns physical persistence. Pure
policy callbacks are required. Receipts are unsigned data, not proof of execution,
human acceptance or authorization. No workbench Apply control, hosted qualification,
performance claim, publication or deployment. Review roles are self-review.

next: needs review; then wire guarded Apply and receipt retention/download into the
workbench, publishing editor and receipt together in one Foldkit update.

## Scope and retention decision

Continued from `09e9fbc` in isolated `codex/zloz-context-map`. See
[ADR 0045](../../../docs/adr/0045-apply-ddd-conversion-atomically-with-portable-provenance.md).
No runtime dependency or existing graph/model/edition format changed.

`applyEventStormingDddConversion` rebuilds the plan/consent against current source
input and checks its revision, graph and required camera against live EditorState.
It rejects read-only, gestures, pending connections, label drafts, camera fits,
host busy state, unresolved mappings, missing/stale consent and disabled Undo.
No-op returns editor identity with no receipt. Expected denials preserve the entire
editor and redo branch; malformed input/policy exceptions throw without publication.

The complete target is validated before policy checks. Whole-transaction policy sees
the full frozen plan/target. Granular architecture hooks retain current-graph semantics
on detached frozen source/target values. A strict source-oriented semantic policy
can conservatively veto conversion; the bulk hook does not override granular vetoes.
All preflight succeeds before one `commitGraph` call. Camera, surviving selection,
IDs, geometry, ports, wiring, labels, appearance and host data remain intact.

Applied results include editor plus an immutable conversion receipt. The receipt
pins full source document/session/revision, effective mappings, loss-acceptance claim
and converted document. Fork origin and existing editions stay unchanged. Independent
`foldkit-zloz-ddd-conversion` v1 codecs validate source/mappings and reconstruct the
expected descriptor-only target before accepting imported receipt data. Parsing is
never an executor or permission grant. Persist/export the entire receipt to retain
provenance; model-only export omits conversion receipts. Graph Undo does not delete
a historical receipt. Commands/adapters own physical storage, not this pure API.

## Tests and review

The initial test failed because the public Apply API did not exist. Ten focused
behavior tests now verify:

- Two node and two edge replacements commit once; all return together through
  Undo/Redo. Revision increments once and the prior redo branch clears.
- Full source identity, graph/camera, host data, editions and fork ancestry are pinned;
  target model metadata and nonsemantic node/edge fields remain unchanged.
- Late node/edge and whole-transaction vetoes, including blank reasons, leave exact
  editor/Undo/redo identity intact and expose no partial receipt.
- Bulk policy observes all final meanings; granular hooks observe current source
  semantics and detached frozen values for every changed node/edge.
- Lifecycle, Undo, revision/live graph/camera, identity/session/metadata and consent
  protections; explicit retention no-op and old Apply rejection after success/Undo.
- Complete before/after documents round-trip through receipt and legacy model codecs.
- Literal unsupported receipt versions/malformed JSON, unknown fields, false loss
  acknowledgement, invalid sources/mappings, altered conventions and forged extra
  target edits reject. Serializing inconsistent typed receipts also rejects.
- Malformed input and throwing pure policies preserve the original editor byte values.

A first fixture used an unsupported `bezier` path-style spelling and an extra drag
field; validation/typechecking caught them. Fixtures now use public straight-path
and drag contracts. Lint identified unknown helper parameters at the receipt boundary;
record guards now establish JSON-domain input before decoding. No rule was suppressed
for these helpers. The JSON syntax catch is the repo's documented dependency-free
codec exception, scoped to the native parse boundary.

Packed Node/Bun consumers exercise actual installed Apply and receipt exports, one
Undo and source retention. Bundler/NodeNext fixtures require an explicit consent field.
Architecture, delivery and test-quality reviews are self-review. Boundary verdict:
**safe with noted risk**. No claim of external storage atomicity or receipt authenticity.

## Final verification

Host-captured results against this isolated worktree:

- Baseline `bun typecheck` and `bun run check`: exit 0 before edits.
- `bun test packages/foldkit-zloz/test/event-storming-ddd-apply.test.ts`: 10 pass,
  0 fail, 144 assertions.
- `bun run --filter @opsydyn/foldkit-zloz typecheck`: exit 0.
- Final sequential `bun run check`, `bun typecheck`, `bun run test`: all exit 0.
  Zloz core: 399 pass, 0 fail, including real packed Node/Bun consumers and
  Bundler/NodeNext types. Existing warnings and skipped tests remain elsewhere.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0; the Apply and receipt
  exports appear in generated API documentation.
- Final evidence formatting followed by another root check and `git diff --check`:
  exit 0.

Final workspace checks, tests and docs ran sequentially after the last source change.
No browser qualification is claimed for this headless package slice. No publishing,
push, PR, merge, deployment or external storage write was performed.
