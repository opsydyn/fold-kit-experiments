# Headless connection-mode editor qualification

- result: complete
- claim: explicit v2 documents initialize a fixed-mode headless editor; creation/reconnection retain live policies and one-edit Undo while legacy initialization stays strict.
- evidence: literal document initialization, public reducer/context tests, policy-bypass mutation, installed consumers and final repository checks recorded below.
- remaining uncertainty: native/custom browser interaction, workbench UX, portable adapters, comprehensive accessibility/device/performance and hosted/registry qualification remain open; C1 is partial.
- next: qualify native/custom strict/loose port interactions and workbench source/target feedback before portable adapter adoption.

See [ADR 0093](../../../docs/adr/0093-adopt-connection-mode-in-headless-editor.md).

## Delivered boundary

`createEditorFromConnectionDocument` revalidates the explicit v2 source, detaches
its graph, retains mode and uses the document camera unless overridden. Missing or
unknown document mode rejects. `createEditor(graph)` remains strict; omission in
older host-constructed `EditorState` means strict. Mode has no change event: each
initializer starts a fresh session/history. Undo/Redo keep this fixed mode and
advance revision rather than rewinding it. Mode-aware copying is internal; public
v1 graph codecs/validators keep their old strict boundary.

Creation checks current port kinds, both current per-port policies, ordered
duplicates and whole-edge policy. Reconnection also rechecks the current edge/end
lock, changes only the nominated endpoint and preserves authored metadata. Its
port policy checks only the changed end; the unchanged endpoint remains
structurally checked, and whole-edge policy receives the replacement-free graph.
Missing/deleted endpoints, duplicate IDs and malformed authored data cannot acquire
permission through loose mode. Read-only and active-gesture commit guards remain.
An accepted transaction adds one prior graph and revision, clears redo/routes and
retains mode; blocked/no-op edits add no history. Zero history limit remains valid.

Creation/reconnection contexts enumerate both kinds under loose mode and retain
visible/all scope, current choice and protection feedback. Visibility scopes chooser
alternatives; it is not edit authorization, and `scope: all` intentionally includes
hidden ports. Current policies remain the authorization boundary. Loose source choices
carry explicit `PortActivated.end` so restaging is separate from target creation.
Direct activation stages the first port and connects the next; strict activation
retains output/input semantics. Pointer reducer previews/releases use current
validation and reevaluate policies on release. This is headless reducer evidence,
not native browser, rendered control or visual workbench qualification.

Normal metadata/movement/clipboard transactions validate and detach in the session
mode. JSON detachment is validated before and after encoding, retaining legacy
protection against authored serialization hooks producing invalid graph data.
Save with `captureConnectionDocument(editor)` and the v2 serializer. Extracting raw
graph data or using a legacy snapshot serializer cannot preserve loose intent;
strict-compatible loose data still needs explicit downgrade review. Model/edition,
patch/receipt, layout, Mermaid/CLI contracts have not adopted v2 in this slice.

## Behavioral evidence

**24 new tests** in `test/connection-editor.test.ts` exercise public exports with independent expected
matrix cases and the hand-authored loose v2 fixture:

- All eight mode/kind creation cases; every allowed case has exact graph, mode,
  revision and one-Undo/Redo assertions.
- Both reconnection ends across every loose kind pair, metadata/identity retention,
  no-op reconnection, strict rejection and old states without mode.
- Current source/target/global policy order, port veto short circuit, changed-end
  semantics, replacement-free graph and policy changes after resolving choices.
- Missing/deleted endpoints, duplicate and reverse links, self-connections,
  read-only/active gestures, source restaging, cancellation and visible/all scope.
- Pointer proposals and release-time lock/source checks, missing edge behavior,
  ordinary edits/movement/clipboard, zero history, literal roundtrip/save/reopen,
  invalid geometry and JSON detachment revalidation.

`test/package.test.ts` adds actual packed Node/Bun and strict TypeScript consumer
coverage for the explicit initializer, loose reconnection, one Undo and mode
recapture. It uses the independent literal fixture rather than only encoder output.

The initial test run failed at the missing public initializer export. Development
fixtures were then corrected to use existing typed event/semantic names; a
source-freshness case was corrected to restage after a graph edit intentionally
clears pending creation. Two existing tests caught an unintended strict prompt
article change, which was restored. A final camera regression reproduced an
explicit `viewport: undefined` discarding the document camera; fallback now treats
it like omission. These failures are not passing evidence.

A temporary mutation bypassing per-port vetoes caused **four new tests to fail**;
restoring the source returned all focused tests to green. This demonstrates that
successful graph mutations alone cannot satisfy the policy tests. No mutated
source remains. Final root lint/format checks completed with exit 0 after correcting
new-code assertion and conditional-spread lint findings. Existing Effect lint
warnings and the existing Viz skill-version warning remain separate from errors. Architecture, delivery and test-quality reviews are self-review.

## Final checks

Measured parent: `a4480e2c` on the isolated `codex/zloz-context-map` worktree.
`bun run test` completed with exit 0: core **713 pass**, workbench **166 pass**,
CLI **31 pass**, and no workspace test failures. Two existing promo tests remain
skipped. Core includes real installed Node/Bun and TypeScript consumer checks.
The final focused rerun recorded **49 pass**, including all **24** new editor tests
and the existing connection-document/creation/validation regressions. Full
`bun typecheck` completed with exit 0; existing Astro warnings remain documented
by its output rather than being reported as errors. The final camera correction
was followed by another passing core typecheck, focused 49-test run and root
lint/format check. The subsequent complete core rerun also passed all **713**
tests, including rebuilt packed consumers against the final source.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
`createEditorFromConnectionDocument` and the updated public type/event pages with
warnings treated as errors. An initial root test run
stopped at the tooling fixture because the sandbox denied Bun cache writes; this
was an environment failure, and the complete suite was rerun with cache access.
No npm publication, deployment, external write, mode migration or full parity claim.

Recommendation: **needs follow-up** for native/custom interaction and portable adoption.
