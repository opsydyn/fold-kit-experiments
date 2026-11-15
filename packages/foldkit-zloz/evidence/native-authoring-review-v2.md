# Native v2 authoring and review qualification

result: complete

claim: the approved native package/CLI audit, patch, conversion-receipt and review-packet batch preserves explicit modes through validation, guarded Apply, Undo and read-only reopening; v1 readers remain fixed.

evidence: full workspace tests, typecheck, lint/format and API docs passed; final CLI consumer checks and nine built CLI operations are linked below.

remaining uncertainty: mounted workbench adoption, current CI, hosted/registry qualification and human/device acceptance are outside this batch; consistency validation proves neither authorship nor live authority.

next: one mounted native v2 authoring/review slice with visible review/loss consent, guarded Apply/Undo, downloads and read-only reopening.

Measured parent: `e19efa78`, isolated `codex/zloz-context-map` worktree.
Architecture, delivery and test-quality reviews are self-review. See
[ADR 0104](../../../docs/adr/0104-adopt-native-v2-authoring-and-review.md).

## Delivered contracts

- Explicit v2 connection audits and owned-edition comparisons validate checkpoint
  modes and reuse the existing DDD/causal rules and delta logic. Comparison sides
  retain mode; a mode-only change does not fabricate a semantic finding.
- V2 patches pin required source mode, model/session, revision and graph. The six
  graph operations preserve mode/ordered ports. Shared operation/policy engines
  retain fixed v1 capture wrappers. Own source data before reading mode; reject
  accessors without evaluation. Dry run cannot substitute graph equality for
  complete source identity.
- Live v2 Apply rechecks source, lifecycle, revision capacity, current port and
  whole/granular policies, Undo availability and exact affirmative review/loss
  consent. Return editor and receipt together; one Undo restores the graph/mode.
  Reopened patch receipts recompute target, unchanged mode, flags and next revision.
- Native C4/DDD previews/plans/consent/Apply reuse existing mapping, containment,
  disclosure and policy engines with explicit canonical v2 capture. Receipts retain
  complete source/target models, camera and archive/origin modes. Reopening
  recomputes the complete target; old readers reject v2. No port retyping occurs.
- Strict native evidence readers enforce raw text/depth/value/duplicate-key budgets
  before domain decoding and normalize syntax failures. Creation/serialization
  check reopening budgets before portable success. Recorded flags are evidence,
  never current permission or consent.
- V2 selected-snapshot packets retain checkpoint modes, audit deltas, data-only
  conventions and v2 Mermaid projections. Shared strict decoding recomputes them.
  Opening either side creates an independent read-only review with zero Undo.
  Package and CLI creation enforce their respective default reopening budgets.
- Effect CLI selects native audit/compare, patch dry-run and packet paths. C4/DDD
  v1/v2 and patch v2 receipt inspectors return explicit read-only evidence; DDD/patch
  include structured changes/loss summaries alongside complete receipts. Unknown
  receipt versions exit 1; malformed/inconsistent data exits 2. Causal incompatibility
  or introduced findings still exit 1. There is no CLI Apply or file mutation.

The capability report now records these native boundaries as supported, within
format scope rather than engine eligibility or permission. `readDocument` and
`readGraph` retain v1-only embedding behavior; native command dispatch uses the
explicit discriminated portable reader. No manifest/dependency or release change.

## Regression and compatibility evidence

Six new core tests cover actual loose input-to-input patches/conversions, mixed
checkpoint modes, old-reader rejection, canonical mode validation, stale source
mode/revision, live port protection, source getter ownership, exact receipt
recomputation, forged flags/results, duplicate/oversized text and graph Undo.
Two new packet tests cover reproducibility, mixed modes, read-only independence,
forged projection mode, duplicate fields and default creation budgets. CLI tests
cover native comparisons, packet creation/inspection, separate patch source,
all three inspectors, explicit exits, deep/duplicate input and CLI output budgets.

Literal synthetic v2 patch/model/receipt/packet wire fixtures are retained for
future compatibility tests; tests reopen them rather than generate expected
records using the encoder under test. Original v1 fixtures/readers remain covered.
The affected legacy core suite reported **166 pass** during development. A
controlled mutation comparing only source graphs instead of complete pinned
source failed the new native source-mode regression. The original source was
restored; the focused native patch tests returned to **3 pass**. No mutation remains.

Installed consumer fixtures import native core types/APIs without UI peers,
exercise patch Apply/receipt/Undo, C4/DDD reopening, audits/comparisons and native
packet read-only opening. The real CLI tarball runs under Node and Bun against
literal loose-port fixtures, including packet/patch/receipt commands and structured
loss findings. These are local installed-consumer results, not registry releases.

Development failures were corrected before qualification: missing native exports,
raw optional document typing in the shared DDD decoder, newly supported v2 being
mistaken for an unsupported-version test case, and lint findings at intentional
raw decoder boundaries. Unsupported-version tests now use version 99; invalid
v2 records retain their distinct exit-2 assertions. No assertion was weakened to
accept mode loss or inconsistent evidence.

## Observed repository checks

- `bun typecheck`: exit 0 across the workspace. The final CLI-only typecheck also
  passed after adding structured receipt summaries.
- `bun run test`: exit 0. Core **819 pass**, Mermaid **47 pass**, CLI **36 pass**,
  workbench **178 pass**, ELK **12 pass**, force **7 pass**, with no failures in other
  workspaces. Two existing promo skips remain.
- `bun run --filter @opsydyn/foldkit-zloz-cli test`: final repeat exit 0, **36 pass**,
  including fresh installed Node/Bun binary checks for receipt changes/loss summaries.
- `bun run check`: exit 0; advisory lint and existing Viz skill-version warnings
  remain separate from errors. `git diff --check` is clean.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0 with documentation warnings
  treated as errors. Generated pages include native patch Apply, C4 v2 receipt
  decoding, audit comparison, packet creation and CLI receipt review types.

Nonfatal sandbox Vite listen diagnostics during typechecking do not represent a
TypeScript failure. Installed tests used authorized cache access. No current CI,
hosted, real-device, browser/manual or assistive-technology result is inferred.
There are no UI changes and no fresh visual acceptance claim for this headless/
CLI slice. Earlier mounted history evidence remains a separate qualification.

## Built CLI evidence and reproduction

The [nine-operation receipt](../../../packages/foldkit-zloz-cli/evidence/native-v2-cli.json)
records real local Node CLI stdout/status/exit artifacts. Key outputs:

- [Native capabilities](../../../packages/foldkit-zloz-cli/evidence/native-v2-compatibility.json)
- [Causal comparison](../../../packages/foldkit-zloz-cli/evidence/native-v2-causal-comparison.json):
  intentionally introduces an incompatible event-to-event causal finding and exits 1.
- [Patch review](../../../packages/foldkit-zloz-cli/evidence/native-v2-patch-review.json)
- [Packet](../../../packages/foldkit-zloz-cli/evidence/native-v2-review-packet.json)
  and [read-only inspection](../../../packages/foldkit-zloz-cli/evidence/native-v2-review-inspection.json)
- [C4 receipt](../../../packages/foldkit-zloz-cli/evidence/native-v2-c4-receipt.json),
  [DDD receipt](../../../packages/foldkit-zloz-cli/evidence/native-v2-ddd-receipt.json)
  and [patch receipt](../../../packages/foldkit-zloz-cli/evidence/native-v2-patch-receipt.json)

After building the CLI, run the `arguments` in the operation receipt with
`node packages/foldkit-zloz-cli/dist/bin.mjs`. Paths are relative to this worktree.
Artifacts use synthetic fixtures; actor/session assertions are not real identity
or authorization evidence. CLI responses wrap packet/receipt data; extract the
actual record before reopening it through its dedicated codec.

No npm publishing, deployment, push or PR occurred. This closes the approved
native package/CLI batch, not mounted workbench adoption or all C1/C2–C4/Q/R gates.
Recommendation: needs follow-up for the mounted adoption slice.
