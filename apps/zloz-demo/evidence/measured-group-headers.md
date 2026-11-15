# Intrinsic group-heading measurement qualification

- **result:** complete
- **claim:** C4/DDD intrinsic headings can supply layout bounds from measured content
  using size-free spacing specs. Core rejects stale/incomplete measurements and
  the workbench applies them only through an explicit, guarded Arrange.
- **evidence:** five new package measurement tests plus edge/renderer regressions,
  workbench real-ELK completion/freshness checks and installed tarball runtime/strict
  TypeScript qualification. Root typecheck, check, full tests and production build.
  Local Chromium actual-size, gap, font-delay, keyboard, combined edge/heading and
  theme checks with inspected captures. Architecture, boundary, delivery and
  test-quality reviews: **self-review**.
- **remaining uncertainty:** one HTML border-box snapshot is measured. Arbitrary
  overflow, transforms, SVG/portal targets, later resources, other browsers/devices,
  manual AT, large-graph performance and hosted acceptance remain unqualified.
  Native font loading is not interrupted. SDK/publication gates remain unchanged;
  nothing was pushed, published, deployed or activated.
- **next:** opt-in SVG export fidelity for retained routes and measured label
  anchors, with explicit custom-renderer findings. Recommendation: **needs review**.

## Package scope and safeguards

[ADR 0074](../../../docs/adr/0074-measure-intrinsic-group-headings.md) records the
contract. `LayoutGroupHeaderSpec` contains ID, padding and gap only. C4/DDD native
heading options discriminate declared bounds from intrinsic max-content sizing,
which needs no manually chosen width/height. Existing content/control slots remain
available and collapsed groups keep compact geometry.

Core start/update/resolve functions own transient idle/pending/ready/failed state.
They copy spacing, dimensions and visibility, capture exact graph/revision/render
identity, and validate every requested group and full measurement batch. Duplicate,
missing, nonpositive/nonfinite or overflowed bounds fail atomically. Collapsed or
ancestor-hidden targets cannot start. Changes to source, revision, renderer or the
collapsed-group set block publication/reuse. Cancellation and replacement ignore
late work; repeated IDs are not a supported way to start a new run. Ready contexts
combine observed size with original spacing into complete `groupHeaders`. Resolve
again before layout and before accepting engine completion. Measurement adds no
Undo or graph mutation; normal layout remains one Undo and preview history stays
separate. No source or export wire format changes are made.

Edge and heading measurement now share private complete-batch/freshness helpers
and one scoped native box observer. Existing edge API shapes remain unchanged.
The resource waits for font readiness, reads fractional border boxes in physical
world/CSS units, maps vertical writing modes and isolates nested native canvases.
It rejects missing, duplicate, fragmented or zero-sized targets. Deadlines default
to 3000ms, accept positive finite values up to 60000ms, and cover readiness plus
observation. Completion/unmount releases observer/timer and ignores late callbacks.
SSR is inert. Custom hosts compose the same probe and scoped target attributes.
Render all requested headings; culling, portals or absent custom targets need an
appropriate scope/subset. Caller render keys must cover all size-affecting content,
theme, font, spacing and resource changes. Continuous layout is not installed.

## Workbench and local acceptance

Measure intrinsic heading adds summary and provenance variants without changing
default or declared headings. Mode/detail changes cancel pending heading work and
layout; theme changes invalidate results. Measure leaves geometry unchanged.
Heading and edge measurements can both supply one explicit layout. The completion
handler rechecks heading freshness; stale engine results retain the previous
preview. Successful layout consumes revision, requiring fresh measurements for a
subsequent arrangement. Native controls retain focus and expose guarded reasons.
The working graph, Undo, projection and nine findings survive the detached review.

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/measured-group-headers-browser.mjs
```

Tests cover complete/invalid batches, detached copies, overflow, source and renderer
changes, stale requests/revisions, collapsed/ancestor visibility and equivalent
visibility sets. Native adapter tests isolate nested canvases and edge targets;
SSR tests verify optional hooks, intrinsic sizing and deadlines. Existing shared
observer cancellation, timeout, fractional and vertical-writing cases remain in
the suite. Real installed core/ELK tarballs qualify runtime and strict
Bundler/NodeNext types, including intrinsic renderer options and SSR hooks.
Workbench tests execute ELK, reject theme changes during completion and preserve
source/history references.

Browser checks use actual ResizeObserver and ELK. Summary/provenance content yields
different natural widths/heights. Accepted layouts retain measured sizes, 24-unit
insets and child gap in RIGHT and DOWN, after repeated fit/measurement and native
zoom. Edge and heading measurement compose in one layout; themes and Minimal mode
retain controls. The font-ready browser boundary alone is delayed for Cancel and
content-change tests, with no injected application Model or rendered content.
Keyboard Measure/Arrange preserve focus. Exported working model/lineage is exactly
unchanged after close; no page errors or external requests are accepted. Geometry
assertions allow 0.1 world unit for browser matrix rounding, not a universal layout
collision guarantee.

Artifacts: [browser receipt](measured-group-headers-browser.json),
[light](measured-group-headers-light.png), [dark](measured-group-headers-dark.png)
and [zoomed detail](measured-group-headers-detail.png). All captures use the local
production build and native controls.
