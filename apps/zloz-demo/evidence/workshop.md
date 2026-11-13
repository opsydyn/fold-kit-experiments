# Native workshop renderers and controls — local qualification

- result: complete
- claim: reusable FoldKit renderers and guarded role/status controls now cover external systems, hotspots and lanes, with scoped themes, custom content, semantic descriptions, portless protection and a workbench demo preserving Undo.
- evidence: core/view/update tests, actual installed consumers, production Chromium keyboard/protection/diagnostics/history flow and inspected light/dark captures, workspace checks and API docs below.
- remaining uncertainty: native portable SVG/PNG artwork, physical-device/manual AT acceptance, custom-select platform keyboard behavior, performance budgets, current CI/hosted/registry qualification and publication are not established here.
- next: qualify portable workshop SVG artwork/status fidelity through the existing export review boundary, then verify PNG consumes the same projection.

## Contract and ownership

[ADR 0082](../../../docs/adr/0082-compose-workshop-renderers-and-controls.md)
extends the [headless semantics](../../../packages/foldkit-zloz/evidence/event-storming-workshop.md).
Core owns the pure starter, live edit decisions and ordinary editor/history events.
FoldKit owns optional node/lane artwork and composable control primitives. Astro
composes public APIs, sample protection policies and custom status badges.

`zlozEventStormingNode` renders external systems and open/resolved hotspots;
`zlozEventStormingGroup` renders native portless lanes. Existing geometry, sockets,
selection, keyboard drag, collapse, context/resize controls and declared/intrinsic
headers remain reusable. Static body caching excludes live policies/controls.
Content/status/body/control slots can be replaced or omitted. New scoped accent
tokens have light/dark defaults; legacy tokens remain compatible. Semantic status
is text and native handle description content, independent of numeric diagnostics.
The optional describeMeaning hook can replace/omit per-node descriptions.

`resolveEventStormingWorkshopControls/Request` scope edits to selected visible nodes,
revision and exact descriptor, and recheck current lifecycle/host policies.
Role choices have visible kind/port/policy reasons. Status/role changes preserve
description, never change kind or remove ports implicitly, and return existing
NodeArchitectureChanged events for immediate application with the same policy.
The host owns session/epoch checks. Scope data is freshness, not authority.

Default hotspot actions are explicit Open/Resolved pressed buttons with native
Tab/Enter/Space behavior. Role/status/meaning/reason/layout parts are composable;
the select helper remains available for custom controls. Pointer-based selects and
SSR semantics are qualified here; native-select keyboard attempts in the initial
Chromium run did not complete. The shipped default status actions use the verified
button path, not a claim that those select attempts passed.

Visual review found generic port-add affordances on hotspots. The shared package
capability check now blocks port additions to portless annotations/groups without
constructing an invalid graph or adding Undo. Host denials retain precedence.
The workbench omits inapplicable hotspot port controls and keeps role/status reasons
visible. This guard is usable independently of Astro.

The pure starter and Inspect demo explicitly enable the workshop convention and
sample facilitator protection. The custom badge shows Discuss · open / Agreed ·
resolved. Protection/convention switches are view configuration and do not rewrite
models; historical editors remain read-only. Legacy causal defaults and portable
packets are unchanged. Portable built-in SVG/PNG artwork remains explicitly gated;
new theme literals do not assert portable renderer fidelity. No new dependencies,
wire format, version bump, deployment, provider activation or npm publication.

## Reproducible evidence

- [Headless controls](../../../packages/foldkit-zloz/test/workshop-controls.test.ts):
  exact status event/description, one Undo and no-op, stale revision/descriptor/ID,
  kind/port reasons, hidden/collapsed/unselected/read-only/gesture/busy/policy blocks,
  and direct port-add denials with identical graph/history references.
- [Native/custom views](../../../packages/foldkit-zloz/test/workshop-controls-view.test.ts):
  pressed state, labels, policy restrictions, custom select layout and omitted parts.
- [Node/lane rendering](../../../packages/foldkit-zloz/test/event-storming-renderer.test.ts):
  legacy notes, external sockets, portless hotspot, canonical status/associated
  semantic description, collapse, custom/omitted content, matching intrinsic header,
  caching boundary and semantic content in minimal/read-only views.
- [Installed package consumer](../../../packages/foldkit-zloz/test/package.test.ts):
  actual tarball headless factory/edit/Undo runtime, strict consumer declarations,
  optional FoldKit node/lane/custom status plus controls rendered through SSR.
- [Workbench updates](../test/workshop.test.ts): public starter/convention, current
  selection, exact status/description/topology and Undo, live facilitator lock,
  stale session/epoch/selection, hidden inspector, busy import and read-only guards.
- [Browser script](workshop-browser.mjs) and [result](workshop-browser.json): actual
  production app, sockets/portless behavior, custom status, Enter with retained focus,
  Undo/model downloads, facilitator lock and unlock, port/kind restrictions,
  collapse/expand keyboard action, Minimal/global diagnostics, light/dark and
  explicit historical readonly review preserving the working graph.
- [Light](workshop-light.png) / [dark](workshop-dark.png) captures were visually
  inspected. Final starter spacing leaves room for edge labels; the inspector
  separates preference controls and omits inapplicable port-add actions.

The red test failed on the absent public controls before implementation. Initial
integration failures required matching the existing heading ID contract and a
strict return annotation in the installed SSR fixture (no production cast or
suppression). A concurrent build/test attempt had four existing Alchemy layout
failures; a sequential rerun and the complete workspace run passed. Browser runs
also exposed unsuitable status-select key sequences and a missing edition-readiness
wait; default status actions were simplified to explicit buttons and the entire
flow reran. These failed runs are not counted as successful acceptance.

## Host-captured verification

- Baseline workspace typecheck and lint/format: exit 0.
- Final workspace `bun typecheck`: exit 0; affected core typecheck reran after the
  portless guard, and workbench compilation reran in the workspace test suite.
- `bun run test`: exit 0 across root tooling and all workspaces. Core 585 pass,
  workbench 133 pass, CLI 28 pass and Mermaid 44 pass; existing configured skips remain.
- Final starter-spacing adjustment: affected controls/view/renderer tests 12 pass,
  69 assertions, followed by production build and the full browser flow.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0, local API HTML generated.
- Production workbench build and Chromium script: exit 0, no page errors.
- `bun run check`, local links and `git diff --check`: pass before commit;
  existing advisories remain, so no warning-free claim is made.

Logs: `/private/tmp/zloz-workshop-ui-{baseline-types,baseline-check,final-types,core-types,final-tests,focused,check,docs,demo-build,browser-errors}.log`.
Generated API/build artifacts remain ignored. Tarball installation is local
qualification, not registry publishing. No screenshot claims manual AT or touch
acceptance, and no superiority/performance claim is established.

## Self-review

Architecture/boundary: **safe with noted portable/acceptance limits**. No graph
truth, status mutation or Undo ownership moved into Astro. Native controls expose
fresh requests and cannot bypass port/kind/host constraints. Existing view caches,
headers and input primitives are composed instead of adding an editor runtime.

Delivery: the approved native slice is complete locally and unreleased. D1b/C/Q/R,
portable artwork and future publication remain separate. The preexisting SVG guard
is retained deliberately, not silently treated as native export parity.

Test quality: independent event/graph/Undo expectations, visible protected choices,
actual packed artifacts, real keyboard button actions and saved-model comparisons
cover consequential paths. Native-select keyboard/physical AT/device acceptance
and performance remain unqualified. No independent/delegated agent was used.

Recommendation: **needs review** for the combined implementation. Nothing pushed,
deployed or published.
