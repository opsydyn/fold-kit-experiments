# Native v3 Mermaid qualification

- result: complete
- claim: Native full-document Mermaid export reports group socket/attachment loss, retains native identities and gates exact-output downloads with current review consent/policy.
- evidence: Native/legacy unit and installed consumer contracts, optional SSR slots, workbench tests and source-hashed production browser/download/oracle evidence; details below.
- remaining uncertainty: Static lossy projection only; no production import/runtime rendering, native packets, remote CI/hosting/registry, broad performance or human device/AT acceptance.
- next: Native v3 modelling-patch dry run with source/provenance/capability preservation before Apply.

[ADR 0113](../../../docs/adr/0113-export-native-v3-mermaid-with-exact-loss-review.md)
records alternatives and scope. Architecture, boundary, delivery and test-quality
reviews are self-review. Boundary verdict: **safe with noted risk**. Core owns
complete document validation; the optional adapter owns a bounded static
projection/review; host Model/messages/Commands own current policy and IO. No
canonical wire or dependency versions change. Core's optional Foldkit theme
mapper is shared by the adapter instead of duplicating token vocabulary.

## Qualified behavior

- Full native v3 document validation, not group-port stripping or a legacy bare
  graph call. Shared encoding/traversal/source limits preserve old outputs. Native
  bundle identity uses nodeId/edgeId, hierarchy and scoped port IDs/kinds/endpoints;
  mode/capability/world convention stay explicit, without hidden full graph data.
- Group socket artwork/anchors/details and exact attachment are declared losses;
  group endpoints become boundary links. Camera, geometry, future rules and omitted
  semantic/data fields stay explicit. Losses reject by default; report yields only
  a candidate. Invalid data/options/labels, empty groups and source limits remain
  errors, with no partial consentable value. Native bundle/identity records are frozen; option
  accessors do not execute.
- Consent covers full native source, scope/revision, direction, name and exact
  output/findings. Current protection applies before payload creation. Settings
  reset generation/acceptance; pending run guards, failure/retry and stale replies
  cannot grant output or overwrite newer feedback. Export does not change authored
  data, editor revision or Undo. A dispatched download cannot be revoked later.
- Optional native controls retain findings and denial in minimal mode. Safe
  keyword/literal highlighting uses HtmlBuilder text nodes, with no executable
  markup/parser runtime. Nullable slots/custom findings/layouts and headless
  primitives allow replacement. Read-only edition export has independent consent.

## Observed local verification

Bun 1.4.4 / Node 24.15.0, 2026-11-16:

- Targeted tests qualify exact source/identity, strict/report policy, native loose
  same-kind endpoints, capability-only changes, full-source/setting/scope/live
  policy guards, retry, stale runs, no-op IO publication, safe SSR/highlighting and
  custom slots. New native export tests first failed because the API did not exist;
  implemented behavior then passed. Legacy subgraph/export tests retain their
  exact source and error expectations.
- `bun typecheck`: all workspace typechecks exit 0. `bun run test`: all workspaces
  exit 0, including **931 core tests**, **56 Mermaid tests** and **200 workbench
  tests**. Installed peer-free Node/Bun, strict Bundler/NodeNext native contracts
  and optional actual SSR controls all pass. Existing conditional skips remain;
  no tests were disabled. A focused adapter typecheck covers final view refinements.
- Root `bun run check` covers lint/format/catalog/skills; existing repository
  warnings, including the Viz skill version warning, remain distinct. The browser
  receipt is formatted after capture. API docs exit 0 with warnings treated as
  errors; the production demo build exits 0 with four static routes.
- Chromium 151.0.7922.34, 1440×1000, reduced motion: five interaction groups pass
  with zero page errors or external requests. Actual boundary connection source
  has socket and attachment findings. Exact consent gates the native bundle;
  downloaded source equals the highlighted preview, and saved JSON bytes equal
  the returned reviewed bundle serialization. Direction changes need fresh consent.
- Light LR / dark TB output and read-only edition bundles retain native metadata.
  Current protection blocks download in minimal mode while required findings and
  reasons remain. Full canonical model downloads before and after exports are
  identical; an authored movement invalidates review even when Mermaid source
  stays unchanged, and one Undo restores the complete pre-export model.
- Pinned Mermaid **12.3.0** public parse/render independently accepts **11** native
  sources with asserted real SVG cluster/edge counts: LR/RL/TB/BT boundary links,
  boundary→boundary/child/self, nested loose endpoints, encoded group labels and
  actual light/dark downloads. The renderer is test-only, from ADR 0007's existing
  installation. Its entry SHA and oracle case source SHAs are recorded. This is
  syntax/render qualification, not authored canvas/socket visual fidelity.
- **177 source hashes** bind relevant core/adapter/app source; six raw download hashes
  bind exact bytes. Raw JSON downloads are archived as `.txt` to preserve wire
  formatting. Oracle SVG is saved separately. The script closes its owned server
  and Chromium; no product Mermaid runtime or provider is activated.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-mermaid/browser.json) ·
[Light source review](../../../apps/zloz-demo/evidence/v3-mermaid/light-review.png) ·
[Dark source review](../../../apps/zloz-demo/evidence/v3-mermaid/dark-review.png) ·
[Minimal protected](../../../apps/zloz-demo/evidence/v3-mermaid/minimal-protected.png) ·
[Independent render](../../../apps/zloz-demo/evidence/v3-mermaid/oracle-render.png) ·
[Light bundle](../../../apps/zloz-demo/evidence/v3-mermaid/native-light-lr.txt) ·
[Dark bundle](../../../apps/zloz-demo/evidence/v3-mermaid/native-dark-tb.txt) ·
[Edition bundle](../../../apps/zloz-demo/evidence/v3-mermaid/native-edition-tb.txt).
Captures were visually inspected. The adjacent `v3-mermaid-browser.mjs` accepts
`ZLOZ_MERMAID_ORACLE` pointing to the pinned Mermaid package directory; default is
the private fidelity experiment's local node_modules installation. No install is
performed by the evidence script. Raw before/after/Undo model files are adjacent.

No fresh empty-cache CI rehearsal, remote CI, registry publication or hosted
deployment was performed. Other Mermaid versions/themes/layouts, custom renderer
appearance, broad performance and human physical-device/screen-reader acceptance
remain unqualified. V1/v2 CLI writer/packet/reader paths remain fixed; native v3
packet/receipt/audit and modelling-patch work is not completed by this export.

Recommendation: **needs review** before PR/merge. Next: native v3 modelling-patch
review/dry run, preserving capabilities/provenance before exposing Apply.
