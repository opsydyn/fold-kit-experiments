# Plan provenance and loss acknowledgement — local qualification, 2026-11-11

result: complete

claim: Mapping review composes the package conversion-plan/consent API to show
source provenance, blockers and all prospective losses, with explicit temporary
exact-plan acknowledgement. There is no Apply control or source-model edit.

evidence: Five new controller/SSR tests, production workbench build and Chromium
checks with inspected light/dark captures. Final root check/typecheck/test commands exited 0.

remaining uncertainty: Local workbench evidence only, not hosted or comprehensive
assistive-technology acceptance. No provenance storage schema, Apply transaction,
authenticated human approval, publishing or deployment. Reviews are self-review.

next: needs review; then define provenance retention and implement package-level
atomic Apply with live freshness/policy/lifecycle/consent checks and one Undo,
before adding a workbench Apply control.

## Scope and boundaries

Continued from `bdba109` in isolated `codex/zloz-context-map`.
See [ADR 0044](../../../docs/adr/0044-review-plan-provenance-and-losses-in-workbench.md).
The workbench calls `resolveEventStormingDddConversionConsent` with the displayed
source document, host namespace/model epoch/historical identity and editor revision.
The package owns provenance, blockers and losses. The UI stores only review choices,
temporary consent and callback generation in Foldkit Model state.

The Conversion plan review disclosure shows model/snapshot/fork ancestry, optional
source identifiers, package blockers and the complete loss list before the native
all-loss checkbox. History and busy states remain inspectable while acknowledgement
is disabled with visible/accessible reasons. Blocked and unchanged plans cannot
record loss acknowledgement. Source canvas, graph, Undo, origin and authoritative
exports remain untouched. Plan keys stay in transient state/callbacks, not DOM.

Recompute package review before accepting a callback. Source/model/session/revision,
camera, metadata/editions/ancestry, mapping/reset and busy-state changes invalidate
consent. A host generation prevents pre-withdrawal or pre-change callbacks from
restoring old acknowledgement after exact source values return. Native unchecking
withdraws acceptance. Inspection, theme and diagnostic preferences preserve valid
consent. Minimal/global diagnostics suppress optional counts while functional
provenance/loss/protection content remains available.

## Tests and review

The initial tests failed against missing workbench consent fields/handlers. Five
new controller/SSR tests then qualified:

- Blocked plans reject acceptance; reviewable plans expose full package provenance
  and record exact-plan consent without editing source, editions, lineage or Undo.
- Withdrawal and camera change-and-revert reject older checked callbacks, even
  when the package key returns to its original value.
- Mapping/reset, archive capture, historical inspection and identical source
  reopening clear acceptance. Historical snapshot provenance remains inspectable.
- Old plan keys/generations/model/epoch, hidden panels and busy import cannot accept.
- Native checkbox/checked/disabled/described-by semantics, preserved functional
  content in minimal mode and absence of serialized plan keys in rendered output.

Architecture, delivery and test-quality reviews are self-review. Boundary verdict:
**safe with noted risk**. This records review of an exact plan, not edit permission
or proof of a human actor. Tests cannot qualify the unimplemented Apply/storage
boundary. Full-document recomputation is not a large-model performance claim.

## Browser evidence

After the completed production build:

```sh
node apps/zloz-demo/evidence/mapping-plan-browser.mjs
```

Passed on Chromium **151.0.7922.34**, 1600×1200, reduced motion; no page errors.
Source: [browser fixture](mapping-plan-browser.mjs).

The browser uses the actual edition/fork workflow to create **Orders DDD review**
from **Working model · Discovery workshop**, then resolves uncertain mappings by
explicit retention. It verifies blocked reasons, both prospective losses, native
Space acknowledgement/withdrawal, camera/choice/archive invalidation, preference
independence, history protection, no Apply button and unchanged authoritative data.
The initial model export after acknowledgement equals the pre-acknowledgement model.
Later exports retain graph, editions and origin; the intentional camera change is
checked separately. Undo was checked as unavailable after acknowledgement.

An early fixture issued a dependent choice before the newly inspected item had
rendered, leaving the plan correctly blocked. The fixture now waits for the
selected item's heading and for acknowledged status before dependent actions;
no production protection was relaxed.

[Light provenance/loss review](mapping-plan-light.png) ·
[Dark acknowledged plan](mapping-plan-dark.png).
Both were visually inspected: readable source and fork ancestry, complete two-loss
list and acknowledgement beside the original canvas, in the shared family themes.
The sidebar scrolls independently; no review overlay obscures the diagram.

## Final verification

Host-captured qualification against this isolated worktree:

- Baseline `bun typecheck` and `bun run check`: exit 0 before edits.
- `bun run --filter @opsydyn/zloz-demo test`: 77 pass, 0 fail (five new tests).
- `bun run --filter @opsydyn/zloz-demo build`: exit 0.
- `node apps/zloz-demo/evidence/mapping-plan-browser.mjs`: passed, no page errors.
- Final sequential `bun run check`, `bun typecheck`, `bun run test`: all exit 0,
  after the completed production build/browser run. Zloz core: 389 pass, 0 fail;
  demo: 77 pass, 0 fail. Existing/advisory warnings and skipped tests remain.
- Final evidence formatting followed by another root check and `git diff --check`:
  exit 0.

No public package API, persistence codec or dependency was changed. No publishing,
push, PR, merge or deployment was performed.
