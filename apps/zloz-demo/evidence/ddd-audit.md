# DDD audit review and comparison — local qualification

- result: complete
- claim: the approved DDD convention audit workflow now includes package-owned standalone/edition review, baseline deltas, fresh guarded node/edge navigation, Effect CLI comparison and a light/dark workbench demo.
- evidence: literal model/delta tests, native/custom FoldKit views, installed Node/Bun consumers and process transcripts, workbench update tests, Chromium screenshots and repository verification below.
- remaining uncertainty: no universal DDD correctness, new topology rules, DDD packets, wider workshop roles, C4 conversion, comprehensive manual accessibility/device acceptance, performance budgets, hosted/CI or registry qualification is established here.
- next: define D1a workshop semantics for external systems, hotspots and lanes before adding renderers; keep compatibility and release gates explicit.

## Contract and boundaries

[ADR 0080](../../../docs/adr/0080-complete-ddd-audit-review-and-comparison.md)
records the approved combined slice, extending the headless audit and CLI audit.
DDD meaning stays in the existing core resolver/catalogue. Comparison and controls
are pure core exports; optional FoldKit views use the host builder. Effect CLI owns
bounded transport/JSON/exit behavior, and Astro composes the public APIs.
No dependencies, wire-format migrations, source rewrites or permission to Apply.

`compareModelDddRelationships` selects owned baseline/target editions or explicit
current data under one catalogue. Unknown selectors block, including origin-only
editions. Findings match edge ID and code; changed codes resolve and introduce;
persisting retains both projections. No-new-findings is not target compatibility.
Deterministic UTF-16 edge ordering and detached data retain the audit contract.

`resolveDddAuditControls` also reviews a single current/edition target with no
baseline. Standalone entries use kind current with explicit source identity.
`resolveDddAuditRequest` checks live model/selection/category/filter/policy and exact
finding data token before returning an explicit source and node/edge reveal event.
The token is freshness data, not authority. Source/target navigation resolves node
IDs from the live finding; the request does not inject arbitrary node IDs.

Composable native views expose labelled selectors, filters, status, visible reasons
and edge/source/target buttons. Every part can be replaced/omitted; layout and count
visibility remain host-owned. Custom cards reuse public button primitives. Counts
are optional diagnostics; reasons and navigation remain available in Minimal mode.

`ddd compare` adds protocol-v1 operation ddd-compare, model-editions scope,
convention filename provenance, exact core deltas and introduced-only diagnostics.
Exit 0 means no regression, 1 introduced findings, 2 invalid input/catalogue/selector
or invocation. Expected input outputs use one JSON stdout record; invalid invocation
uses JSON stderr with empty stdout. Existing audit compatibility exits and causal
commands are unchanged. Custom files replace the catalogue and are validated before
model reading. Existing 1 MiB UTF-8 limits apply independently to model and rules.

## Reproducible evidence

- [Literal model fixture](../../../packages/foldkit-zloz/test/fixtures/ddd-review-model.json)
  and [core tests](../../../packages/foldkit-zloz/test/ddd-audit-review.test.ts):
  independently expected 2 introduced, 3 resolved, 1 persisting; same/reverse/archived
  targets; custom catalogues; invalid selectors; owned origin boundary; exact
  stale/filtered/policy denial; unchanged source and detached projections.
- [View tests](../../../packages/foldkit-zloz/test/ddd-audit-controls-view.test.ts):
  selected source identity, visible convention/protection reasons, 18 native guarded
  navigation buttons, standalone review, count-free defaults and custom/omitted parts.
- [Installed core consumer](../../../packages/foldkit-zloz/test/package.test.ts):
  real tarball runtime comparison/navigation without UI peers, strict type rejection
  of Apply, optional FoldKit custom rendering and Bundler/NodeNext declarations.
- [CLI tests](../../../packages/foldkit-zloz-cli/test/commands.test.ts) and
  [installed binary](../../../packages/foldkit-zloz-cli/test/package.test.ts): exact
  deltas and operation narrowing, 0/1/2 including persisting incompatibility, custom
  rules, missing/unknown selectors, non-model and malformed input, one-record
  stdout/stderr framing under actual Node and Bun. Existing input-limit, UTF-8,
  file preservation, invocation and interruption tests remain unchanged.
- [Process script](../../../packages/foldkit-zloz-cli/evidence/ddd-comparison.mjs)
  and [16-result transcript](../../../packages/foldkit-zloz-cli/evidence/ddd-comparison-results.json):
  actual Node/Bun exits, independent expected delta identities, custom convention,
  input/selector rejection and byte-for-byte fixture/catalogue preservation.
- [Workbench tests](../test/ddd-audit.test.ts): correct read-only side for edge/source/
  target, standalone current review independent of history camera, stale model/epoch,
  hidden/busy/filtered input, paused playback and unchanged graph/revision/Undo.
- [Browser script](ddd-audit-browser.mjs), [result](ddd-audit-browser.json),
  [light](ddd-audit-light.png) and [dark](ddd-audit-dark.png): actual production app,
  custom cards, selected sources, current/edition/same-edition review, Enter focus,
  all three navigation subjects, filter preferences, Minimal/global diagnostics,
  retained reasons, playback pause/old timer, model download and existing Undo.
  Browser screenshots were visually inspected. This is Chromium automation with
  reduced-motion coverage, not a human screen-reader or physical-device pass.

The red core test failed on the missing public comparison export before
implementation (`/private/tmp/zloz-ddd-completion-red.log`). An early lint run
required the existing safety comment for an internal typed request carried through
Schema.Unknown; fixed without suppression. The first browser assertion used a
paraphrase of the existing core reason; it was corrected to the actual core wording,
then the complete flow reran. A process transcript attempt observed an unexpected
exit during concurrent workspace builds; the isolated rerun passed. Failed runs
are not counted as evidence of success.

## Verification

Focused tests: 6 core/view tests, 59 assertions; 130 workbench tests; 570 complete
core tests; 27 CLI tests including installed binaries. Counts are local observations,
not coverage percentages. Existing advisories/configured skips remain.

Final host-captured commands (all required before commit):

- `bun run check` — lint, format, catalog and skill checks.
- `bun typecheck` — all workspaces.
- `bun run test` — root tooling and all workspaces.
- `bun run --filter @opsydyn/foldkit-zloz docs` — API reference generation.
- Workbench production build and browser evidence script.
- Process evidence script, local links and `git diff --check`.

Logs are `/private/tmp/zloz-ddd-completion-{check,final-types,final-tests,docs,demo-build,process}.log`.
Generated API output is ignored. Tarball installation is local qualification,
not publication. No npm package, deployment or external integration was activated.

## Self-review

Architecture/boundary: **safe with noted scope limits**. Family-specific contracts
preserve causal compatibility; UI/CLI do not invent rules or own graph state.
The deliberate cost is parallel DDD comparison/control vocabulary rather than a
new generic cross-family framework. Source identities remain explicit.

Delivery: D2 is complete for authored conventions and audit/review/deltas. New
catalogue semantics, DDD packets and D1/C/Q/R remain separately scoped. Workbench
examples add owned editions without replacing the working model or Undo.

Test quality: independent literal delta expectations detect swapped sides, code-only
identity errors, wrong ownership, regression/compatibility exit confusion and stale
navigation. Actual tarball/process/UI paths complement pure tests. Existing failure,
byte-limit and interruption tests are retained; no timeout or assertion was weakened.
No independent/delegated agent or live-user research was used.

Recommendation: **needs review** for the combined implementation; no publication.
