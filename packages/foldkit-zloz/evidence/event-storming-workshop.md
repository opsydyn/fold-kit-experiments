# EventStorming workshop semantics — local qualification

- result: complete
- claim: core now distinguishes external-system participants, hotspot annotations with authored status and organizational lane groups, with strict codecs, semantic projection, opt-in causal conventions and qualified preservation/loss boundaries before new renderers.
- evidence: literal wire and independent assertions; graph/snapshot/model/edition and conversion receipts; group lifecycle/Undo/policy tests; installed core consumer types/runtime; legacy/custom Mermaid packets, CLI tests, root checks and API docs.
- remaining uncertainty: new artwork, theme/status controls, workbench acceptance, annotation attachments, lane-specific layout, broader workshop vocabulary, EventStorming-to-C4 conversion, performance budgets, physical-device/manual AT, current CI/hosted/registry qualification and publication are not established here.
- next: compose external-system/hotspot/lane renderers and workbench controls using these contracts, with light/dark themes, visible status, keyboard/portless behavior, diagnostics preferences and Undo.

Native-presentation follow-up: ADR 0082 and the [workbench receipt](../../../apps/zloz-demo/evidence/workshop.md)
now qualify optional FoldKit artwork/controls. The native-decline statements below
retain their original headless-slice baseline; the portable SVG guard remains.

## Contract and ownership

[ADR 0081](../../../docs/adr/0081-define-eventstorming-workshop-semantics.md)
records this approved headless slice. Public descriptors remain in the existing
node architecture namespace; core owns reserved descriptor/kind/port validity.
The new semantic projection classifies participant/annotation/frame meaning without
creating DDD/C4 boundaries, runtime resources, causal ordering or membership stores.

External-system is an ordinary participant. Hotspot is an ordinary portless node
with required open/resolved status, authored rather than defaulted or certified.
Lane is a portless group with existing parentId, world geometry and group lifecycle.
Lane membership is organization, not aggregate ownership. Normal cascade deletion
and explicit ungrouping remain distinct; ungrouping preserves children and edges.
Existing architecture-change policies, Undo and semantic edition comparison apply.

`eventStormingWorkshopRelationshipRules` is explicit opt-in for external systems
issuing commands, handling commands and emitting events. The original default
catalogue stays unchanged to preserve builtin review-packet reproduction. Rule
schema/validation supports the new participant role but excludes annotation/frame
roles, even with roleOf delegation. Ports and permissions remain independent.

DDD preview leaves the new roles unmapped by default with specific reasons.
Explicit kind-compatible choices or retention use the existing exact-plan
consent/provenance/atomic Apply chain. Replacing hotspot meaning discloses loss of
its authored status. No implicit context/aggregate/system conversion is added.

Existing optional note artwork explicitly declines the new roles; this is a
compatibility guard, not a new renderer. Built-in SVG planning reports unqualified
workshop artwork as unsupported. Explicit SVG adapters or host-declared generic
fallback remain available with the existing fidelity mechanism; generic fallback
never silently claims to draw hotspot status. Mermaid reports omitted semantics
and retains identity, while portable packet snapshots retain complete descriptors.

Canonical wire version remains one. Legacy graphs and builtin packet fixtures
remain reproducible. Additive role support requires a new-capability reader;
older packages may reject those descriptors. No dependencies, new wire envelopes,
version bumps, external writes, infrastructure activation or npm publication.

## Evidence

- [Literal v1 fixture](../test/fixtures/workshop-v1.json) and
  [workshop tests](../test/event-storming-workshop.test.ts): six independently
  expected classifications; strict invalid role/status/field/kind/port variants;
  all canonical codecs; default versus opt-in causal coverage; roleOf guard;
  live protection, status no-op/one Undo, semantic versus layout history;
  lane movement, duplicate/clipboard ID remapping, cascade deletion, ungrouping
  and preserved world coordinates; conversion provenance/loss/consent/receipt;
  SVG unsupported versus explicit loss-declared fallback. Six tests, 73 assertions.
- [Architecture catalogue regressions](../test/architecture.test.ts) and
  [legacy note tests](../test/event-storming.test.ts) retain previous roles and
  validate the new portless preset inputs rather than relaxing graph constraints.
- [Note renderer tests](../test/event-storming-renderer.test.ts) verify all legacy
  note behavior and that new roles receive no false legacy artwork claim.
- [Installed package consumer](../test/package.test.ts) installs actual tarballs,
  executes the peer-free core projection/convention contract, rejects missing
  hotspot status and lane status at compile time, and checks consumer declarations.
- [Effect CLI tests](../../foldkit-zloz-cli/test/commands.test.ts) validate new
  descriptors, retain default convention exits, accept a literal external-system
  rule file with exact expected coverage, reject hotspot/lane causal roles and
  missing status as input errors, and preserve the rule file.
- [Mermaid/packet tests](../../foldkit-zloz-mermaid/test/workshop.test.ts) verify
  node identity, explicit semantic losses, default loss rejection, custom workshop
  packet reconstruction and the unchanged literal builtin v1 packet fixture.

The initial feature test failed on the missing semantic-projection export before
implementation (`/private/tmp/zloz-workshop-red.log`). Integration assertions were
then corrected to the existing conversion-plan, writer and packet API shapes;
those harness failures are not passes. Lint rejected an unnecessary widened helper
using typeof; the unchanged single-role helper was retained and the opt-in catalogue
composes immutable defaults instead. No suppression or test timeout was added.

## Host-captured verification

- Baseline `bun typecheck` and `bun run check`: exit 0.
- Final `bun typecheck` and `bun run test`: exit 0 across the workspace.
- Core: 577 pass; CLI: 28 pass; Mermaid: 44 pass, including installed consumers.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0, API HTML generated locally.
- Final `bun run check`, local evidence links and `git diff --check`: required pass
  before commit. Existing advisories and configured skips remain.

Logs: `/private/tmp/zloz-workshop-{baseline-types,baseline-check,focused,core,cli,mermaid,check,final-types,final-tests,docs}.log`.
Ignored local API artifacts are not published. This slice has no new visual UI;
no screenshot, browser/device or human accessibility acceptance is claimed.

## Self-review

Architecture/boundary: **safe with noted compatibility limits**. A discriminated
node union reuses existing storage/lifecycle; no parallel annotation/frame store
or runtime dependency was introduced. New roles have explicit renderer/export
qualification limits and a stable default convention boundary.

Delivery: completes the approved D1a headless contract, not renderer or D1b/C/Q/R
closure. Source/consent, topology and serialization tests cover the existing chain;
new semantics do not grant writable-agent or conversion authority.

Test quality: independent expected classifications/deltas/coverage and historical
packet data catch enum drift, missing status, accidental causal participation,
default-catalogue changes and silent export fidelity claims. Installed consumers
exercise the shipped artifact boundary. No independent/delegated agent, live-user
research, manual AT/device qualification or performance superiority claim.

Recommendation: **needs review**; renderer work is the next bounded slice. Nothing
was pushed, deployed or published.
