# Workshop SVG and PNG — local qualification

- result: complete
- claim: canonical built-in SVG preserves workshop external-system/port, lane-frame and authored hotspot status artwork; PNG uses the identical reviewed projection.
- evidence: literal-wire and installed-package tests, production workbench downloads in light/dark, exact rasterizer Blob equality, independent full RGBA comparison, accent-pixel assertions, source/status/theme freshness and Undo. See commands and artifacts below.
- remaining uncertainty: this qualifies canonical workshop role/status artwork in local Chromium. Custom native badges, semantic edge notation, system-font wrapping/ink bounds, broad label layout, other browsers/devices, manual assistive-technology use, hosted CI and publication remain separate. No npm publishing or deployment.
- next: define the headless EventStorming-to-C4 mapping preview with explicit choices, provenance, ambiguities and losses before conversion or Apply.

## Scope and review

[ADR 0083](../../../docs/adr/0083-qualify-workshop-portable-artwork.md) supersedes
only the unqualified built-in workshop artwork guard. The writer now emits labelled
dashed external-system and lane outlines, native authored geometry and participant
ports. Portless hotspots/lanes remain portless. Hotspots always carry their authored
Open question/Resolved text, alongside the matching theme accent. Host token
replacements are honored; text/description escaping, font coverage and primitive
limits remain on the existing safe writer path. Graph, lineage and Undo are unchanged.

The workbench deliberately uses Discuss · open / Agreed · resolved custom native
badges. Export review declares their substitution with canonical status text as a
loss. No custom renderer equivalence is inferred. Existing semantic-edge fallback,
font and bounds findings remain visible. PNG adds rasterization loss. Both formats
require explicit exact-artifact acceptance and use the same portable source theme.

Architecture, boundary, delivery and test-quality review are **self-review**. Core
owns projection, the optional browser entry owns raster resources and Astro composes
public review APIs. No new runtime dependency, schema, persistence, permission or
mutation path. Default/system font measurements do not become qualified merely
because an image decoded successfully. Visual review confirms readable workshop
status text and distinct frames; existing port/edge labels are crowded in this
starter, covered by the retained layout/fidelity limitations rather than a broad
claim of label-layout parity.

## Reproducible checks

From the isolated worktree:

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/workshop-export-browser.mjs
```

Full workspace typecheck and tests passed, including **589 core tests** and the
installed-package consumer. Focused export regressions passed (36 tests before
the final palette/budget assertion strengthening; the final four workshop export
tests also passed). Root lint/format checks passed with existing configured warnings.
Final public-browser projections are 1120 × 700 in both themes. Exact-colour pixel
counts (open/resolved/external) were 1110/1079/420 in light and 1138/1094/420 in
dark, with full RGBA and Blob equality and zero page errors. Workbench downloaded
SVG/PNG pairs also pass independent full RGBA equality checks.

Run builds and installed-consumer tests sequentially: package build cleanup replaces
shared dist chunks. The initial overlapping evidence rebuild failed module resolution;
it was rerun after workspace tests, not treated as product or browser success.
The first focused test reproduced the old unsupported workshop guard. Tests now
check independent literal status/theme expectations, host palette overrides,
ports/frame identity, immutable source, escaping, explicit custom-loss consent and
primitive-budget rejection. Resource-limit assertions check the actual budget finding.

The browser script serves the production bundle on a temporary localhost port and
closes it on completion. It checks disabled downloads before consent, exact preview/
download PNG bytes, both themes, cleared consent/PNG on status or theme changes,
resolved export text and one Undo restoring the original model/lineage.

For each theme, the public browser API captures the actual Blob passed to the PNG
image decoder and asserts exact equality with the reviewed SVG. It independently
decodes that SVG and compares every RGBA byte with the output PNG. Nonempty hotspot
and external-system accent regions prevent blank-reference success. Old-status and
old-theme expectedSvg inputs reject with source-changed. The editor remains identical.

The first browser attempt used an incorrect region locator; the DOM uses an explicit
data attribute. After correcting the locator, an exact-colour assertion exposed
antialiasing of the 1.5px external-system outline. Workshop outlines now use a crisp
2px stroke. Final qualification reruns the actual output rather than weakening the
colour check. These initial attempts are failures, not passing evidence.

## Artifacts

- [Light SVG](workshop-export-light.svg) and [matching PNG](workshop-export-light.png).
- [Dark SVG](workshop-export-dark.svg) and [matching PNG](workshop-export-dark.png).
- [Both hotspots resolved after an authored edit](workshop-export-resolved.svg).
- [Light workbench](workshop-export-workbench-light.png) and [dark workbench](workshop-export-workbench-dark.png), with visible loss review and the canvas.
- [Browser assertions](workshop-export-browser.mjs) and [final result](workshop-export-result.json).

Recommendation: **needs review**. This is a committed local qualification slice,
not a release, hosted acceptance, full EventStorming vocabulary or D1b/C/Q/R closure.
