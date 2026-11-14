# Portable C4 conversion receipt qualification

- result: complete
- claim: strict core C4 v1 receipts support validated download and detached read-only reopening without changing the working model or granting consent.
- evidence: independent literal-wire tests, real installed consumer, host tests and production browser download/reopen captures; final workspace checks are recorded below.
- remaining uncertainty: receipts are unsigned consistency evidence; authorship, historical human review, persistent storage and hosted qualification remain unverified.
- next: expose read-only C4 receipt inspection through the Effect CLI with structured findings and explicit failure exits.

See [ADR 0090](../../../docs/adr/0090-validate-portable-c4-conversion-receipts.md).

## Core contract

`serializeEventStormingC4Conversion` and `parseEventStormingC4Conversion` validate the
independent `foldkit-zloz-c4-conversion` v1 envelope. They check full source scope,
explicit mappings/placements and recorded affirmative loss acceptance, rebuild a
reviewable plan and require a source camera. The complete target document must equal
the existing shared projection, including identity, graph data, geometry, ports,
communications, membership/constraints, camera, editions and fork ancestry.

The return value is detached/frozen source/options/target data. There is no Apply,
current consent, file I/O, host size policy or verified authorship. Unknown reserved
fields, unsupported formats/versions, malformed options and inconsistent targets are
rejected. A self-consistent changed receipt remains unsigned data. Existing DDD,
graph, model and edition wire contracts are unchanged.

The new **39-test** source suite starts with an independent literal v1 fixture that
contains a workshop group, system and event, explicit root placements, a renamed
plain communication, authored constraints/data, an edition and fork ancestry.
It covers strict envelope/nested fields, malformed/unsupported JSON, revisions,
explicit choices, incompatible containment, foreign/duplicate choices, missing camera,
unchanged plans, source/target history/metadata/graph tampering, frozen data,
serializer revalidation and actual Apply output. The installed consumer imports both
functions and validates a receipt from an actual atomic conversion under Node/Bun
and TypeScript. No registry publication is involved.

## Host and browser evidence

Eight new host tests exercise C4 opening/closing, read-only editing refusal,
invalid/cancelled/source-switched reads, preservation of the last valid comparison,
current-scope validated download, corrupt-record rejection before any Command,
failed-download retention, existing side/change navigation, invalid UTF-8, the
5 MiB read/download limits and Minimal-mode plan-specific membership loss rendering.
The unchanged DDD reader/navigation tests remain part of the workbench suite.

`bun run --filter @opsydyn/zloz-demo build` and
`node apps/zloz-demo/evidence/c4-receipt-browser.mjs` qualify an actual locally served
production artifact. The browser downloads an applied C4 receipt and compares its
source/target with exported full model documents. It then opens the saved bytes in
Minimal mode, inspects both sides in light/dark, navigates a change, and rejects a
forged target while preserving the selected comparison side. Closing restores the
exact working graph and retained record collection. Undo/Redo source/target graph
checks remain included. [Result JSON](c4-receipt-result.json) records zero page errors.

Captures: [before light](c4-receipt-before-light.png),
[after light](c4-receipt-after-light.png), [before dark](c4-receipt-before-dark.png),
[after dark](c4-receipt-after-dark.png). The light Before and dark After captures
were visually inspected for legible controls/semantics and simultaneous sidebar/canvas
visibility. This is bounded browser/keyboard evidence, not human task acceptance.

## Development and final verification

The first core run failed at missing public exports; the first host run could not
open C4 and had no C4 download message. Initial static checks found literal-wire
assertions using narrower domain overloads, a default-model inference and boundary
helpers needing named envelope types. These were corrected without weakening runtime
checks. The browser's first navigation selector used visible text instead of the
control's existing accessible name; correcting it passed the complete flow. An
intermediate format check ran before the browser script was fully formatted; it
was formatted and the final check rerun. A focused host run overlapping an adapter
rebuild saw a transient missing dist entry; final verification is run after builds. Those failures are not passing evidence.

Full `bun typecheck` completed locally with exit 0. A temporary mutation removed
the complete-target equality gate: **12 tests failed**, including graph/camera,
metadata/history and serializer rejection cases. Restoring the original source
returned all **39 receipt tests** to green. No mutated source remains. Final
`bun run test` completed with exit 0, including **673 core tests** and **166
workbench tests**, with installed consumers and final workbench TypeScript checks.
Final `bun run check`, production build, refreshed browser qualification and
`bun run --filter @opsydyn/foldkit-zloz docs` also completed with exit 0. Existing
configured warnings/skips remain; no warning-free claim is made. Architecture,
boundary, delivery and test-quality reviews are self-review. This slice adds no
CLI execution, automatic persistence, npm publishing or deployment and does not
claim complete D1b/C/Q/R closure.

Recommendation: **needs follow-up** for Effect CLI receipt inspection.
