# C4 workbench mapping review — local qualification

- result: complete
- claim: the left sidebar composes the public headless C4 preview with explicit staged choices, current provenance, ambiguities and prospective losses while preserving the source model and Undo.
- evidence: full workspace typecheck/tests passed, followed by final affected-app typecheck/tests (141 passed, including eight C4 review tests); production build and Chromium interaction evidence passed with zero page errors. Root lint/format checks passed before final evidence capture and were rerun for the final files.
- remaining uncertainty: local Chromium/SSR evidence does not establish manual screen-reader, physical-device, other-browser, hosted CI or user acceptance. C4 conversion planning, containment, exact-plan loss consent, guarded Apply and atomic Undo remain separate. No npm publishing or deployment.
- next: define the headless C4 conversion plan with explicit membership/containment decisions, source provenance and exact-plan loss acknowledgement before adding Apply.

## Contract and boundaries

[ADR 0085](../../../docs/adr/0085-compose-c4-mapping-workbench-review.md) keeps
C4 review separate from the existing DDD conversion controls. Core owns
`previewEventStormingC4Mapping`, including strict meaning, provenance and loss
projection. Astro owns only ephemeral selection, form drafts and explicit choices.
The canonical canvas stays visible and unchanged. No new package API, conversion,
consent token, receipt, persistence, runtime dependency or publication is introduced.

Native controls expose role, structural name, unspecified/internal/external scope,
optional technology and communication label. Input remains a draft until explicit
Preview; edits revoke that item's previous choice. Retain, Clear and Reset are
review actions. Blank names and kind-incompatible group roles have protection
reasons. Technical identifiers follow Minimal mode/diagnostics, while source
meaning, candidates, authored hotspot status and prospective losses remain visible.
Light/dark fields use the same paper/ink/rule tokens as the existing family shell.

Requests carry model/epoch, source graph/revision, edition and item identity.
Stale/foreign/hidden requests and stale selected-item fields fail closed.
Graph/model/revision/edition changes clear review; camera navigation keeps semantic
choices while recapturing current provenance. History, busy sources, receipt,
Domain and packet review protect choices. Historical and busy contexts still permit
item inspection. No advisory request grants model-edit or conversion authority.

Architecture, boundary, delivery and test-quality reviews are **self-review**.
Optional native fields have stable source/item keys and a rendered-target status.
No policy or freshness guard was relaxed to make browser tests pass. Future
conversion must independently resolve containment and exact source/loss consent,
then recheck current policies and lifecycle before one atomic Undoable transaction.

## Verification

```sh
bun typecheck
bun run test
bun run --filter @opsydyn/zloz-demo test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/c4-mapping-browser.mjs
bun run check
```

The affected app command compiles TypeScript and runs tests. Eight new tests cover
package ambiguity/provenance, source/Undo/edition invariance, explicit draft preview,
revocation/blank-name protection, node/scope/communication composition and endpoint
findings, retain/clear/reset, kind restrictions, stale/foreign/hidden and stale-item
requests, source replacement, historical/busy/read-only context protection, native
SSR labels/reasons, semantic diagnostics independence and camera-only retention.
Domain/packet tests use the existing bounded local fixtures and reader commands;
protection follows the current reader scope even without a rendered projection.

The production script checks Enter Preview and preserved focus, no Apply action,
explicit scope selection, communication proposal, visible hotspot/lane/membership
losses, actual native disabled option properties, empty-name revocation, retention,
clearing, Minimal mode, exact pre-capture model/lineage equality, historical
inspection/protection and return-to-working-source reset. Capturing an edition is
an explicit later test action; only the working graph is compared afterward.

## Initial failures and correction

The first test harness used the wrong initializer name; it was corrected to the
existing `init().model`. Static checks caught a widened scope string and the new
field contract was explicitly typed. A stale-source test originally expected the
whole app record to remain identical; the app legitimately reconciles away stale
review state, so it now checks the pure request guard and preserved editor identity.

Initial browser attempts selected an item and immediately operated on controls
before the selected item's render had settled. The stale-item guard correctly
ignored the old target's input. Keyed native controls and an explicit current-target
status make the identity clear; the script now waits for that rendered target,
without arbitrary delays or weakened scope checks. These attempts are failures,
not evidence of a qualified path or a diagnosed FoldKit runtime defect.

The option matcher reported enabled despite an HTML option with `disabled=""`
and native `disabled === true`. Final checks assert the actual native disabled
property; forged incompatible role requests are independently rejected in tests.
Visual review also found unthemed text fields and excessive spacing; scoped family
tokens and compact panel rules corrected them before the final captures.

## Artifacts

- [Light review/provenance](c4-mapping-light.png).
- [Dark review/provenance](c4-mapping-dark.png).
- [Dark prospective losses with source canvas](c4-mapping-losses-dark.png).
- [Production interaction script](c4-mapping-browser.mjs) and [result](c4-mapping-result.json).

Recommendation: **needs review**. This completes the approved workbench review
slice, not D1b conversion, C/Q/R closure, release or deployment.
