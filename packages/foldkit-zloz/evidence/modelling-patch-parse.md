# Strict versioned modelling-patch decoding — local qualification, 2026-11-13

- **result:** complete
- **claim:** core decodes exactly one raw v1 patch through bounded JSON grammar/duplicate-key preflight and the existing patch object validator, returning owned frozen data or structured rejection without dry run, editor mutation or Apply.
- **evidence:** independent literal fixture, eight decoder tests, existing patch regressions, detected duplicate-guard mutation, actual installed Node/Bun and Bundler/NodeNext consumer checks, deterministic decode results, root checks/tests and TypeDoc; commands below.
- **remaining uncertainty:** character/value/depth limits are not byte, peak-memory or wall-clock guarantees. File/stdin UTF-8 IO and Effect CLI dry run remain future work. No authentication, consent, Apply, UI/device/AT, publication, PNG or Alchemy claim.
- **next:** needs review; add Effect CLI patch dry run using bounded fatal UTF-8 IO, this decoder and a separately supplied current source.

## Public contract and boundary review

[ADR 0061](../../../docs/adr/0061-decode-versioned-modelling-patch-text-strictly.md)
extends the approved patch contract with `parseModellingPatch`,
`ZlozModellingPatchParseOptions` and `ZlozModellingPatchParseResult`. The module
imports only core graph/error, patch validation and types. Internal shared caps
and the existing schema-error path avoid divergent object validation. There is
no adapter/Effect/Foldkit/browser dependency and no lint configuration change.
Existing graph/model/review codecs and patch wire v1 remain unchanged.

The scanner bounds the raw text and traverses grammar, values and decoded property
names before constructing the complete JSON value. JSON.parse is used for validated
key string tokens and, only after preflight, the whole document. It rejects decoded
duplicate names even in metadata, malformed strings/escapes/numbers, comments,
BOM, non-JSON whitespace and extra frames. Non-finite numeric values reject after
syntax/framing checks. Distinct Unicode keys are retained; JSON Pointer paths
escape slash/tilde correctly. Native JSON parsing constructs data; existing capture
then validates exact proposal/source/payload/provenance and owns deep freezing.

Defaults and maximums are 2,000,000 UTF-16 code units, value depth 64 (root zero)
and 100,000 values excluding key names. Hosts may only tighten positive safe
integer limits. Explicit null, string and boolean limit values reject rather than
defaulting. The fixed 1,000-operation cap reports a limit error at `/operations`.
No full JSON allocation occurs before preflight succeeds. Limits do not imply
host input-byte or responsiveness guarantees; IO hosts still enforce fatal UTF-8,
byte budgets, cancellation and transport framing.

A successful decode is proposal validity, not prospective graph validity or
current authority. Missing targets, duplicate targets, dangling final relationships,
stale source, review protection and losses remain dry-run responsibilities.
Source/provenance are unsigned claims. No CLI response envelope is unwrapped, no
model is imported and no policy, operation or content is executed during decoding.
The original editor, graph, camera, Undo and editions are untouched.

Architecture/boundary, delivery and test-quality review are **self-review**,
verdict **safe with noted risk**. No independent or hosted review is claimed.
Rollback before publication is a local revert without model migration.

## Reproducible artifacts

- [Independent v1 literal](../test/fixtures/modelling-patch-v1.json).
- [Decoder tests](../test/modelling-patch-parse.test.ts).
- [Actual parsed/duplicate/version/limit/framing results](modelling-patch-parse-example.json).
- [Result generator](modelling-patch-parse-example.ts):

```sh
bun packages/foldkit-zloz/evidence/modelling-patch-parse-example.ts
```

The successful literal preserves the complete DDD proposal and source/provenance.
The duplicate metadata example rejects at `/source/graph/nodes/0/data/owner`;
version 2 rejects at `/version`. The limited example reports the value-budget
path; concatenated documents reject at root. No screenshot is applicable to this
headless-only slice.

## Verification

- Baseline `bun typecheck` and `bun run check`: exit 0.
- Final `bun typecheck`: all workspaces, exit 0.
- Final `bun run check`: lint/format/catalog/skills, exit 0. Existing repository
  hints/warnings remain; this is not a zero-warning claim.
- Final `bun run test`: all workspace suites, exit 0. Core **506 pass**, including
  **8 decoder tests**; decoder plus prior patch focused suite **20 pass**.
  Existing unrelated skipped tests remain skipped.
- `bun run --filter @opsydyn/foldkit-zloz docs`: strict public TypeDoc, exit 0.
- Packed consumer: real offline npm tarballs, no workspace links or unwanted runtime
  peers, Bundler/NodeNext compilation and Node/Bun execution of owned decoding,
  escaped duplicate names and a 150,001-value array. The wide input is rejected by
  bounded iteration rather than an argument spread or stack overflow.

Tests cover the literal, frozen ownership, exact independent fixture counts
(**54 values**, maximum depth **6**), character/value/depth boundaries, operation
cap, invalid configuration, format/version/envelope errors, precise schema paths,
decoded duplicates at multiple depths, escaped emoji/Unicode names, pointer escaping,
JSON grammar/framing/control characters, finite numbers, valid scalar/container
metadata, prototype-named keys, distinct Unicode keys and decoding versus dry run.
Live dry-run findings reproduce the literal's label loss without editor/Undo edits.

The initial red test failed for the absent export. An interim typecheck found the
JSON fixture's widened literal types in an assertion; comparing its wire value
resolved the test typing without weakening runtime validation. A targeted temporary
mutation removed duplicate-key rejection: the duplicate test failed, receiving
`unsupported-format` where it required `invalid-json`. The guard was restored and
the complete focused suite passed afterward. No expected failure is counted as a
passing production check. Shared-dist builders, workspace tests and TypeDoc ran
sequentially; independent lint ran alongside them. Recommendation: **needs review**.
