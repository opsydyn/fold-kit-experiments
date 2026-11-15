# Opt-in measured label bounds qualification

- **result:** complete
- **claim:** package-level measurement state and a scoped Foldkit Mount produce
  usable label envelopes only from complete, current batches. Domain review demos
  intrinsic compact/expanded badges with explicit Measure, Cancel and Arrange.
- **evidence:** seven package tests covering pure state, native observation and
  SSR; workbench tests for measured hints, late completions and renderer changes
  during actual ELK completion; installed tarball runtime/strict-type qualification.
  Root typecheck, check, all workspace tests and production build. Local Chromium
  actual border-box/layout checks, delayed-font boundary cancellation checks and
  inspected light/dark captures. Architecture, boundary, delivery and test-quality
  reviews: **self-review**.
- **remaining uncertainty:** only one HTML border box per target is measured.
  Overflow, margins, local transforms, future resource/style changes and arbitrary
  collision avoidance remain outside this contract. Other browsers/devices,
  manual AT, large-diagram performance and hosted acceptance remain unobserved.
  Native font loading itself is not interrupted. SDK/publication gates remain;
  nothing was pushed, published, deployed or activated.
- **next:** explicit layout group-header envelopes for custom C4/DDD container
  headings, replacing fixed engine header padding. Recommendation: **needs review**.

## Package boundary and safeguards

[ADR 0072](../../../docs/adr/0072-measure-rendered-labels-with-scoped-freshness.md)
records the contract. Core is browser/Effect independent. It captures request ID,
revision, exact serialized graph and a caller-owned render key, copies target IDs
and validates a complete matching positive finite batch. Same-revision source
changes, stale revisions/IDs/render keys, cancelled and replaced requests cannot
publish or resolve usable bounds. Current partial, duplicated or invalid results
fail atomically. State/result copies never mutate authored labels, graph, provenance
or Undo. Resolve again before both starting layout and applying its result.

The optional view attaches targets/probe only on opt-in. One keyed Mount waits for
used-font readiness and observes borderBoxSize in world/CSS units, preserving
fractional dimensions and mapping vertical writing. Default deadline is 3000ms,
configurable to a positive finite value up to 60000ms. A request fails explicitly
when targets are missing/duplicate/fragmented/zero-sized or native support is absent.
Unmount/completion clears observer and timer once and suppresses late callbacks.
SSR retains inert hooks without browser effects. Custom hosts can compose the
probe and scoped target attributes. No automatic layout or continuous observation
is installed. Every requested label must render; culling/portals require selecting
an appropriate subset/host. Later content, font, image or CSS changes require an
explicit remeasurement or a new renderer key.

The workbench uses fixed declared bounds by default. Measured mode renders
intrinsic text-plus-tag badges, with compact and expanded variants. Mode/detail
changes cancel old measurements/layout; actual theme participates in the render
key. Measure leaves geometry untouched. Arrange reads only a ready batch and
rechecks freshness before publishing ELK output. Successful layout advances
revision and needs a fresh measurement for another arrangement. The status reports
successful consumption clearly. Protection uses aria-disabled plus a reason and a
reducer guard so the Arrange button retains keyboard focus after completion.
The detached preview keeps its source/projection/findings and the working editor,
model lineage and Undo. Existing SDK/private-adapter compatibility gates remain.

## Local verification

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/measured-labels-browser.mjs
```

The full suite packs and installs core/ELK into a fresh npm consumer and checks
Node/Bun runtime, strict Bundler/NodeNext types and SSR opt-in hooks. Native boundary
tests control observer/font inputs to prove cleanup, timeout, fractional sizes,
vertical writing, missing labels and nested-scope isolation. Browser checks use
real ResizeObserver dimensions and ELK for eight intrinsic badges, differing
widths, fixture-specific leaf-node non-overlap and repeat measurement after camera
fit without a zoom-size feedback loop. The browser font-ready promise alone is
delayed for cancellation/content-change tests; no application Model or rendered
content is injected. Keyboard Measure/Arrange, theme invalidation, Minimal mode,
nine findings and exact working-model export equality pass. No page errors or
external requests are accepted. Fixture overlap checks allow one screen pixel of
rounding tolerance and do not claim universal layout correctness.

Artifacts: [browser receipt](measured-labels-browser.json),
[light](measured-labels-light.png), [dark](measured-labels-dark.png) and
[zoomed badge detail](measured-labels-detail.png). Full-diagram captures use fit
zoom; the detail uses native wheel zoom. All are local production-build evidence.
