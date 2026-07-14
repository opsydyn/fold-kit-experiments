# FoldKit Experiments Product Roadmap

This roadmap turns the two packages into a coherent FoldKit data-application stack:

- `@opsydyn/astro-foldkit` owns Astro rendering, hydration, navigation, and island lifecycle.
- `@opsydyn/foldkit-viz` owns pure chart math and FoldKit-compatible interaction primitives.
- `apps/web` is the reference product and integration test surface.

## Product Thesis

Build the most useful Astro host and chart-primitives layer for FoldKit applications: server-compatible islands, route-aware application lifecycle, typed parent-owned state, and linked data visualizations that remain pure and testable.

## Now: Astro Production Boundary

**Outcome:** an Astro consumer can mount a typed FoldKit app with stable server output, predictable hydration, and verified teardown.

- [x] Define a typed `defineApp<Props, Model, Message>` contract without `any` at the public boundary.
- [x] Replace the empty Astro SSR renderer with a stable, documented server output contract.
- [x] Make client embedding idempotent and lifecycle-safe across `astro:unmount`.
- [x] Add focused tests for renderer recognition, app loading, SSR output, hydration setup, and disposal.
- [x] Add a package-consumer verification fixture that resolves the published package exports.
- [x] Document the server/client boundary and the supported Astro client directives.

**Exit criteria:** `@opsydyn/astro-foldkit` has typed public APIs, no empty undocumented SSR behavior, and a passing consumer-level package smoke test.

## Next: Navigation-Aware Astro Apps

**Outcome:** FoldKit apps can react to Astro navigation without owning a second router.

- [x] Define an adapter from Astro navigation lifecycle events to application Messages.
- [x] Use FoldKit `Transition.make`, `coldLoad`, `entered`, `exited`, and `stayed` at the application boundary.
- [x] Support normalized repository/document paths with `rest`.
- [x] Verify state preservation and disposal across Astro View Transitions.
- [x] Add a route-aware example to `apps/web`.

**Exit criteria:** a route-driven example can distinguish cold load, route entry, route exit, and within-route payload changes with typed tests. Verified by the request-diagnostics unit, Story, Scene, package smoke, and production build checks recorded in the navigation bridge plan.

## Next: FoldKit Viz Interaction Layer

**Outcome:** chart consumers can compose selection and navigation interactions without rewriting event plumbing for every chart.

- [ ] Define controlled parent-owned selection contracts for brush, zoom, hover, and active series.
- [ ] Add linked-view helpers for histogram-to-scatter and scatter-to-table workflows.
- [ ] Keep all interaction state and math framework-agnostic with no runtime `foldkit` dependency.
- [ ] Add keyboard/focus event contracts compatible with FoldKit `OnKeyDownFocus`.
- [ ] Add accessible data summaries or table projections for chart views.
- [ ] Add property and interaction tests for domain conversion, clearing, clamping, and linked updates.

**Exit criteria:** two charts can share a typed selection model while each remains independently reusable and testable.

## Next: Reference Data Explorer

**Outcome:** the demo app proves the complete product boundary in one credible workflow.

- [ ] Load data through `foldkit/http` with browser-safe tracing defaults.
- [ ] Model request/loading/filtering/failure states with `experimental/machine`.
- [ ] Use `AsyncData.loadIfMissing` where cached data should not be revalidated on every revisit.
- [ ] Render linked charts with `@opsydyn/foldkit-viz` interaction primitives.
- [ ] Exercise command mappings with `Story` and mounted child mappings with `Scene` tests.
- [ ] Add route entry/exit behavior through the Astro integration.

**Exit criteria:** `/request-diagnostics` is a documented reference application, not only a demo page.

## Later: Release Quality

**Outcome:** both packages are dependable for external consumers.

- [ ] Add package export and packed-consumer tests to CI.
- [ ] Add API reports or generated type-surface checks for public exports.
- [ ] Add compatibility coverage for the supported Astro range.
- [ ] Publish migration notes for FoldKit minor/breaking changes such as `matchDataSplitEmpty` and route `Transition`.
- [ ] Track package changelogs and versioning independently (`astro-foldkit` versus `foldkit-viz`).
- [ ] Add performance checks for bundle size and large chart datasets.

## Deliberate Non-Goals

- [ ] Do not make `foldkit-viz` depend on `foldkit/http` or `experimental/machine`.
- [ ] Do not build a second router inside either package.
- [ ] Do not turn `foldkit-viz` into a DOM/event runtime; keep rendering and browser wiring at the app boundary.
- [ ] Do not treat broad baseline lint cleanup as a prerequisite for product slices.
