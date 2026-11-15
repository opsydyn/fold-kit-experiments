# V2 edition forking qualification

- result: complete
- claim: package-owned v2 forking selects a source-owned edition, checks policy freshly, pins immediate-parent provenance and retains checkpoint mode/camera/data; v2 initialization composes the result into a fresh independent target session.
- evidence: public mode/ownership/policy/provenance tests, existing independent v2/loose-only fixtures, installed consumers, policy-veto mutation and repository checks below.
- remaining uncertainty: v2 append/comparison/ghosts/restore/playback, CLI/workbench and broader C/Q/R qualification remain open; C1 is partial.
- next: v2 edition comparison with explicit mode-only changes, before comparison presentation and cross-mode restore/playback adoption.

Measured parent: `d34ff41b`, isolated `codex/zloz-context-map` worktree.
See [ADR 0097](../../../docs/adr/0097-fork-v2-editions-with-pinned-provenance.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

`forkEditionV2` validates/detaches the complete canonical source before selecting an
owned edition or invoking policy. The target has nonempty identity/name and a
source-distinct ID; the host owns wider namespace availability. Missing editions
and invalid identities block without policy evaluation or fallback to current,
origin, review or foreign data. Invalid canonical/v1 source data rejects.

Each valid attempt calls `canForkEdition` with frozen detached source, its selected
edition and a frozen copied identity. No permission result is cached. Empty/blank
rejection strings remain vetoes; policy exceptions propagate without returning a
target. A blocked result contains a reason and no target document or partial data.

An allowed document retains the selected snapshot exactly, including connection
mode, authored identities/kinds/endpoints/payloads/geometry and optional camera.
Its edition list is empty. Immediate-parent identity/name and a detached immutable
selected-edition pin become origin. Target snapshot and pin are distinct values;
fork-of-fork provenance names only the immediate parent. No source data/history is
mutated, no graph IDs are rewritten and no identity or time is invented.

The fork returns canonical data. `createModelEditorV2` initializes that document
into its own editable session by default with fresh revision/Undo/Redo and no
inherited selection, clipboard, gestures or surface. A camera-less checkpoint stays
camera-less and the initializer uses its own default; working/review camera is not
copied. This is not restore or a source-graph edit and adds no source Undo entry.
Normal target edits use the target's independent Undo. No wire/v1 behavior changes,
external write, service authorization or mode-changing event is introduced.

## Behavioral evidence

Ten new tests in `test/edition-fork-v2.test.ts` cover:

- All four current/checkpoint strict/loose pairs with actual loose-only input→input
  data, exact retained snapshots, model-local IDs, separate immutable origin,
  roundtrip codecs, editable fresh target session and one target edit/Undo.
  Working selection/clipboard/surface and existing Undo/Redo remain unchanged.
- Fresh policy evaluation on the same source/target after a permission change,
  callback ownership/immutability, detached target identity and unchanged raw inputs.
- Invalid identity, missing/current/origin/empty-archive lookup rejection before
  policy, with no target or accidental fallback.
- Empty/whitespace vetoes and thrown policy failures without a returned target.
- Full validation of v1, duplicate, invalid unselected and pinned-origin inputs.
- Fork-of-fork immediate parent, checkpoint camera versus navigated review camera,
  and absent-camera retention/default target camera.

The real packed consumer imports the API, policy/result types and v2 initializer,
checks pinned provenance/modes, independent history, live veto and a negative
blocked-result type fixture under Node/Bun and strict TypeScript. Fixtures reuse
independently authored canonical and loose-only records rather than relying only
on encoder output.

## Development and verification

The initial run failed at the missing public export. The first behavior run passed
all ten cases; typechecking identified an optional-index expectation in a test,
which was expressed with the optional actual value rather than widening domain
types. A temporary policy-veto bypass made **two tests fail**; restoring source
returned all **38 focused fork/model/workflow tests** to green. No mutated source
remains. Development failures are not passing evidence.

`bun run test` completed with exit 0: core **761 pass**, workbench **169 pass**,
CLI **31 pass**, and no workspace failures. Two existing promo skips remain
separate. The final packed-consumer fixture, including its negative blocked-result
type assertion, was rerun independently and passed under Node/Bun/TypeScript.
`bun run check` completed with exit 0; existing Effect/TypeScript lint and Viz
skill-version warnings remain distinct from errors. Full `bun typecheck`
completed with exit 0. `bun run --filter @opsydyn/foldkit-zloz docs` completed
with exit 0, generating the fork function and policy/result type pages with
warnings treated as errors. Existing
warnings/skips remain separate from failures. No browser, device or human AT
qualification is claimed for this headless slice. No npm publication, deployment,
dependency/version change or full C1/parity completion.

Recommendation: **needs follow-up** for v2 comparison and wider workflow adoption.
