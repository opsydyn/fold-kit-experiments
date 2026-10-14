# Functional & AI Radar Design

Date: 2026-10-14. Direction approved in conversation; this written design still
requires review. Approval of this document permits implementation planning, not
product code. Baseline: merged main `f2cc4000cd575d710a8c5bd28ea5ad9ea9797f37`.

## Intent And Minimum Complete Slice

Create a usable, rotatable, spherical technology radar with a functional-programming
and AI flavour, plus unexpected technologies. Reuse the earthquake globe's pure
FoldKit/SVG approach, not Earth imagery or its application state. The user chose
our own original dataset rather than a Thoughtworks edition.

The first slice is one `/functional-ai-radar` reference app: 32 original demo
entries, four categories, four wireframe recommendation shells, search and
filters, stable-ID selection, visible details and a complete keyboard-accessible
list. A user must be able to find an entry, identify its category and illustrative
recommendation, and inspect it even when its marker is hidden or overlapping.

No Three.js, D3 runtime, new dependencies, public package exports, generic 3D
engine, dataset editor, persistence, live feed, AI service, automatic spin,
inertia, performance claim, version bump or release. Existing globe behaviour,
CI, deployment and changelog-normalization workflow are unchanged. Live
normalization qualification remains pending the next genuine package release.

## Domain And Original Demo Data

The categories are Techniques, Tools, Platforms, and Languages & Frameworks.
Adopt, Trial, Assess and Caution are discrete recommendation labels, not numeric
scores. The chart is inspired by Thoughtworks' organizational model; it does not
copy their edition, blips, descriptions, artwork or assessments.

Display `Original demo dataset - placements are illustrative, not adoption
advice` as data provenance beside the title. The date is the fixture's authored
date, not a claim that every project was assessed or refreshed then. Each entry
has a stable kebab-case ID, name, category, ring, original short description and
HTTPS source URL. The following roster and placements are fixture choices for
the demonstration, not evidence-backed recommendations about these projects.

| Category               | Adopt                                        | Trial                                                    | Assess                                              | Caution                                                 |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Techniques             | Algebraic data types; Property-based testing | Retrieval-augmented generation; Structured model outputs | Relational programming; Proof-guided generation     | Unreviewed generated changes; Unbounded agent authority |
| Tools                  | Bun; Tree-sitter                             | Ollama; Codex; Claude Code; Pi                           | llama.cpp; marimo                                   | None                                                    |
| Platforms              | BEAM; SQLite                                 | DuckDB; Cloudflare Workers                               | WebAssembly; Local-first sync; Unison Cloud; WebGPU | None                                                    |
| Languages & Frameworks | Effect; FoldKit                              | Clojure; Gleam; Elm                                      | Unison; Futhark; Lean                               | None                                                    |

There are eight entries per category and 32 total. An empty category/ring cell
does not imply approval of everything in that category. Source links establish
what an entry refers to, not its demo placement. During implementation, verify
each link against a first-party project or technique reference and write our own
description; do not copy third-party prose or imply endorsement. For the two
cautionary practices, use a relevant primary security/verification reference
rather than inventing a project or attributed failure story.

The fixture is local and immutable. Validate unique IDs, non-empty names and
descriptions, known category/ring values, HTTPS URLs and at most eight entries
per category before rendering. A
malformed fixture produces a labelled Failure state, not silently dropped or
fabricated entries. Empty valid data and zero filter matches are distinct valid
states. No external dataset import or runtime network fetch is required.

## Architecture Decision And Simplicity Check

Status: proposed written design, following approved direction. This section
reuses the repository's chart-spec decision convention; CI ADRs 0001/0002 remain
separate. Review before implementation and before any public geometry expansion.

Selected path: an app-local radar that consumes the existing
`projectGlobePoint` and `clipGlobeLine` exports from `/shape/globe`. They provide
orthographic rotation and front-hemisphere clipping, not a general 3D renderer.
Angles are virtual layout coordinates; no technology has a geographic location.
Radar data, category sectors, shell radii, ordering, filtering and selection are
application policy. Do not import the earthquake app's Model, Messages, fixture
or Mount; follow its scoped-input pattern without coupling the two apps.

Alternatives: a classic flat radar directly exposes radial recommendation bands
but does not satisfy the requested spherical interaction; opaque nested spheres hide inner content;
a generic renderer or new Viz API adds unnecessary scope. Use open wireframes
and an ordinary list instead. No lighting, mesh, GPU picking or scene graph.

Simplicity check: reuse pure projection and established FoldKit lifecycle;
keep one immutable dataset and one Model; preserve validation, accessibility,
provenance and regression tests; omit speculative transport and shared runtime.
Boundary verdict: safe with noted risk, subject to written-design approval.

## Decision Challenge

Trigger: a new chart architecture and original-data provenance contract.
Browser SVG owns drawing and hit testing; FoldKit owns lifecycle and update flow;
Viz owns existing pure projection. This app's value is the coherent radar
interaction and truthful domain encoding, not a second renderer or runtime.

Strongest counterargument: spherical depth can make a categorical radar harder
to read than the flat reference. Apparent screen distance is not shell radius,
and rotation can hide half the markers. Novelty is not evidence of usability.

| Claim                                                       | Current evidence                                                                  | Gap                                                   | Required evidence                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Existing helpers can support the shape without dependencies | Source accepts a finite view radius and returns facing plus projected coordinates | No multi-shell scene tested                           | Independent shell, depth-order, rotation and finite-output tests                        |
| Entries remain understandable and reachable                 | Proposed labelled details, filters and full list                                  | No browser or user acceptance                         | Find/select every entry through the list; retain correct category/ring after rotation   |
| Original dataset avoids copying a published edition         | User selected our own demo; fixed roster above                                    | Descriptions and source URLs not yet authored/checked | Unique validated records, checked primary links, explicit illustrative-placement notice |

Minimum credible slice: this single 32-entry app, using unchanged pure exports.
Stop if correctness needs new projection semantics, dependencies, renderer or
public exports; return for a revised design rather than quietly expanding scope.
If overlapping/hidden marks prevent list-based inspection or recommendations
are inferred incorrectly from screen position, hold acceptance and repair the
interaction/labels. Do not claim superiority to a flat radar without comparison.
Challenge verdict: proceed to written-design review only, not implementation.

## Geometry, Layout And Identity

Use a fixed square SVG viewBox, responsive width and stable aspect ratio.
Outer base radius is 260 in a 600x600 scene. Shell fractions are Adopt 0.4,
Trial 0.6, Assess 0.8 and Caution 1.0. These spacings are presentation choices,
not measured differences in suitability. Each entry projects at its own shell
radius multiplied by zoom. Default view centre is `[0, 20]`, zoom 1.

Assign category longitude sectors in the order Techniques, Tools, Platforms,
Languages & Frameworks, starting at -180, -90, 0 and 90 degrees. Sort the full
unfiltered category by ID; for its eight fixture entries, slot `i` uses longitude
`sectorStart + 15 + 20 * (i % 4)` and latitude `i < 4 ? 22 : -22` degrees.
Freeze the derived layout for the dataset. Filtering and input-array order do
not repack entries; radius depends only on ring. No runtime random generator.
The first slice supports this roster, not an arbitrary-density packing library.

Draw each shell's outline, equator and four category-boundary meridians as light
wireframes, sampling open spherical lines at no more than five-degree steps and
using existing clipping. Do not use opaque filled shells. Draw all guides before
marks so guides cannot intercept blip input. Provide persistent category swatches
and a labelled shell key; selection details and list rows state the actual ring.

Cull back-hemisphere markers and markers whose centres are outside the SVG
viewport, as in the globe. Sort visible marks by ascending `shellRadius * facing`
with ID as a tie-breaker; nearer marks paint later. Facing is not a maturity
score. Overlapping markers are not all guaranteed individually clickable: the
list is the complete inspection path. A selected front/onscreen marker is painted
last with an extra outline; this intentional emphasis is not physical occlusion.
Never create a hidden marker focus target. No polygon or opaque-sphere occlusion
claim follows from hemisphere clipping.

## Model And Interaction Contract

The app Model owns decoded data, view centre, zoom, query, selected category
(`All` or one category), enabled rings, selected ID and a tagged Idle/Dragging
gesture. Geometry and filtered records are derived, never a second mutable store.
Use existing Effect/FoldKit schemas, past-tense Messages and exhaustive updates.

- Search is trimmed, case-insensitive substring matching on name and description.
  Category and ring filters intersect with search. The same predicate supplies
  sphere, list and result count; the count includes matching rear-side entries.
- Category selection filters and faces that sector's midpoint at latitude 20;
  choosing All preserves the view. Any filter/query edit ends the active gesture.
  Clear a selection excluded by filters; retain it otherwise without repacking.
- Marker activation selects a matching valid ID without rotating. List activation
  selects it and centres on its virtual coordinate. Rotation preserves details
  even when the selected marker moves behind the scene. Invalid or excluded IDs
  are no-ops. Selection is not keyboard-focus relocation or automatic scrolling.
- Drag uses the initial gesture centre and measured displayed outer radius, not
  cumulative deltas. Ignore unrelated pointer IDs; end on release, cancellation
  or leaving the surface. Reject non-finite/overflowing pointer facts. Suppress a
  marker click after travel beyond four CSS pixels, not after an ordinary click.
- Zoom buttons use factors of 1.25 within [1, 2]; turn buttons/arrows use 15-degree
  steps. Normalize longitude, clamp latitude to [-90, 90]. Controls end dragging.
  Rotation/zoom keys are handled only when the scene root itself is focused,
  not when a marker or search input is focused. Marker Enter/Space selects
  without rotation, so it cannot remove its own focused target. Unhandled keys
  are untouched. No timer, automatic spin or inertia.
- Reset view and Home restore centre/zoom and end dragging, retaining filters and
  selection. Clear filters resets query/category/all rings and reconciles selection,
  retaining the view. All rings may be unchecked: show zero matches, not fallback
  entries. Route exit/re-entry starts with the default Model and no old listeners.

## View, Accessibility And Visual Direction

Make the actual radar the first screen: unframed scene, compact control strip,
selected-entry details and a captioned list/table. No landing page, decorative
cards, Earth texture, marketing copy or remote media. Reuse existing light/dark
theme tokens; distinguish categories with teal, green, amber and rose plus text,
not colour alone. Keep compact fixed-size blips with stable short display numbers
assigned from full-data ID order, not filtered positions. Details show full names.

Use a labelled search input, category select, ring checkboxes with counts and
familiar icon/symbol rotation, zoom and reset buttons with accessible names and
tooltips. Reuse existing local control conventions without installing an icon
library. Filter/ring counts are derived from the query/category before ring
exclusions, making re-enabling an unchecked ring understandable.

Scene controls, visible marks and list selection have meaningful names, visible
focus and Enter/Space activation without duplicate click. Every matching entry
is inspectable through the list regardless of projection. Provide one polite,
atomic selected-details live region and an explicit cleared-selection state;
never announce the entire table on every drag. External source links use HTTPS,
`noopener noreferrer` and normal user activation, not automatic fetching.

At 390x844, selecting a visible marker must expose its name, category and ring in
the current viewport without automatic scrolling. Place the compact details
summary adjacent to the scene and test viewport intersections, not only DOM
existence. Longer descriptions and the list may continue below. At desktop,
details can sit beside the scene. Keep DOM/visual reading order coherent, text
within its containers and controls usable at 320px without horizontal page
overflow. Respect reduced motion; no animation is required by this slice.

## Proposed Files And Verification

Own implementation under `apps/web/src/apps/functional-ai-radar/`: local data and
fixture, layout/projection adapter, Model/Message/update, scoped Mount, view/CSS,
app/main and colocated tests. Add the ordinary Astro route, gallery link and
`apps/web/e2e/functional-ai-radar.spec.ts`. No shared package, export-map, existing
globe-app, dependency, formatter/linter, workflow or version change is expected.

Meaningful tests precede code. Use independent expected values, not values
recomputed with the implementation under test:

- Data: exactly 32 unique fixture IDs/eight per category; valid source URLs and
  enums; malformed/duplicate failure; empty data; descriptions and provenance.
- Geometry: with centre `[0,0]`, translation `[300,300]` and outer radius 260,
  an Adopt blip at `[30,0]` projects to `(352,300)`, a Trial blip there to
  `(378,300)`; `[180,0]` is hidden despite projecting to the screen centre.
  Independently pin depth order, ties, horizon, pole/sector boundaries, frozen
  inputs, stable layout after filtering/reordering and finite path coordinates.
- Updates: filters intersect correctly, no-match/zero-enabled-ring states,
  excluded selection clears, rotation retains selection, list activation centres,
  category facing, reset-view versus clear-filters, zoom limits, pointer identity,
  cancellation, drag/click suppression and keyboard scope.
- Real FoldKit view/Scene: controls dispatch the intended facts; filtered/hidden
  targets are absent; list and scene agree; selected details state category/ring
  after rotation; source links/provenance and Failure/empty states are present.
- Browser: desktop 1365x900 and mobile 390x844, light/dark, search and filters,
  actual list selection of every entry, mouse drag, Chromium-emulated touch,
  keyboard/zoom/reset, visible selected summary, route teardown/re-entry and
  console errors. Capture screenshots and SVG pixel checks demonstrating
  nonblank shells/marks, rotation changes and legible controls. Add a 320px layout
  and reduced-motion check. Do not label emulation as physical-device acceptance.

Before and after product implementation run `bun run check`, `bun typecheck`,
`bun run test`, web production build and the focused Playwright file. Do not run
unfiltered root Bun tests through vendored references. Shared package builds and
browser tests run serially with the ordinary preview paused, then restored, to
avoid the earlier globe's contaminated browser run. Tests must not fetch remote
data or source sites. A prototype is not proof of comparative usability, npm
availability, production scale, Safari or screen-reader acceptance.

## Sources And Next Gate

- [Thoughtworks Radar](https://www.thoughtworks.com/radar): category/ring concept
  only; no edition data or assessment is reused.
- Local baseline: `packages/foldkit-viz/src/shape/globe.ts`, the earthquake app's
  input/view patterns and `apps/web/playwright.config.ts` were inspected.
- First-party reference candidates checked during ideation:
  [Unison](https://www.unison-lang.org/), [Gleam](https://gleam.run/),
  [miniKanren](https://minikanren.org/), [Futhark](https://futhark-lang.org/),
  [Lean](https://lean-lang.org/) and [Ollama](https://ollama.com/).

Review this written spec, particularly illustrative placements, nested-shell
legibility, complete list inspection and app-only ownership. Approval permits
writing the implementation plan; that plan then needs review and an execution
method choice. No radar fixture, product code, behavioural probe, model trial,
push, PR, release or live normalization write is authorized by this design pass.
