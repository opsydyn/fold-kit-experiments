# Workshop conversion plans and consent — local qualification, 2026-11-11

result: complete

claim: The headless Zloz package defines immutable conversion review plans with full
source provenance, source-session/revision scope, whole-plan blockers, same-ID
semantic replacements and explicit exact-plan all-loss consent. No Apply occurs.

evidence: Nine focused behavior tests, packed root consumers and sequential root
qualification described below. Final workspace/documentation commands exited 0.

remaining uncertainty: Local package evidence only; no UI consent integration,
Apply executor, provenance storage format, authenticated/human approval guarantee,
large-model performance qualification, publishing or deployment. Review roles are
self-review.

next: needs review; then compose plan provenance and exact-plan loss acknowledgement
in the workbench mapping review before implementing Apply.

## Scope and ownership

Continued from `b019c5d` in isolated `codex/zloz-context-map`. See
[ADR 0043](../../../docs/adr/0043-plan-workshop-conversion-and-loss-consent.md).
The dependency-free root composes existing source model capture, mapping preview
and DDD conventions. No app, adapter, graph/model codec, dependency or version changes.

`createEventStormingDddConversionPlan` captures the complete original document and
host-owned source scope. Its frozen provenance preserves original graph/host data,
camera, identity/name, editions and fork ancestry independently of the proposed
same-ID descriptor replacements. It does not assign a new model origin. The source
can be reconstructed using model v1 JSON; persistence of conversion provenance is
an explicit future Apply decision.

Unresolved intent blocks the whole plan and exposes no partial change list.
Explicit retention remains a review choice, not a claim that retained causal links
satisfy a future host policy. A resolved plan is reviewable or unchanged. No converted
graph or editor event is returned.

`resolveEventStormingDddConversionConsent` rebuilds from the current source/options,
then checks the host-recorded affirmative consent against the entire exact plan.
This binds source, scope, targets, effective conventions, choices and loss reasons,
not merely loss IDs. Null represents cleared consent. A matching record never
bypasses blockers or grants edit permissions. The key contains source data and is
neither a hash nor a portable/authenticated capability; keep it out of logs/DOM.

## Test and review evidence

The first focused test failed because the new API did not exist. Nine tests now
exercise the production root API with independent fixture outcomes:

- Full source provenance, same-ID node/edge replacement values, retained descriptions,
  deterministic keys and unchanged serialized source/editor history.
- Explicit affirmative consent, null/false rejection and changed review key.
- Consent invalidation on source ID/name/content/camera/history/ancestry or session
  and revision changes.
- Changed mapping origin, target descriptions and effective convention catalogue,
  even when disclosed loss IDs remain identical.
- Ambiguous/unmapped intent and incompatible edge blockers, which acceptance cannot
  override; explicit retention and empty/all-retained unchanged plans.
- Mutable caller data, role arrays and conventions cannot alias frozen plan values.
- Invalid scope/document/choices/catalogues reject before producing a plan.
- Original provenance round-trips through the existing independent model codec.

Packed Node/Bun consumers exercise the real installed root API. Bundler/NodeNext
fixtures check public types, affirmative-only consent and the absence of a converted
plan graph. No workspace-link-only qualification is claimed.

Type qualification initially caught the shared descriptor-copy helper's wider
return union and a blocker-filter narrowing issue. A local DDD narrowing helper
and expression-local blocker branches fixed those without casts. Lint caught inline
runtime type checks; source scope now has an explicit type guard, with no rule
suppression. Negative-consent fixture annotation placement was also corrected.

Architecture/delivery/test-quality self-review: boundary **safe with noted risk**.
The plan is session review data, not an executor, authorization, provenance storage
or proof of human intent. A future atomic Apply must compare live source/scope,
recheck live policies/lifecycle/Undo and loss consent, and retain provenance. Tests
would not detect a defect in that unimplemented transaction; no such claim is made.

## Final verification

Host-captured results against this isolated worktree:

- Baseline `bun typecheck` and `bun run check`: exit 0 before edits.
- `bun test packages/foldkit-zloz/test/event-storming-ddd-conversion-plan.test.ts`:
  9 pass, 0 fail, 66 assertions.
- Final `bun run check`: exit 0, with existing/advisory warnings retained.
- Final `bun typecheck`: exit 0 across all workspaces.
- Final `bun run test`: exit 0 across all workspaces. Zloz core: 389 pass, 0 fail,
  including real packed Node/Bun consumers and Bundler/NodeNext type fixtures.
  Existing skipped tests elsewhere remain skipped.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0; both new root functions
  appear in the generated API reference.
- Final evidence formatting followed by another root check and `git diff --check`:
  exit 0.

Final root checks, tests and docs ran sequentially after the last source change.
No browser evidence is claimed for this headless slice. No publishing, push, PR,
merge or deployment was performed.
