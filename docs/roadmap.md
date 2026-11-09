# FoldKit Experiments Product Roadmap

This roadmap turns the two packages into a coherent FoldKit data-application stack:

- `@opsydyn/astro-foldkit` owns Astro rendering, hydration, navigation, and island lifecycle.
- `@opsydyn/foldkit-viz` owns pure chart math and FoldKit-compatible interaction primitives.
- `apps/web` is the reference product and integration test surface.

## Roadmap Ownership

This file is the canonical cross-package product roadmap and release sequence.
[`ROADMAP.md`](../ROADMAP.md) is the supporting `foldkit-viz` chart inventory,
primitive-parity audit, and implementation history. It links here for product
priorities rather than duplicating their status.

Current package compatibility targets FoldKit `0.167.x` to `0.169.x`, stable Effect
`4.0.0`, and the `@foldkit/vite-plugin` `0.28.x` line. See the
[migration guide](migrations/foldkit-0.167.md) and the [0.169 notes](releases/foldkit-0.169.md). Astro integration `0.8.0` and
Viz `0.11.0` are published; registry and hosted deployment verification is
recorded in the [release notes](releases/foldkit-0.167.md).

## Zloz: brand and product direction — 2026-11-08

**Status:** user-defined roadmap direction. Brand migration, new sites and hosting
are planned delivery slices; this entry records their intended scope.

### Name and positioning

- **External product name:** **Foldkit Zloz**. Use **Zloz** in public-facing copy
  and ASCII **zloz** for future slugs, URLs and command spelling.
- **Origin:** **Złóż**, Polish for “fold, assemble, put together.” Preserve the
  accented spelling in the name's explanation; use Zloz externally for ease of
  typing and sharing.
- **Rebrand:** Flow → Zloz.
- **Identity:** “More than a flow editor. A system composition toolkit.” What
  began as a node-and-edge editor now supports composing, exploring and
  communicating complex systems.
- **Primary tagline:** “Compose systems. Connect ideas.”
- **Supporting strapline:** “Compose. Connect. Communicate.”
- **One-line description:** “Foldkit Zloz is a functional, extensible graph toolkit
  for interactive node editors, C4 architecture modelling, and Mermaid export.”

**Brand architecture:** Foldkit is the UI toolkit; Zloz is the graph and system
modelling toolkit within that family.

### Three core capabilities

| Capability      | Product promise                                                        |
| --------------- | ---------------------------------------------------------------------- |
| **Compose**     | Build interactive graphs with nodes, edges, ports and connections.     |
| **Model**       | Describe software architecture with built-in C4 modelling.             |
| **Communicate** | Export models as Mermaid diagrams for documentation and collaboration. |

### Design principles

- **Functional at heart:** pure functions, composition and immutable data.
- **Headless by design:** separate the graph model from its visual form.
- **Extensible by default:** let engineers build their own nodes, edges, layouts
  and tools without hacks or overrides.
- **Open by nature:** models should travel beyond the editor rather than remain
  trapped inside it.

### Planned delivery

1. **Brand and naming migration.** Inventory public copy, documentation, package
   names, imports, types, routes and examples before applying the Flow → Zloz
   rename. Decide technical names and compatibility/migration handling explicitly;
   external branding does not by itself rename existing APIs or saved formats.
2. **Distinct Zloz logo and shared family identity.** Create a logo representing
   Zloz, while following the styling, typography and visual identity established
   by the Viz and Three promo sites. Define reusable assets and light/dark usage.
   Three [SVG concepts and family-header proofs](assets/zloz/README.md) are now
   available in both themes. **B — Nested frame is selected by the user**. The
   [final identity assets](assets/zloz/final/README.md) include outlined wordmarks,
   light/dark and monochrome marks, favicon and usage rules. The board uses the
   Viz/Three neutral-and-blue palette and locally bundled Inter typography.
3. **Promo site.** Build a dedicated Zloz product site in the same family as Viz
   and Three, presenting the positioning, principles and Compose / Model /
   Communicate capabilities with real package-backed examples.
   The [dedicated static shell](../apps/zloz-promo/README.md) is now implemented
   locally: selected identity, family themes, core-generated C4 preview, model/
   Mermaid downloads and a developer guide with shared Viz/Three syntax
   highlighting. [Local evidence](../apps/zloz-promo/evidence/promo.md) records
   browser and nested-base-path checks. A [native Compose example](../apps/zloz-promo/evidence/compose.md)
   now demonstrates selection, connection creation, cancel and Undo/Redo, with
   readable narrow layouts and shared highlighted source.
4. **Full demo site.** Develop an Astro-shell, native Foldkit demonstration site
   comparable in scope and navigation approach to Tech Radar. Build on the
   persistent-canvas left-sidebar workbench; expose graph composition, C4 models,
   Mermaid export, examples and API/type-contract documentation. Keep reusable
   functionality in packages and use the app to compose and demonstrate it.
5. **Cloudflare hosting.** Published and qualified: [workbench](https://zloz.opsydyn.xyz/)
   and [promo](https://opsydyn.github.io/fold-kit-experiments/zloz/).
   Both website deployments are independent of npm publication.
6. **Publication last.** Finish feature work and site qualification before the
   npm publication slice. Verify chosen ASCII package names, migration guidance,
   packed-consumer behavior and release automation at that boundary.

The current implementation uses `packages/foldkit-zloz*` and
`apps/zloz-demo`. Its [nested Mermaid export](../apps/zloz-demo/evidence/mermaid-subgraphs.md)
and [persistent-canvas sidebar](../apps/zloz-demo/evidence/sidebar.md) provide the
local baseline for the Zloz demo. Site delivery and registry publication are
separate from that existing local evidence.

**Naming cleanup:** all four package/release identities use Zloz; the API title
is **Foldkit Zloz API**, with canonical `/zloz/api/` navigation. Deprecated source
aliases and saved-data protocols are documented in the [migration guide](zloz-migration.md).
No Flow-named package may be released; obsolete release PR #110 was closed.

**Standalone Effect CLI:** the unpublished [`@opsydyn/foldkit-zloz-cli`](../packages/foldkit-zloz-cli/README.md)
now provides `zloz validate` and `zloz mermaid export`. Typed Effect CLI commands,
Schema JSON decoding, the canonical core codec, scoped platform streams and
structured errors produce versioned agent-readable output. Strict/report loss
policies, a 1 MiB UTF-8 byte budget, Node/Bun installed binaries and 0/1/2/130 exit
contracts are qualified locally; CI runs the same checks. Core/Mermaid stay pure; parser adoption
and Mermaid import remain subsequent work. Release/publication activation remains
separate. The historical imperative fidelity driver is not the production CLI.

**Planning completed — 2026-11-08:** the [naming migration inventory](assessments/2026-11-08-zloz-naming-migration-inventory.md)
and [shared logo/site brief](assessments/2026-11-08-zloz-logo-and-site-brief.md)
record candidate package mappings, compatibility boundaries, family styling,
logo directions and promo/demo information architecture. Their technical names
remain proposals for implementation review. The user selected **B — Nested frame**
after reviewing the three SVG concepts.

**Next bounded promo slice:** export the edited Compose graph as canonical JSON
and Mermaid, with explicit conversion-loss review. The static shell, highlighted
developer guide and native Compose island are implemented locally.
Both board and promo must keep the Viz/Three family styling, including light/dark
themes; a separate dark-green identity is not intended. The separate
feature recommendation for searchable sidebar settings remains on the workbench
track.

**Suggested workbench UX follow-up:** make the mini map discoverable in Navigation
with a **Mini map** toggle, rather than **Overview** under Diagnostics. Reuse the
existing `overview` flag and respect global diagnostics/Minimal mode. This is a
proposed follow-up prompted by the user's difficulty locating the control.

## Zloz core: parity and domain modelling — 2026-11-08

**Status:** review completed; proposed delivery order, not implemented features.
The [current core assessment](assessments/2026-11-08-zloz-core-parity-and-domain-roadmap.md)
records capability gaps, package ownership, compatibility constraints and the
claim-to-evidence map. Full React Flow parity and competitive superiority are
not established.

Maintain two tracks: a reliable, customizable editor floor and a differentiated
architecture modelling lifecycle. Package-owned functionality stays reusable;
Astro is the demonstration shell. Prioritize the following bounded slices:

1. **DDD preset renderers — implemented locally:** all eight existing semantic
   roles have composable node/group presentation and a light/dark Order aggregate
   demo. See the [qualification receipt](../apps/zloz-demo/evidence/ddd-renderers.md).
2. **History and time travel — first slice implemented locally:** a first-class
   product pillar. Core owns named immutable editions, a separate versioned archive,
   read-only review and semantic/layout comparison. The optional Foldkit ghost
   layer composes with the History sidebar and Order editions demo. See the
   [qualification receipt](../apps/zloz-demo/evidence/history.md). The subsequent
   [import/restore slice](../apps/zloz-demo/evidence/edition-restore.md) adds atomic
   archive merge and explicit graph-only restore with one Undo, required freshness
   and live policy checks. The fork slice adds separate model identity, pinned immediate origin, an independent editor/Undo and model JSON; playback and automatic persistence remain open.
   Start with named
   immutable editions, read-only rewind and return to the present; then semantic/
   layout comparison and explicit restore or fork into a new working model.
   Include opt-in ghost nodes/edges, previous positions and movement connectors
   like Tech Radar, with clear change states and independent visibility controls.
   Establish the contract before expanding persisted domain vocabulary.
3. **Atomic pattern insertion:** validated fragments, deterministic ID remapping,
   policy checks, full rollback and one Undo per insertion.
4. **DDD relationships/context maps:** typed tactical and strategic meaning,
   serialization and conversion-loss handling; respect portless group boundaries.
5. **EventStorming discovery:** explicit compatibility decision, configurable
   semantic cards, optional links and valid uncertainty; then workshop patterns
   and deliberate links to DDD/C4 concepts.
6. **Agent modelling operations:** build on the standalone CLI with validated
   patches, dry runs and reviewable changes; no automatic writable-agent rollout.

Alongside these, evaluate authored edge waypoints, palette/drop workflows and
image export against architecture tasks. Coordinate collaboration with its
separate proposal; no collaboration runtime is claimed here. Keep accessible
interaction and unrestricted visual composition in each slice. Retain the later
comprehensive a11y qualification gate and publication-last decision.

**Recommended next:** integrate the new model-document envelope with workbench import
and CLI validation, preserving identity and lineage end to end, then continue with
atomic pattern insertion. Forking is implemented locally with package-owned
model identity, pinned source edition, independent editing/Undo, policy checks,
session switching and an explicit model codec. Graph/snapshot/edition v1 remain
unchanged. The existing diagram importer and CLI still read their original
formats; they must not silently strip new model metadata. See
[the fork qualification receipt](../apps/zloz-demo/evidence/model-forks.md).
DDD renderers retain the current
descriptor contract without new persisted fields. Proposed positioning to validate: model a domain
with people, explore how its architecture evolves, and review/communicate the
same portable model with human and agent tooling. Shapes alone, Undo and layout examples do not establish a USP.

## Release: Keyed Chart Comparison

**Outcome:** users can compare charts in a dynamic collection without losing
each panel's selection and inspection state when panels move.

- [x] Add, remove, and reorder chart panels using stable app-owned IDs and
      `foldChildAt`.
- [x] Link panel selections through typed child OutMessages and parent-owned
      selection policy.
- [x] Verify in automated tests that reorder preserves state and late Messages for removed IDs
      cannot recreate panels.
- [x] Implement the same-source promo/download workflow; generated comparison,
      line, histogram and scatter projects install, typecheck and build locally.
- [ ] Complete controller-owned desktop/390px, keyboard, reduced-motion and
      standalone browser acceptance. Further controller QA is pending exclusive
      Firefox access; no live pass is inferred from automated tests.
- [x] Publish the runnable promo example and FoldKit 0.167 package updates
      through the authorised release workflow; verify hosted and registry results.

All five source tasks and the final correction wave are implemented and reviewed.
The final source checkpoint passed 529 tests, typechecks, lint and production
builds. The scatter-axis spacing correction is implemented but its visual
recheck and the complete browser journeys remain pending. Release integration
also preserves main's dataset explorer and deployment support; its combined
verification is recorded separately. See the
[qualification record](superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md).

Follow-on candidate: a VirtualList-backed Stateflow event explorer. The bounded
KeyedQuery dataset explorer now exists in `packages/dataset-explorer` and is
hosted by both apps. Query's stale-result protection
does not replace the request-diagnostics example's interruptible route-exit
contract. Keep Query, Machine, and browser lifecycle ownership in applications.

## Viz direction: parity and chart excellence — 2026-10-05

The [concrete visx parity map and stretch goals](assessments/2026-10-05-visx-parity-and-chart-excellence.md)
records the current local source baseline, all 47 gallery examples, public/API
limits and proposed acceptance criteria. It distinguishes implemented geometry,
application-only recipes, promo exposure and behavioural qualification.

Proposed next Viz sequence: controlled brush/zoom/linked inspection; trustworthy
signals with explicit quality and uncertainty; expressive foldout/distribution
compositions; measured scale and reproducible exports. Precision and expressive
views share pure geometry and parent-owned Foldkit state. This is planning only;
each slice needs its own specification and implementation decision.

M1's local [controlled Signal desk qualification](superpowers/specs/2026-10-05-controlled-signal-exploration-qualification.md) now records the implemented pure helpers and native example, with native touch and representative-user comprehension explicitly unperformed. F1–F3 remain partial. The [M2 quality/uncertainty design](superpowers/specs/2026-10-05-trustworthy-signal-quality-design.md) is approved, with an executed [test-first implementation plan](superpowers/plans/2026-10-05-trustworthy-signal-quality.md). M2 implementation now has [automated qualification](superpowers/specs/2026-10-05-trustworthy-signal-quality-qualification.md); independent review findings are addressed and native Firefox mouse/keyboard/layout checks are recorded. Held-pointer, hardware touch and assistive-technology acceptance remain open. The approved error-bar and captured comparison follow-up is now implemented locally under its [executed plan](superpowers/plans/2026-10-05-signal-error-bars-and-comparison-baseline.md), with [qualification evidence](superpowers/specs/2026-10-05-signal-comparison-qualification.md). P2 error-bar geometry and P3 independent captured comparison are delivered; wider parity and native acceptance remain partial. A [post-review browser follow-up](superpowers/specs/2026-10-05-signal-comparison-native-qualification.md) now qualifies390/1280 light/dark layouts, off-screen comparison, table/source and held Capture/Clear/Escape paths. Independent capture loss, hardware touch/scrolling, screen-reader announcements and comprehension remain open. The [approved event-lane design](superpowers/specs/2026-10-05-signal-event-lane-design.md) now defines an optional independent caller event feed, exact-time selection and density-aware shared lane. The approved [test-first plan](superpowers/plans/2026-10-05-signal-event-lane.md) now has local implementation and [qualification evidence](superpowers/specs/2026-10-05-signal-event-lane-qualification.md). This delivers the event-lane portion of P4; replay/live transport and wider device/accessibility acceptance remain open. Next: direct accessibility and device acceptance of the existing Signal desk.

## Product Thesis

Build the most useful Astro host and chart-primitives layer for FoldKit applications: server-compatible islands, route-aware application lifecycle, typed parent-owned state, and linked data visualizations that remain pure and testable.

## Next Rerelease Slice: Stateflow Observatory

**Outcome:** `/stateflow` makes app-owned Machine transitions and typed Port
activity visible through a deterministic graph, replay timeline, and inspector.

- [x] Keep the Machine, replay policy, trace Model, Commands, and typed inbound
      replay/outbound telemetry Ports in `apps/web`.
- [x] Expose plain graph records and the pure `layoutStateFlow` API through
      `@opsydyn/foldkit-viz/stateflow`; no Machine execution or Port subscriptions
      belong in the viz package.
- [x] Host the page as an Astro `client:load` island using the existing lifecycle
      bridge, without adding integration APIs or async visualisation ownership.
- [x] Use FoldKit's [`Dom.streamFromMediaQuery`](https://github.com/foldkit/foldkit/pull/1424)
      in the app to record the current and changed reduced-motion preference;
      Astro remains a lifecycle host and `foldkit-viz` remains pure.
- [x] Document the reusable remote filter, brush, and zoom load pattern: an
      app-owned Command loads data, app-owned AsyncData/Model state records the
      result, and typed Ports carry host input/output only. The app owns keyed
      interruption/cancellation and replacement sequencing; `foldkit-viz`
      receives derived records and computes geometry synchronously.

**Observatory enhancements (all in `apps/web/src/apps/stateflow`):**

- [x] Specimens: any `Machine.define` machine, erased to plain records with its Message
      schema and named examples. Request diagnostics and a checkout ship; a picker
      switches between them.
- [x] Replay as a fold: the Model keeps encoded events and a cursor, and every state
      is the machine replayed to the cursor, so a scrubber moves both ways.
- [x] A layered layout (ranks along the flow, rank-skipping edges over the top, back
      edges under), with the message on every edge and its recency (`lastSeenAt`) as
      a fade. App-owned: D3 has no layered layout, so it stays out of `foldkit-viz`
      until a reference implementation is chosen. The force layout stays selectable.
- [x] Ignored messages counted and shaken off on their state; a swimlane of the
      session with each event's Commands.
- [x] Live mode: request diagnostics reports each machine message on a
      `BroadcastChannel`; the observatory, listening, records and replays them.
- [x] Coverage: edges taken in the trace, FoldKit's dead transitions and unreachable
      states, and a breadth-first search over the named examples whose shortest path
      to each edge is offered as a Vitest case (and run in `specimen.test.ts`).
- [x] Shareable sessions as a link (decoded into the page Flags on the server), and a
      top-to-bottom layout at phone width.

**Release gate:** implementation and documentation do not establish rerelease
readiness. The packed-consumer and workspace verification gates still apply.
See the [viz usage](../packages/foldkit-viz/README.md#remote-visual-loads) and
[Astro host usage](../packages/astro-foldkit/README.md#remote-visual-loads).

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
- [x] Handle `coldLoad`, `entered`, `exited`, and `stayed` at the application boundary with app-owned `Route.isEntering` route policy.
- [x] Support normalized repository/document paths with `rest`.
- [x] Verify state preservation and disposal across Astro View Transitions.
- [x] Add a route-aware example to `apps/web`.

**Exit criteria:** a route-driven example can distinguish cold load, route entry, route exit, and within-route payload changes with typed tests. Verified by the request-diagnostics unit, Story, Scene, package smoke, and production build checks recorded in the navigation bridge plan.

## Now: Interruptible Application Lifecycle

**Outcome:** an Astro-hosted FoldKit app can stop obsolete remote work while
the application retains ownership of command keys and cancellation policy.

- [x] Make request-diagnostics reloads interruptible with
      `Command.define({ interrupt: true })`.
- [x] Sequence the replacement request through the interrupt outcome Message;
      never return interruption and replacement commands in one update batch.
- [x] Cancel an active app-owned request on Astro route exit without starting a
      replacement request.
- [x] Document keyed cancellation for remote filter, brush, and zoom loads;
      keep `foldkit-viz` pure and synchronous.

**Exit criteria:** the reference app proves reload and navigation cancellation,
and the documented pattern has no Astro or Viz package API coupling.

## Completed: FoldKit 0.136 Compatibility

**Outcome:** both packages and the reference app use FoldKit's current render,
Command, and test contracts without weakening package ownership boundaries.

- [x] Propagate one render-scoped `HtmlBuilder` through Astro, app, Storybook,
      and chart view boundaries.
- [x] Migrate interruptible work to object-form
      `Command.define({ interrupt: true })` while preserving app-owned keys and
      cancellation policy.
- [x] Adopt `Scene.given` and `Story.given`, with subscription-origin coverage
      for the health uptime tick.
- [x] Add the locale-aware Astro Greeting showcase for FoldKit Document
      language and direction metadata.

**Exit criteria:** package builds, packed-consumer tests, application tests,
Storybook, TypeDoc, and the hydrated Greeting interaction all pass against
FoldKit 0.136.x.

## Next: FoldKit Viz Interaction Layer

**Outcome:** chart consumers can compose selection and navigation interactions without rewriting event plumbing for every chart.

- [x] Define controlled parent-owned selection contracts for brush, zoom, hover, and active series.
- [ ] Add linked-view helpers for histogram-to-scatter and scatter-to-table workflows.
- [ ] Keep all interaction state and math framework-agnostic with no runtime `foldkit` dependency.
- [ ] Add keyboard/focus event contracts compatible with FoldKit `OnKeyDownFocus`.
- [ ] Add accessible data summaries or table projections for chart views.
- [ ] Add property and interaction tests for domain conversion, clearing, clamping, and linked updates.

**Exit criteria:** two charts can share a typed selection model while each remains independently reusable and testable.

## Next: Reference Data Explorer

**Outcome:** the demo app proves the complete product boundary in one credible workflow.

- [x] Load data through `foldkit/http` with browser-safe tracing defaults.
- [x] Model request/loading/filtering/failure states with `experimental/machine`.
- [ ] Use `AsyncData.loadIfMissing` where cached data should not be revalidated on every revisit.
- [x] Render linked histogram and scatter charts through parent-owned filtering.
- [x] Exercise command mappings with `Story` and mounted child mappings with `Scene` tests.
- [x] Add route entry/exit behavior through the Astro integration.

**Exit criteria:** `/request-diagnostics` is a documented reference application, not only a demo page.

## Later: Release Quality

**Outcome:** both packages are dependable for external consumers.

- [x] Add package export and packed-consumer tests to CI through `bun run test`.
- [ ] Add API reports or generated type-surface checks for public exports.
- [ ] Add compatibility coverage for the supported Astro range.
- [ ] Publish migration notes for FoldKit minor/breaking changes such as `matchDataSplitEmpty` and route `Transition`.
- [x] Track package changelogs and versioning independently with release-please (`astro-foldkit` versus `foldkit-viz`).
- [ ] Add performance checks for bundle size and large chart datasets.

## Deliberate Non-Goals

- [ ] Do not make `foldkit-viz` depend on `foldkit/http` or `experimental/machine`.
- [ ] Do not build a second router inside either package.
- [ ] Do not turn `foldkit-viz` into a DOM/event runtime; keep rendering and browser wiring at the app boundary.
- [ ] Do not treat broad baseline lint cleanup as a prerequisite for product slices.
