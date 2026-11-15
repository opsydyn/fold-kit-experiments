# V2 change navigation qualification

- result: complete
- claim: package-owned v2 navigation represents mode inspection separately from graph reveal, preserves the chosen side and rechecks scopes, filters, membership and host reasons without editing or side fallback.
- evidence: 18 focused tests, packed Node/Bun/strict TypeScript consumers, two detected side-mutation failures, inspected static light/dark Chromium fixture and passing repository checks below.
- remaining uncertainty: mounted workbench/CLI adoption, v2 append/merge/restore/playback, device/human accessibility and wider C/Q/R qualification remain open; C1 is partial.
- next: mode-preserving v2 edition append with explicit identity-conflict handling before restore/playback adoption.

Measured parent: `b01d083a`, isolated `codex/zloz-context-map` worktree.
See [ADR 0100](../../../docs/adr/0100-navigate-v2-changes-with-explicit-mode-inspection.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

Core v2 navigator/focus/step resolvers consume validated comparison pins and the
host's current side. A distinct mode entity has no authored ID; its inspection
target has no reveal event or geometry. Graph targets retain the chosen checkpoint's
ID/mode and emit only its native reveal event. Added/removed entities absent from
the chosen side remain visible with a nonempty reason. They block rather than
switching sides. Neither mode nor graph focus edits authored state or creates Undo.

Scoped stable cursors include both edition IDs and entity identity. Mode entries
sort first and participate in the changed filter. Steps use live filters,
membership and host reasons, with no wrap, skipped unavailable candidate or cached
policy. Stale/filtered cursors are ignored. The host owns immutable checkpoint
identity, selected side and correct review binding; scope is not a content hash,
wire decoder, permission proof or restore/Apply authority.

Optional FoldKit v2 navigator/button compose native filter primitives with
replaceable/omittable entry/status/reason/layout parts. Defaults retain button
semantics, disabled state, accessible names, polite status and visible reasons.
Custom entries own list semantics and accessible meaning. V1 behavior is unchanged.

## Regression and development evidence

Eight headless tests cover mode-only changes in both directions, unchanged modes,
mode/node ID namespace collisions, deterministic order/counts/filters, frozen
contexts and scoped requests, explicit side/mode targets without fake events,
absent added/removed nodes and edges, direct/Previous/Next side retention, both
boundaries, no wrap/skipping, stale scopes and filtered cursors, blank/global/live
vetoes, actual loose-only edge reveal and reversed comparisons. Read-only review
composition retains checkpoint mode, unchanged selection and empty review history;
working authored state and Undo remain independent.

Two SSR/DOM tests cover native mode buttons and side-absent disabled entries,
visible reasons, polite status, custom entry/button composition, filter/status/
reason/layout replacement, fallback and omission. Existing v1 navigator/step
regressions remain green: **18 focused tests**, no failures.

The initial headless/view runs failed at missing public exports. A review test
incorrectly expected reveal to select a node; the existing camera-only contract
was inspected and the assertion corrected to unchanged selection and the expected
reveal notice. Typechecking identified that erroneous field and one widened
message literal in a test callback; both were corrected without changing domain
types. A targeted mutation choosing the selected checkpoint for every focus
caused **two tests to fail**; restored code returned the focused suite to green.
No mutated source remains. Lint rejected an ad hoc throw in the evidence script;
using a native test assertion corrected the harness. Development failures are
separate from passing evidence.

The real packed consumer imports core and FoldKit APIs/types, checks baseline mode
inspection and live selected-side veto, exercises step start, renders a custom
native change button/list, and rejects mode requests with a fake graph ID and mode
targets with editor events through strict TypeScript negative fixtures. Core's
packed Node/Bun/TypeScript run passed within the workspace suite. Final review
also narrowed mode entries to `kind: 'changed'`; its final installed-consumer
negative fixture rejects a mode entry labelled added/removed.

## Static visual evidence

The [HTML fixture](history-navigation-v2.html) and
[light/dark screenshot](history-navigation-v2.png) render actual public status and
navigator views. Both sides expose mode inspection; baseline reports loose and
selected strict. Selected-side removals are disabled with visible reasons, while
baseline removals remain inspectable. Chromium checked button counts, disabled
availability, checkpoint-mode text and visible side-absence reasons. The screenshot
was visually inspected.

Reproduce locally (requires installed Playwright Chromium):

```sh
bun packages/foldkit-zloz/evidence/history-navigation-v2-browser.mjs
bunx oxfmt packages/foldkit-zloz/evidence/history-navigation-v2.html
```

This is static package rendering, not mounted workbench/CLI adoption or a browser
click/keyboard interaction claim. No new device, human screen-reader, hosted or
current CI qualification is claimed.

## Repository verification

`bun run test` completed with exit 0: core **789 pass**, workbench **169 pass**,
CLI **31 pass**, no workspace failures. Two existing promo skips remain separate.
`bun run check` completed with exit 0; existing Effect/TypeScript warnings and the
Viz skill-version warning remain separate from errors. Full `bun typecheck`
completed with exit 0. The final installed-package test was rerun after the
mode-kind declaration refinement and passed under Node/Bun/strict TypeScript.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
core resolver/request/cursor/entry/target and FoldKit view/type pages with warnings
treated as errors.

No npm publishing, deployment, dependency/version change or full C1 completion.
V2 append/merge, restore/playback, adapter adoption and wider C/Q/R gates remain
open. Recommendation: **needs follow-up** for mode-preserving v2 edition append
with explicit identity-conflict handling before restore/playback adoption.
