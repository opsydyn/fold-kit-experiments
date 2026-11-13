# Opt-in descriptor preview layout qualification

- **result:** complete
- **claim:** the approved opt-in ELK slice lays out only a detached descriptor
  preview, preserving source identity/projection/findings and working model/Undo.
  Core exposes geometry-only read-only layout; native workbench controls arrange,
  cancel, select direction and restore original geometry.
- **evidence:** three new core boundary tests, eight real ELK tests including a
  grouped-option regression, 121 workbench tests, installed Node/Bun strict consumer
  qualification, root typecheck/check/all tests, package checks and production build.
  Local Chromium lazy-loading/cancel/layout/restore/navigation checks and inspected
  light/dark captures. Architecture, boundary and test-quality reviews: **self-review**.
- **remaining uncertainty:** cancellation discards results rather than interrupting
  default in-process ELK computation. Large-diagram latency/memory, worker lifetime,
  other browsers/devices, manual AT and hosted acceptance remain unobserved. Label
  dimensions are not supplied to ELK; dense/custom labels can still overlap. Source
  authorship and SDK/core publication gates remain unchanged. Nothing was published.
- **next:** package-level label bounds in layout requests so ELK can reserve space
  for edge labels/badges. Recommendation: **needs review**.

## Core and adapter boundaries

`applyPreviewLayout` shares geometry validation with ordinary `applyLayout`, while
requiring a read-only editor and preserving past/future. A successful geometry
publication advances preview revision, cancels stale fit animation, keeps current
selection and copies positions/group sizes/routes. It never accepts engine-authored
labels, IDs, ports, parentage, architecture or data. Request ID, active revision and
idle gesture checks reject stale work. Invalid current geometry fails atomically.
Normal editing still appends one Undo and remains blocked on read-only editors.
Installed Node/Bun consumers exercise the actual new core export and real ELK.

The workbench keeps request/run/direction/display state inside the review. A Command
lazily imports the existing ELK adapter. Only a matching active result is published;
cancellation, replacement, text/file input, Restore and actual preview navigation
invalidate pending results. Measurements may update without invalidating geometry.
Errors preserve the last valid preview. Restore uses the immutable projection's
original positions/group bounds with empty routes, through the same core API.
Finding requests remain valid because source identity does not include presentation
coordinates. Descriptor/projection/findings and working model/history retain their
references; the detached editor stays read-only.

Visual inspection found grouped children still using a 20-unit inter-layer gap
instead of configured spacing. A failing real-engine regression reproduced it;
root and group containers now receive the same direction/spacing/algorithm/routing
options. The fixed test asserts at least 160 units inside a boundary for RIGHT and
DOWN. Existing nested-boundary containment, exact route endpoints, architecture
anchors and all-side custom hints still pass. This follows ELK's parent-scoped
[direction](https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html)
and [layer spacing](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-spacing-nodeNodeBetweenLayers.html)
contracts. No dependency or package version changes were made.

## Browser and visual evidence

Chromium verifies ELK is not fetched when a descriptor opens. The test delays the
real built ELK asset, activates Arrange/Cancel with Enter, confirms no geometry is
published, then permits the asset and submits a newer request. Real RIGHT/DOWN
layouts retain all node IDs, 23 source facts and nine findings. Finding Reveal
still selects targets after layout and after exact restoration. Both directions
restore to original node coordinates; source/projection and canonical working-model
preservation are additionally checked at the update boundary.

The native action remains focused as it changes between Arrange/Cancel. Direction
and Restore have explicit availability. Minimal mode retains layout/finding actions.
The test also retains invalid-input/UTF-8 recovery and exact canonical model/lineage
equality after close. No page errors or external network requests were observed.

The first delayed-module harness removed its route before continuation, producing
an already-handled route error; it now retains the handler until the run ends.
An immediate DOM coordinate assertion after Restore was corrected to await the
expected render. Lint caught two conditional empty spreads; code now uses explicit
owner fields. No validation, lint rule or compatibility gate was weakened.

[Browser receipt](alchemy-layout-browser.json) ·
[Reproducible script](alchemy-layout-browser.mjs) ·
[Light ELK controls/preview](alchemy-layout-light.png) ·
[Dark relation/ELK preview](alchemy-layout-dark.png).

Captures were inspected for neutral/blue family themes, readable source nodes,
orthogonal routes, visible read-only/Fit/return controls, source/finding feedback
and an independently scrolling sidebar. Group option propagation visibly improves
spacing; universal label placement is explicitly not claimed.

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz-elk typecheck
bun run --filter @opsydyn/foldkit-zloz pack:check
bun run --filter @opsydyn/foldkit-zloz-elk pack:check
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/alchemy-layout-browser.mjs
```

All exited 0. Existing advisory warnings/skipped tests remain. These are local
package/browser checks, not CI, provider execution, publication or deployment.
See [ADR 0070](../../../docs/adr/0070-layout-detached-descriptor-previews-with-elk.md).
