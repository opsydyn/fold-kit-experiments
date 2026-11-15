# V2 edition append qualification

- result: complete
- claim: v2 append validates and preserves checkpoint modes/data while explicitly blocking duplicate/conflicting identities with immutable review pins and no replacement archive; shared JSON equality correctly handles distinct Unicode keys independent of insertion order.
- evidence: 17 focused tests, detected identity-guard and Unicode regressions, packed Node/Bun/strict TypeScript consumers, final 801 core tests and passing workspace/lint/typecheck/API documentation checks below.
- remaining uncertainty: v2 merge/restore/playback, CLI/workbench adoption, device/human accessibility and wider C/Q/R qualification remain open; C1 is partial.
- next: atomic v2 edition merge with idempotent identical imports and explicit identity conflicts before restore/playback adoption.

Measured parent: `4f484377`, isolated `codex/zloz-context-map` worktree.
See [ADR 0101](../../../docs/adr/0101-append-v2-editions-with-explicit-identity-conflicts.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

`appendEditionV2` validates/detaches the complete existing v2 archive and proposed
checkpoint through existing codecs. Only a fresh ID returns an appended frozen
archive, preserving existing order and each checkpoint's explicit mode, camera,
authored IDs, kinds, geometry and payloads. Original inputs remain mutable and
unchanged. No names, timestamps or identity counters are invented.

A reused ID returns no archive: `duplicate-edition` for identical canonical value,
`edition-conflict` otherwise, with readable reason and detached frozen
existing/proposed pins. It never overwrites, renames or appends an existing ID.
Object-key order is irrelevant; name, mode, camera, payload/geometry and authored
array order participate. Graph/mode comparison of the returned pins deliberately
has narrower semantics than full checkpoint equality. Mode-only conflicts compose
with `compareEditionsV2` without fabricated graph changes.

The helper owns a list, not a containing model or persistence permission. Hosts
own model binding, wider identity allocation, live application authorization and
storage. Compose success through `captureModelDocumentV2` to validate the whole
model; current/origin data and working/review histories remain independent. There
is no editor event, Undo, restore/Apply, merge or external write.

## Regression and development evidence

Twelve public tests cover:

- All four existing/proposed strict/loose mode pairs, including actual loose-only
  input→input edges, exact preserved data, detached ordering and archive roundtrip.
- Empty archive, verbatim host IDs/names and absence of invented metadata.
- Identical/key-reordered duplicate rejection with frozen review pins and no
  archive field; conflicting mode, name, camera, meaning, geometry and authored
  node order with no mutation or overwrite.
- Full-archive/candidate validation, malformed unrelated entries, already duplicate
  current IDs, empty identities/names, explicit legacy rejection and unknown mode,
  asserting the existing `ZlozError` rather than accepting arbitrary exceptions.
- Success and blocked deep immutability/detachment without freezing caller inputs.
- Canonical model composition preserving current/origin modes/data, independent
  working Undo, loose read-only review history and legacy v1 behavior.

Existing v1 history regressions also pass: **17 focused tests**, no failures.
The initial test failed at the missing public export. Typechecking caught two
negative-test directives separated from their expected error by formatting; invalid
fixtures were named so directives stay beside the relevant calls, without casts
or widening production types. Lint flagged the test's generic structural frozen
object inspector as a domain parser; a narrowly scoped annotation records that it
only inspects validated output representation. These development failures are not
passing evidence.

A temporary identity-guard bypass caused **three tests to fail**. Restored source
returned the focused suite to green. No mutated source remains. Malformed-input
assertions were then strengthened and the full focused pair rerun successfully.

Final review reproduced a shared equality defect: distinct NFC/NFD JSON keys
compared equally under locale collation, so reversing their insertion order
incorrectly returned a conflict. The new public append regression failed with
`edition-conflict` instead of `duplicate-edition`. Ordinal key sorting corrected
the shared comparator without changing wire data; the final focused pair passed.

The real packed consumer imports the function/result type under Node/Bun/strict
TypeScript. It checks mixed-mode appended order, frozen output, explicit identical
and conflicting reuse, absence of an archive on conflict, frozen pins and mode-only
comparison. A negative type fixture rejects a blocked result containing an archive.
That consumer passed in the full core workspace run.

## Verification

`bun run test` completed with exit 0 both before and after the Unicode fix. The
final run reports core **801 pass**, workbench **169 pass**, CLI **31 pass** and
no workspace failures. Two existing promo skips remain separate. `bun run check`
completed with exit 0 on the final source; existing Effect/TypeScript warnings and
the Viz skill-version warning remain distinct from errors. Full `bun typecheck`
completed with exit 0 again after the Unicode correction.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
the append function and result type pages with warnings treated as errors.

No renderer/control is introduced, so no screenshot, mounted browser/device,
human accessibility, current CI or hosted claim is made. No npm publishing,
deployment, dependency/version change or full C1 completion. V2 merge,
restore/playback, CLI/workbench and wider C/Q/R gates remain open.
Recommendation: **needs follow-up** for atomic v2 edition merge with idempotent
identical imports and explicit identity conflicts before restore/playback.
