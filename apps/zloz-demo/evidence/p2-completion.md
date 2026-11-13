# P2 reviewed modelling-patch completion — local qualification, 2026-11-13

- **result:** complete
- **claim:** the remaining P2 chain is implemented across public package APIs, Effect CLI and workbench: separate-source dry run, exact-content acknowledgement, live policy-aware atomic Apply, one Undo and retained/downloadable provenance.
- **evidence:** core/CLI/workbench tests, installed Node/Bun consumers, native/custom SSR controls, real CLI JSON, production build and Chromium light/dark/minimal interaction/download captures; commands and artifacts below.
- **remaining uncertainty:** local functional qualification only; broader D1–D2/C1–C4 and Q1–Q4 audit rows remain tracked. No universal parity/performance, manual AT/device, hosted/CI, npm publication, durable persistence, receipt import, PNG or Alchemy implementation is claimed.
- **next:** needs review; move to package-owned PNG export, then separately scope the Alchemy integration boundary, following the user's updated priority.

## Completion and ownership

[ADR 0062](../../../docs/adr/0062-complete-reviewed-patch-cli-and-atomic-apply.md)
completes the P2 workflow built on strict proposal/dry-run and decoder contracts.
Source base is `06a6c01`; this receipt is committed with the implementation and
final captures in the isolated `codex/zloz-context-map` worktree. The main checkout
was not modified. Architecture/boundary, delivery and test-quality review are
**self-review**, verdict **safe with noted risk**. No independent review is claimed.

Core owns `resolveModellingPatchReview`, `resolveModellingPatchAcknowledgement`
and `applyModellingPatch`. It derives current graph/revision from the actual editor
and model/session identity from the host, never the proposal. Exact canonical
proposal/source/provenance/target content binds acknowledgement. Live dry run,
read-only/busy/Undo/revision checks and granular editing/review policies are rebuilt
on Apply. Changed or denied content returns the original editor by reference.
No-op returns unchanged without a receipt. Success commits once and returns the
editor plus frozen `foldkit-zloz-patch-receipt` v1. Host publishes both in one
synchronous Model update. One Undo/Redo restores the complete source/target;
retained provenance is independent of Undo and cannot authorize a later Apply.

Mutation protection covers node meaning/outline/movement/membership/size, ports,
edge meaning/waypoints, connection/port/reconnection and complete deletion, with
whole-patch/per-change hooks for other authored fields. New connections inspect
the validated target, excluding the proposed edge. A target-only reconnection
retains the unchanged source endpoint's existing-connection semantics. Policy
arguments are frozen, including the custom connection graph. Selection and snapping
remain interaction preferences rather than mutation permissions.

The optional Foldkit entry supplies native review/acknowledgement/Apply helpers,
nullable summary/finding/change slots, custom layouts/actions/attributes and numeric/
instruction visibility. Core remains dependency-free; no new dependency or lint
configuration was introduced. The workbench owns file/download Commands, current
identity, lifecycle guards and receipt retention. It demonstrates a live-source
proposal starter, strict bounded file read, source/provenance, expandable before/
after, custom change cards, live protection, explicit acknowledgement, actual Apply,
Undo and artifact downloads in the left sidebar. The working canvas stays visible.
Hidden/collapsed patch controls skip expensive preview construction.

File reads are scoped by model incarnation and monotonic run, bounded to 1 MiB
before/after bytes and fatal UTF-8. Cancellation, failed/late/foreign reads and
working-source changes preserve the accepted proposal. Completion still clears
pending state when another read-only review becomes active. Source budget failures
are handled as readable proposal errors with the last proposal/editor retained.
There is no automatic persistence or downloaded-receipt import in this contract.

## CLI evidence

The Effect `patch dry-run` command uses a separately supplied canonical model,
current session and revision. Only one input may consume stdin. Existing bounded
fatal UTF-8 IO and platform injection are reused; strict proposal text is decoded
before any generic JSON parse. Protocol v1 adds `patch-dry-run` / `reviewed` with the
full preview and path-preserving diagnostics. Exit 0 is reviewable (including
losses/no-op), 1 is an incompatible/stale decoded proposal, and 2 is decode/IO/flags.
There is no CLI Apply, file mutation or writable-agent execution.

[Real command output](../../../packages/foldkit-zloz-cli/evidence/patch-dry-run.json) ·
[Separate current-model fixture](../../../packages/foldkit-zloz-cli/evidence/patch-source.model.json) ·
[Fixture generator](../../../packages/foldkit-zloz-cli/evidence/patch-fixture.ts).

```sh
bun packages/foldkit-zloz-cli/src/bin.ts patch dry-run \
  --input packages/foldkit-zloz/test/fixtures/modelling-patch-v1.json \
  --source packages/foldkit-zloz-cli/evidence/patch-source.model.json \
  --session commerce/session-1 --revision 7
```

The captured command exited 0 with one JSON response and empty stderr. It names
Commerce's bounded-context label change, exact target, unsigned provenance and
label loss. Installed Node/Bun commands additionally check stale exit 1 and invalid
UTF-8 exit 2. Source-file bytes remain unchanged in command tests.

## Verification

- Baseline root `bun typecheck` and `bun run check`: exit 0.
- Root `bun typecheck`: exit 0; final workbench suite includes its no-emit typecheck
  after recovery/routing/layout updates. Existing hints/warnings remain.
- Root `bun run test`: all suites exit 0, including **512 core**, **22 CLI** and
  **112 workbench** tests. The subsequent complete workbench suite passes **113**
  after adding the oversized-current-source recovery case. Final focused core/
  view/workbench checks also pass. Existing unrelated skipped tests remain skipped.
- Root `bun run check`: lint/format/catalog/skills exit 0. Pure nullable host-view
  absence has a narrow documented lint exception; no global rules were relaxed.
- `bun run --filter @opsydyn/foldkit-zloz docs`: strict public TypeDoc exit 0.
- `bun run --filter @opsydyn/zloz-demo build`: final production build exit 0.
- Installed core consumer: actual npm tarball, Bundler/NodeNext and Node/Bun,
  content review, atomic Apply/receipt, one Undo and optional view export.
- Tests cover multi-operation atomic commit, source/content/session freshness,
  read-only/busy/no-Undo, policy families including blank denials, frozen callback
  graphs, target-only reconnection, whole-patch veto, no-op, provenance, stale
  acknowledgements/read callbacks, cancellation/failed files and unchanged editors.
- Native/custom/minimal SSR controls retain explicit acknowledgement, findings,
  live protection and disabled actions. Additional package/CLI input/codec suites
  remain green; no existing wire format was replaced.

The initial red run failed for missing Apply exports. Early tests used an invalid
DDD aggregate/outline fixture; corrected valid descriptors then exercised the
intended policies. Type/lint checks drove the native children contract, named Effect
read/decode steps and partial Match-based host routing. A browser assertion first
compared different DOM text APIs after Undo; it now checks the restored label input.
No source/policy/consent guard was weakened. Self-review fixed frozen connection
callback arguments, unchanged-end reconnection semantics, overlay read completion
and bounded-source recovery before final qualification.

## Visual and interaction evidence

```sh
node apps/zloz-demo/evidence/patch-apply-browser.mjs
```

Chromium **151.0.7922.34**, 1600×1100, reduced motion. The script verifies keyboard
Space acknowledgement, protected Apply, invalid-file retention, actual proposal
and receipt downloads, successful atomic Apply, one Undo and retained receipt.
Minimal mode hides numeric/instruction readouts while loss findings and actions
remain. Canvas width/position stay beside the left sidebar; no page errors.

[Light native review](patch-apply-light.png) ·
[Dark custom/protected review](patch-apply-dark-protected.png) ·
[Minimal review after Undo](patch-apply-minimal.png) ·
[Actual downloaded receipt](patch-applied-receipt.json) ·
[Reproducible browser script](patch-apply-browser.mjs).

Captures were visually inspected for shared neutral/blue themes, readable stacked
controls, visible change/protection/loss disclosure, acknowledgement/action state,
custom cards and the uninterrupted working canvas. This is synthetic local browser
qualification, not manual screen-reader, hardware touch or hosted acceptance.
The broader audit rows remain open; this closes P2's local functional dependency
chain and updates next-track sequencing to PNG, then Alchemy review.
Recommendation: **needs review**.
