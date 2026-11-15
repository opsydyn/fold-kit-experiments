# C4 placement and exact-plan acknowledgement — local qualification

- result: complete
- claim: the workbench composes package-owned C4 placement decisions, blockers, current provenance and exact-plan loss acknowledgement while preserving the source model and Undo; no Apply is exposed.
- evidence: full workspace typecheck/tests passed; final affected-app compile/tests passed (151 tests, including ten new plan-review tests). Production build and Chromium keyboard/light-dark/history flow passed with zero page errors and exact source/lineage equality. Removing the generation guard caused four tests to fail.
- remaining uncertainty: local Chromium/SSR evidence does not establish manual screen-reader, physical-device, other-browser, performance or hosted qualification. Guarded atomic Apply, receipts, UI publication, broader D1b/C/Q/R closure and npm publishing are separate. No deployment.
- next: implement package-level atomic C4 Apply with live source/session/revision, policy/lifecycle, containment and exact consent checks, one Undo and retained provenance.

## Contract

[ADR 0087](../../../docs/adr/0087-review-c4-placement-and-exact-losses.md) keeps
planning in the left sidebar and preserves the canvas. The package supplies the
required members, local compatibility rules, blockers, complete provenance and
exact losses. The host owns selected members, staged placement fields and explicit
acknowledgement; it does not implement a second containment engine.

Every placement is explicitly reviewed. A contained choice starts without a
parent; existing group options are candidates, not inferred owners. Package
incompatibility reasons stay visible. Draft changes revoke that choice and
acknowledgement; obsolete member choices are pruned when mappings change and cannot
silently return later. Clear/Reset remain reversible review controls.

Acknowledgement binds current model/epoch/graph/revision/edition scope, the complete
plan key and a monotonic host generation. Uncheck withdraws it. Camera, source,
choices or protection changes withdraw review even if an older exact key later
returns. Hidden/reopened sidebar generations reject old callbacks without erasing
still-valid affirmative review. Historical/busy/read-only contexts protect edits and
acknowledgement. Reconciliation wraps every update result, including early-return
reader/import paths, while preserving existing commands and editor identity.

Provenance, placement/blocker/loss reasons and acknowledgement are semantic content,
independent of numeric diagnostics. Technical IDs remain optional. Stable keyed
native controls, rendered target/status feedback and associated descriptions
support keyboard review. The raw source-containing key is callback data, never a
DOM key or readout. Mapping-preview findings are explicitly distinguished from the
exact conversion plan losses used for acknowledgement. An empty mapping-blocker
list says there are no unresolved mapping choices.

## Verification

```sh
bun typecheck
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/c4-plan-browser.mjs
bun run --filter @opsydyn/zloz-demo test
bun run check
```

Ten focused tests cover required placement before consent, staged Review,
package-owned losses, no editor commands/graph/Undo/edition mutation, explicit
acknowledgement/revocation, camera A→B→A, hidden/collapsed/foreign/generation guards,
choice pruning, incompatible containment, historical/busy protection, semantic
Minimal mode and absence of raw keys/Apply. An actual read-only Domain review
open/close path verifies generation reconciliation through early returns. A lane
interpretation requires every member and resolves only after explicit compatible
containment or root decisions.

The production script checks an initially disabled acknowledgement, no inferred
parent, a visible package incompatibility, Enter placement Review with retained
focus, Space acknowledgement/withdrawal, draft revocation before a new Review,
root-membership loss, light/dark views and no Apply action. Model/lineage exports
match before explicit edition capture. Historical review is protected, returning
to present preserves the working graph and Minimal mode retains provenance and
acknowledgement. Native disclosure panels are explicitly reopened after navigation.

A temporary removal of the generation check caused **four tests to fail**;
restoring it returned all ten to green. The first behavioural test reproduced the
absence of plan status in the earlier mapping-only context. Initial static checking
caught a test helper inferred too narrowly as one sidebar literal; it was annotated
with the existing Model type, without casts. Browser development attempts used an
old status string and assumed native details stayed open after remount; the script
was corrected to use current human-readable status and explicit disclosure readiness.
Those attempts are not passing evidence or diagnosed runtime defects.

Architecture, boundary, delivery and test-quality reviews are **self-review**.
No new dependency, public package API, canonical schema, version or persistence.
Full workspace checks were followed by affected-app checks after final view wording
and key refinements. Existing configured warnings/skips remain; no warning-free
claim, deployment or registry action is made.

## Artifacts

- [Light plan review](c4-plan-light.png) and [dark plan review](c4-plan-dark.png).
- [Light exact losses/acknowledgement](c4-plan-losses-light.png) and [dark exact losses/acknowledgement](c4-plan-losses-dark.png).
- [Production interaction script](c4-plan-browser.mjs) and [result](c4-plan-result.json).

Recommendation: **needs review**. The approved workbench review/acknowledgement slice
is complete. Acknowledged is not Apply authority or proof of a human actor; the
future transaction must independently recheck current source, lifecycle, policies,
containment and consent, publish atomically with one Undo and retain provenance.
