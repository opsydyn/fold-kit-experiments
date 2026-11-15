# Headless C4 conversion planning — local qualification

- result: complete
- claim: core builds complete, immutable C4 conversion plans with explicit membership/containment, source provenance and exact-plan loss consent before Apply.
- evidence: full workspace typecheck/tests and API docs passed; final affected-core typecheck and 619 tests passed, including 18 new plan tests and the installed-package TypeScript/runtime consumer. Root lint/format passed with existing configured warnings. Both targeted mutations were detected.
- remaining uncertainty: the check qualifies local role/kind/cycle declarations, not global architecture correctness, diagram layout, workbench plan controls, live Apply policy/Undo, receipts, hosted CI or publication. No npm publishing or deployment.
- next: compose placement decisions, current provenance, blockers and exact loss acknowledgement in the workbench before adding guarded atomic Apply.

## Contract

[ADR 0086](../../../docs/adr/0086-plan-explicit-c4-conversion-and-containment.md)
defines immutable advisory plans and fresh-source loss consent. Core reuses the
C4 preview; no host/app mapper, target graph, editor event, Apply permission,
conversion receipt, new wire format or runtime dependency is introduced.

Every proposed node and every direct member of a reinterpreted lane requires
explicit placement. Retained notes and existing non-workshop members are included;
unrelated source nodes cannot be moved through this conversion contract. Root,
retained non-C4 organization and declared C4 containment are distinct decisions.
The local containment check permits system/container and container/component role
pairs with existing group boundaries, without promoting ordinary cards or claiming
global ownership correctness. These rules follow the
[C4 abstraction hierarchy](https://c4model.com/abstractions); no ownership, protocol,
visual enclosure or layout is inferred outside that bounded declaration check.

Root detachment preserves world coordinates and explicitly removes/discloses
parent-dependent settings. Authored false remains distinct from absence. Combined
parent choices are checked for cycles. A private complete projection must satisfy
existing graph invariants before reviewable changes are returned. Blocked plans
return findings without a partial change list. All-retained/empty plans are unchanged.

Complete source camera, editions, ancestry, ports, direction, geometry, appearance,
host data and original meaning remain in detached frozen provenance. Plan loss
findings replace the preview's generic membership warning with decision-specific
placement/constraint/containment findings; raw preview data remains unchanged.
Exact-content consent is rebuilt against current source/options and may be revoked
with null. Keys contain source data; they are not credentials or human/Apply proof
and must not be logged or rendered in the DOM.

## Verification

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
bun run --filter @opsydyn/foldkit-zloz typecheck
bun run --filter @opsydyn/foldkit-zloz test
```

Eighteen focused plan tests cover:

- Unresolved mappings/relationships/membership and no partial changes; exact
  retention and empty-source no-ops.
- Root detachment, authored extent/false expansion settings, frozen world geometry,
  ports/data and complete model/edition/fork provenance.
- Non-C4 organization versus explicit containment, all direct members of changed
  boundaries, existing non-workshop members and refusal to infer retained notes as
  runtime children.
- System/container/component role pairs, ordinary card/group distinction, missing/
  incompatible parents, combined cycles and a complete nested hierarchy in source
  order even when children precede their parent in the source array.
- Strict malformed/duplicate/foreign choice rejection, source scope checks,
  affirmative exact-plan consent, revocation, source/model/revision/camera/data/
  edition/ancestry/mapping/placement freshness and both hotspot statuses.
- Immutable detached source/choices, no caller freezing and complete plain
  communication replacements with original endpoints/bends/data retained.

The real installed consumer imports the builder, resolver and public plan/options/
consent types, creates a reviewable explicit organization plan and checks consent
and revocation. A negative TypeScript fixture rejects a blocked decision carrying
`choice-required`: missing intent is unresolved, not a supplied-but-blocked choice.
Local tarballs are installed for qualification; nothing is published to npm.

The first run recorded the missing public export. Early static checks exposed a
placement union whose combined root/organization tag prevented proper narrowing;
it was split into explicit variants. Parent-ID checking was moved into a typed
nonempty-ID predicate to satisfy the existing boundary lint rules, without casts
or rule suppression. A final nested-test filter did not narrow a compound union in
TypeScript; a narrowing flatMap corrected it without a cast. Those failures are
development evidence, not passing checks.

Two temporary mutations tested consequential boundaries: removing direct-member
coverage caused **three tests to fail**; bypassing exact plan-key equality caused
**three tests to fail**. Restoring both returned the suite to green. Architecture,
boundary, delivery and test-quality review are **self-review**, not an independent
review or a proof of complete C4 architecture correctness.

## Remaining boundaries

This is package-level review data, not Apply. A future workbench plan review must
expose placement choices, current provenance, blockers and exact loss acknowledgement.
A future transaction must independently recheck live source/session/revision,
policies, lifecycle, containment, consent and one atomic Undo, then retain source
provenance. No broader D1b/C/Q/R closure, user-task acceptance, performance budget,
hosted CI/registry qualification, npm publishing or deployment is claimed.

Final full-workspace checks completed locally with exit 0. The final nested case
and stronger public type were followed by an affected-core typecheck and complete
**619-test** package run, including the real installed consumer; API documentation
was generated successfully. Existing configured warnings/skips remain and are not
reported as warning-free qualification.

Recommendation: **needs review**. The approved headless plan/consent slice is complete.

Workbench follow-up: [ADR 0087](../../../docs/adr/0087-review-c4-placement-and-exact-losses.md)
and [visual qualification](../../../apps/zloz-demo/evidence/c4-plan.md) now cover
placement review and exact acknowledgement. The package plan remains advisory;
guarded atomic Apply and retained receipts are still separate. This original
headless receipt is retained.
