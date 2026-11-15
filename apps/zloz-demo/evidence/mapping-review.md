# Workshop mapping review — local qualification, 2026-11-11

result: complete

claim: The left workbench sidebar composes the public headless EventStorming-to-DDD
preview with explicit/default/retained choices, ambiguity, compatibility and
prospective-loss reasons; review choices leave the source graph and Undo untouched.

evidence: Five controller/SSR tests, production workbench build and Chromium
interaction checks with inspected light/dark captures below. Final workspace
check/typecheck/test commands exited 0.

remaining uncertainty: Local browser evidence only, not hosted deployment or
comprehensive screen-reader/accessibility acceptance. No conversion, provenance
persistence, loss consent, public API change, publication or deployment. Architecture,
delivery and test-quality review are self-review.

next: needs review; then define a headless conversion plan contract with source
provenance and explicit loss consent before adding an apply transaction.

## Scope and boundaries

Continued from `349b4d1` in isolated `codex/zloz-context-map`.
See [ADR 0042](../../../docs/adr/0042-compose-workshop-mapping-review.md).
Core owns modelling suggestions and loss/compatibility decisions. The workbench
owns temporary review choices, the inspected item and feedback in its Foldkit
Model/Message/update loop. No transformed graph or independent domain inference is
stored in the app. Preview choices are absent from authoritative model exports.

Callbacks/drafts carry model ID, session epoch, editor revision and exact source
graph key. Stale callbacks and hidden-panel input are ignored. Graph edits, Undo,
model/history/source replacement invalidate old choices. A test exposed replay
when reopening an identical example with the same revision/key; the example opener
now advances the model epoch, and the regression fails without that fix.

History keeps all proposals available to inspect, with choices/reset disabled and
a visible explanation. Active edits/import/layout also protect choices. Existing
DDD relationships cannot be remapped. Functional reasons and losses stay available
when Minimal mode or Show diagnostics suppress optional numeric summary badges.
The canvas always displays the source graph.

## Tests and browser evidence

The initial controller test failed because its production module did not exist.
Five controller/SSR tests then cover:

- Explicit node/edge choices, explicit retention and return to convention defaults.
- Incompatible DDD relationship choices and package-provided reasons.
- Exact graph/export/history/lineage preservation and choices reset.
- Foreign model/epoch, stale revision/exact-content and hidden-panel callbacks.
- Identical source reopening and Undo without revival of old choices.
- Busy/history protection, historical item inspection and diagnostic independence.
- Native labelled fields, selected loss, visible/accessible protection descriptions.

A first SSR assertion depended on serialized attribute order; it was corrected to
check the actual select and disabled attribute independently of order. A test tuple
needed a literal tuple annotation under strict indexed access. Neither changed
production behavior or weakened a protection.

Browser command, after the completed production build:

```sh
node apps/zloz-demo/evidence/mapping-review-browser.mjs
```

Passed on Chromium **151.0.7922.34**, 1600×1200, reduced motion; no page errors.
Source: [browser fixture](mapping-review-browser.mjs).
The fixture exercises multi/single-candidate ambiguities, keyboard type-ahead
retention, explicit node choices, incompatible edge choice/reason, restoration of
convention behavior, selected semantic-loss reasons, reset and source replacement,
Minimal/global diagnostics, and historical inspection with disabled choices.
Downloaded authoritative graph snapshots before/after choices and in history are
identical; Undo remains unavailable because no graph edit occurred.

The native select fixture uses type-ahead plus Tab; arrow/popup sequences did not
commit a changed value in this headless browser. The fixture was also corrected
to use the actual Minimal mode button and Rewind to edition select. This is native
keyboard evidence for the tested sequence, not a comprehensive keyboard audit.

[Light ambiguity capture](mapping-review-light.png) ·
[Dark proposal/loss capture](mapping-review-dark.png).
Both were visually inspected: clear source/choice/status/reason, shared family
themes, visible original workshop cards and no panel overlay obscuring the canvas.
The sidebar scrolls to additional content.

## Final verification

Host-captured commands against this isolated worktree:

- Baseline `bun typecheck` and `bun run check`: exit 0 before edits.
- `bun run --filter @opsydyn/zloz-demo test`: 72 pass, 0 fail, including five new
  controller/SSR tests.
- `bun run --filter @opsydyn/zloz-demo build`: exit 0.
- `node apps/zloz-demo/evidence/mapping-review-browser.mjs`: passed, no page errors.
- Final `bun run check`, `bun typecheck`, `bun run test`: all exited 0, sequentially
  after the completed production build/browser evidence. Existing/advisory lint and
  Astro warnings and existing skipped tests remain; no zero-warning claim.
- Final evidence/README formatting followed by another root check and
  `git diff --check`: exit 0.

The source-session regression was confirmed failing before the epoch fix. Final
checks cover that fix and all production changes. No publishing, push, PR, merge
or deployment was performed.
