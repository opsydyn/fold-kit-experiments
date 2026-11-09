# Composable audit comparison controls

## result

complete

## claim

Public headless controls and optional Foldkit views let hosts choose a baseline
and target, filter causal findings, customize cards and reveal the correct source.
The workbench demonstrates these APIs in its existing left sidebar with a
connected synthetic example. Comparison identity stays independent of the camera.
The working graph, graph selection and Undo are preserved during reveal.

## evidence

- Root `bun typecheck`, `bun run check` and `bun run test` passed. The core API
  docs build and workbench production build passed. After the final example-label
  polish, the workbench's strict test check and all 58 tests passed again.
- Core tests cover explicit source routing, missing selectors, scoped identity,
  changed diagnostic codes, removed/repaired findings, hidden categories and
  global/per-finding protection. View tests exercise native selected/disabled
  semantics, unavailable choices, custom badges/layout, nullable slots and
  count-free defaults. Workbench tests cover current/historical navigation,
  same-source rapid activation, stale epochs, busy operations, playback and Undo.
- All 349 core tests passed, including real tarball consumers under Node/Bun,
  dependency-free headless imports, custom optional Foldkit composition and
  Bundler/NodeNext public type qualification. Existing CLI/adapter/workspace
  tests passed as part of the root run.
- The [browser script](audit-controls-browser.mjs) passed against the final built
  site in Chromium 151. Its [JSON transcript](audit-controls-browser.json) records
  the checks and zero page errors. Native Enter retains focus; resolved findings
  open a baseline-only edge with its actual endpoints within the canvas. Target
  selection remains unchanged. Introduced/persisting findings open the target.
  Category filters, empty state, current target, reduced-motion manual navigation,
  pause/old-tick rejection and minimal/global diagnostics behavior pass.
- Browser downloads prove that historical review preserves the working snapshot;
  an existing Undo still restores the earlier graph after returning to present.
  [Light capture](audit-controls-light.png) and [dark capture](audit-controls-dark.png)
  were visually inspected at 1600 × 1360. Both selectors, all finding categories
  and the connected diagram remain visible in the single-pane layout.
- Failing initial tests exposed the missing exports. Packed qualification caught
  an overly wide example callback type, corrected with an explicit editor-event
  return. Browser testing exposed unnecessary epoch advancement on same-source
  reveal; a regression test now protects rapid sequential activation. Harness
  assumptions about SVG hit-path visibility and toolbar location were corrected
  to test actual endpoint geometry and native edition selection.
- Architecture, delivery and test-quality reviews were self-review. Core owns
  semantic controls and request checks; the optional view owns composition; the
  app owns cameras, epochs, playback and diagnostics preferences. No dependency,
  CLI or persisted-document format change was introduced. Repository warnings
  and existing skipped tests remain; no new lint suppression was added.

## remaining uncertainty

This is local functional, packed-consumer and Chromium evidence. No new hosted CI,
deployment, npm publication, benchmark or comprehensive assistive-technology
acceptance is claimed. Findings retain the existing edge-ID/code semantics under
one convention; reveal does not repair or restore relationships. Hosts own pure
role callbacks, policies, epochs and camera application. Render-slot omission is
presentation, not a replacement for functional protection.

## next

Recommendation: **needs review** for the local commit. Next bounded slice:
portable read-only review packets combining an explicit baseline/target, audit
delta, convention provenance and loss-aware Mermaid projections for documentation
and agent workflows.
