# Headless EventStorming-to-C4 preview — local qualification

- result: complete
- claim: peer-free core exposes an immutable advisory C4 mapping preview with explicit choices, complete source provenance, ambiguities and prospective loss findings before conversion or Apply.
- evidence: full workspace typecheck, lint/format and tests passed; 601 core tests include 12 focused C4 tests and a real installed-package TypeScript/runtime consumer. API docs generated successfully. The endpoint-check mutation was detected by two behavioural tests.
- remaining uncertainty: workbench review, conversion planning, C4 containment, exact-plan consent, live Apply policies and atomic Undo remain separate. No UI/hosted qualification, full D1b/C/Q/R closure or npm publishing is claimed.
- next: compose the workbench C4 mapping review with explicit choices, provenance, ambiguities and losses before adding conversion planning.

## Scope

[ADR 0084](../../../docs/adr/0084-preview-eventstorming-to-c4-mapping.md) defines
`previewEventStormingC4Mapping` as immutable advisory data. It captures source
model identity, graph/camera, editions, fork ancestry, session/revision and explicit
choices. No conversion graph, events, loss-consent token, write authority or Apply
operation is returned. No workbench UI, CLI operation or visual-renderer change is
part of this headless slice.

All proposals require explicit choices. Actor/system candidates are non-exhaustive;
there is no default scope or runtime boundary. Commands/events/policies are not
inferred executors, structures or communication. Lanes/hotspots stay unmapped until
explicitly reinterpreted or retained. Existing kind contracts reject a lane-to-person
or lane-to-component choice. Null preserves source meaning and claims no C4
compatibility. Plain communication choices require explicit C4 or existing authored
C4 endpoints; causal roles and even matching labels do not infer communication.

Prospective loss codes identify reserved node/relationship meaning, authored
hotspot status, lane interpretation, unqualified containment, renaming and description
replacement. Naming a previously unlabelled edge is not the loss of an authored
label. Source IDs, port IDs, direction, world coordinates, grouping, appearance,
host data and original meaning remain in detached source provenance. Existing
membership is not declared valid C4 containment.

## Verification

```sh
bun test packages/foldkit-zloz/test/event-storming-c4-preview.test.ts
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
```

The independent literal workshop fixture exercises source-ordered decisions,
explicit choices and retention, no inferred scope/structure/communication,
compatible existing C4 endpoints, blocked retained/unresolved/DDD endpoints,
nonincident/foreign/duplicate choices, malformed descriptors/fields/labels,
kind constraints, both authored hotspot statuses, lane/membership/description/name
losses, empty input, deterministic output, complete history/fork provenance,
session/revision identity and deeply frozen detached choices/source. Actual later
caller edits cannot rewrite preview data. Existing DDD/workshop regressions pass
with the focused preview tests.

The real packed consumer imports the function and public Source/Preview types,
proposes an explicitly external C4 system, leaves the lane unmapped and verifies
meaning-loss/provenance detachment. It installs local tarballs; it does not publish.

The first test run recorded the absent public export. Early static checks exposed
TypeScript array narrowing and validation-helper lint problems; these were corrected
without casts or rule suppression. A temporary mutation removing the C4 endpoint
guard caused **two behavioural tests to fail**; restoring it returned the suite to
green. A separate failing test reproduced the false label-loss report for an
unlabelled edge; the fix retains actual label-replacement findings. These failures
are development evidence, not passing qualification.

## Review and limits

Architecture/boundary, delivery and test-quality review are **self-review**. Core
only depends on existing architecture, graph errors and model-document capture.
No new dependency, schema, wire version, UI peer, persistence or mutation path.
Advisory compatibility is limited to authored C4 endpoints and valid descriptors;
it does not establish protocol, deployment, containment or architecture correctness.
Complete source capture deliberately retains the history/fork review context.

Future workbench review, conversion planning, explicit containment resolution,
exact-plan loss acknowledgement, live policy/lifecycle checks and atomic Undo
remain separate. No full D1b/C/Q/R closure, hosted CI/deployment, user acceptance,
registry verification or npm publishing is claimed by this local package slice.

Final checks completed locally with exit 0: `bun typecheck`, `bun run check`,
`bun run test`, affected-core typecheck and API docs. Existing configured lint and
Astro warnings/skips remain; this is not a warning-free claim. No dependencies,
package versions, deployment or registry state were changed.

Recommendation: **needs review**. The approved headless preview slice is complete.

Workbench follow-up: [ADR 0085](../../../docs/adr/0085-compose-c4-mapping-workbench-review.md)
and the [visual qualification](../../../apps/zloz-demo/evidence/c4-mapping.md)
now cover host review controls. The headless API and its no-conversion/no-Apply
boundary remain unchanged; this original package receipt is retained.
