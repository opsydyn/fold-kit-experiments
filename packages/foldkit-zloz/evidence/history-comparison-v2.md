# V2 edition comparison qualification

- result: complete
- claim: package-owned v2 comparison reports explicit checkpoint mode changes independently of stable-ID graph changes, with validated detached frozen results and a guarded legacy boundary.
- evidence: public regression tests, real packed consumer, mode-summary mutation and repository checks recorded below.
- remaining uncertainty: presentation/ghosts, append, restore/playback, CLI/workbench adoption and wider C/Q/R qualification remain open; C1 is partial.
- next: package-level v2 comparison presentation with explicit mode feedback and history ghosts before cross-mode restore/playback adoption.

Measured parent: `03e3388a`, isolated `codex/zloz-context-map` worktree.
See [ADR 0098](../../../docs/adr/0098-compare-v2-editions-with-explicit-mode-changes.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

`compareEditionsV2` validates both explicit checkpoints independently through v2
capture, retaining loose-only edges and authored port kinds. Shared graph diff
logic preserves existing stable-ID ordering, meaning/layout distinctions and
connected edge geometry. Mode is a separate discriminated unchanged/strict→loose/
loose→strict record. A mode-only transition has semantic change and empty graph
delta arrays. Camera and edition metadata remain pinned but are excluded from
graph/mode summary flags. Outputs are detached and deeply frozen without freezing
or mutating caller data. No editor, mode mutation, Apply or Undo is involved.

Legacy comparison now rejects explicit v2/loose snapshot intent on either side
through the same guard as v1 serialization. Ordinary v1 output shape and reference
behavior remain intact. Manually extracting graphs can still discard mode;
versioned APIs cannot recover intent that callers removed.

## Regression and development evidence

Twelve new public comparison tests cover all four mode pairs with equal nonempty
graphs, combined and independent semantic/layout changes, induced edge geometry,
stable-ID added/removed ordering, actual input→input loose-only fixtures, invalid
modes/graphs/v1-shaped inputs, detached frozen pins/change records/arrays, metadata
and camera exclusion, and legacy rejection/reference behavior. Existing v1
history tests retain JSON-key-order and authored graph semantics coverage.

The initial regression run failed at the missing public export. Typechecking then
caught a mode type imported from its private consumer rather than its defining
module, and an expected-value union wider than the deliberately restrictive mode
change type; both were corrected without widening the public contract. A temporary
mutation removing mode from aggregate semantic change caused **two tests to fail**.
Restored source passed all **17 focused tests**. Development failures are not
passing evidence; no mutated source remains.

The packed consumer imports the function and both public types, checks an actual
mode-only transition through the installed package, and rejects an equal-mode
`changed` record with a strict TypeScript negative fixture. Node/Bun/strict TypeScript consumer checks passed in the full workspace run.

## Verification

`bun run test` completed with exit 0: core **773 pass**, workbench **169 pass**,
CLI **31 pass**, and no workspace failures. Two existing promo skips remain
separate. The focused comparison/history tests were rerun after strengthening
invalid-baseline and strict-v2 legacy guards: **17 pass**, no failures.
`bun run check` completed with exit 0; existing Effect/TypeScript lint and Viz
skill-version warnings remain distinct from errors. Full `bun typecheck`
completed with exit 0. `bun run --filter @opsydyn/foldkit-zloz docs` completed
with exit 0, generating function and public comparison/mode type pages with
warnings treated as errors.
No browser, device, hosted, current CI or human AT qualification is claimed for
this headless slice. No npm publication, deployment, dependency/version change or
full C1/parity completion.
