# Zloz native v3 completion and release preparation

Authority: user request to handle the remaining main work and move to creating a
release, following the native v3 Mermaid slice. Continue in the existing isolated
worktree. The explicit **no npm publishing** restriction remains in force. No new
slice approval gates. Finish this checklist rather than adding optional roadmap
items. Architecture, boundary, delivery and test-quality reviews are self-review.

## Fixed engineering checklist

- [x] Full-document native v3 DDD/EventStorming audit and edition comparisons.
- [x] Strict v3 modelling-patch object/text codecs, source/provenance-aware dry run,
      exact review/loss consent, live-policy atomic Apply/Undo and recomputed receipts.
- [x] Native v3 C4/DDD mapping/planning/Apply and strict portable conversion receipts,
      preserving group ports, every checkpoint capability/mode and provenance.
- [x] Native v3 review packets with chosen baseline/target, audit deltas and native
      Mermaid projections, strict reopening and independent read-only review.
- [x] Native v3 pointer resize, port-anchor drag/nudge, reconnection dragging,
      box selection and pinch, sharing the existing input resource and live planners.
- [x] Mounted workbench review/Apply/download/reopening and interaction demos, with
      source/epoch guards, visible protection/loss reasons and minimal/theme support.
- [x] Public/installed Node/Bun and Bundler/NodeNext contracts, legacy compatibility,
      actual SSR→hydration→interaction, browser/file/keyboard/reduced-motion evidence.
- [x] Representative flat/nested 100/1,000-node benchmark evidence with exact host,
      revision, samples and limits; budgets and device matrix must be identified as
      provisional until agreed, never inferred from a green synthetic run.
- [x] Accessibility/contrast/focus/recovery automation, followed by an executable
      human screen-reader and physical-device acceptance checklist with honest status.
- [ ] Main integrated, root lint/format/typecheck/test and package/API/demo checks,
      Moon pre-commit, committed clean CI rehearsal, pushed feature PR and green CI.
- [x] Reviewable release candidate/version/changelog/linked-peer/identity manifest
      preparation, with CLI and Alchemy private. No npm workflow dispatch/publication.

## Boundaries and acceptance

Core owns native v3 documents, semantic rules, intent and atomic editor publication.
Optional Mermaid owns portable projections/packets. The host owns live policy,
transient UI/selection/camera, async IO and receipt publication. Reuse existing
algorithms with version-specific validation; never remove group ports to use a
legacy adapter. V1/v2 writers/readers and default selectors remain version-fixed.
Imported packets/receipts are evidence, never consent or live edit authority.

Every changed graph must pass complete native validation and current live policy.
One accepted authoring operation is one full-document Undo; failures/cancel/stale
input publish no partial state. Consent binds exact current source/output. Required
findings/reasons remain visible in minimal mode. Trusted runtime state is never a
portable authority format. No runtime dependency is added for qualification alone.

The least powerful complete approach reuses patch operation evaluation, mapping
projections, audit comparisons, packet recomputation and browser input. Distinct
native entries select full v3 validators and the native transaction kernel. This
keeps algorithms separate from transport, rendering and host permissions.

Explicitly outside this batch: rotation, lasso/freehand/eraser, a dedicated
multi-connect interaction (atomic connection sets already exist), production
Mermaid import, server PNG, collaboration and provider activation. Human acceptance
cannot be reported complete through emulation. Missing human results remain release
qualification gates; the candidate can be made reviewable while those are pending.

## Delivery record

Baseline: local `af235a1e`; fetched main `e61d978f` integrated without conflicts on
`codex/zloz-release-completion`. Existing native ELK/SVG/PNG/clipboard/Mermaid slices
are retained. Release automation is release-please plus a separate manual Zloz npm
workflow. Creating/merging a publishing release or dispatching npm is not authorized.

Final evidence and candidate links will be recorded here as each gate is verified.

Local evidence: root `bun typecheck` passed; root `bun run test` passed, including
real Node/Bun and Bundler/NodeNext installed consumers. After the final relation
choice fix, all 205 workbench tests and its build passed. API docs and the built
demo passed. Browser matrix: 56 passed / 4 intentional non-Chromium multitouch
skips; 24 node-count observations, 18 axe scans with zero violations and explicit
manual/incomplete findings. Human acceptance is pending, not inferred complete.

The root Python test prerequisite was built through its existing `build` script;
its Moon test already declares that dependency. No Python package source changed.
The installed core's former version-required assertion was updated alongside the
now-supported v3 boundary while keeping the stale-source rejection check.

Delivery checkpoint: PR #151 is open. `cb84f992` contains the implementation and
`557179b5` declares generated evidence outputs for Moon hashing. Clean CI on
557179b5 passed 84 check/build and 14 integration tasks. Hosted final-head CI is
tracked on the PR checks, separately from this local checkpoint. The remaining release gate is human acceptance and review of
the regenerated 0.6.0 release PR after feature merge; npm publishing remains off.
