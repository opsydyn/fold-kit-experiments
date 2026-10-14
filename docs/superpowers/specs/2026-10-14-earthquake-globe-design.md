# Earthquake globe: dependency-free FoldKit design

Status: written design approved on 2026-10-14. The user approved earthquakes,
a recorded snapshot, and a rotatable orthographic SVG globe instead of Three.js.
Spec approval permits implementation planning, not implementation or publication.

## Outcome and scope

Explore where recorded earthquakes occurred, compare their magnitudes, and
inspect an event's depth, time and location. Render with FoldKit's SVG builder
and pure FoldKit Viz geometry. This is a projected globe with a 3D appearance,
not a WebGL scene or a prediction, damage estimate or live monitoring product.

Minimum complete slice:

- One `/earthquake-globe` reference page linked from the existing chart gallery.
- One bundled, immutable USGS M2.5+ past-seven-days GeoJSON snapshot, captured
  once during implementation with source URL, capture time, feed generation
  time, original count and SHA-256 in an adjacent provenance record.
- Sphere silhouette, front-hemisphere graticule and event markers. Country
  polygons/coastlines are explicitly deferred: they require a larger spherical
  polygon-clipping contract than points and open graticule lines.
- Pointer drag rotation, bounded zoom, reset and keyboard equivalents.
- Selection shared between visible markers, an accessible event table and a
  detail region. Selecting a table row recentres the globe on that event.
- Magnitude-sized markers and a labelled depth colour scale. All markers are
  surface epicentres; depth is not drawn as above-ground elevation.

No new dependencies, Three.js, D3 runtime, WebGL, canvas renderer, automatic
rotation, live fetching, animation loop, persistence, filtering, connection arcs,
promo/export integration, package version bump or publication in this slice.
Existing FoldKit, Effect, Astro and Viz dependencies remain unchanged.

## Current evidence and proposed files

The design baseline is clean `main` at `bf87c0a`. Workspace FoldKit is 0.167.0;
Viz's manifest is 0.11.0, with unreleased workspace additions. A version string
does not establish npm availability. No existing implementation is changed here.

- `packages/foldkit-viz/src/shape/geo.ts`: an existing simplified projection
  layer. Its orthographic formula is useful, but it lacks rotation and spherical
  clipping. A disk-shaped SVG clip cannot by itself hide far-side geometry.
- `apps/web/src/ui/map-projections-chart/`: existing geographic SVG rendering.
- `apps/web/src/ui/phyllotaxis-chart/` and `zoomable-line-chart/`: existing
  pointer interaction and Model-owned view state; reuse applicable patterns.
- `apps/web/src/ui/shared/svg-root.ts`: existing keyboard/accessible SVG frame.
- `skills/foldkit-viz/SKILL.md`: pure geometry and parent-owned interaction rules.

Proposed implementation ownership:

- `packages/foldkit-viz/src/shape/globe.ts` and `test/globe.test.ts`: additive,
  pure point projection and open-line horizon clipping; no runtime/state owner.
- Package export/build/declaration maps and source notices: expose the additive
  `/shape/globe` subpath consistently; preserve existing exports and behaviour.
- `apps/web/src/apps/earthquake-globe/`: snapshot decoding, immutable data,
  Model, typed Messages, update and FoldKit view. Keep domain data out of Viz.
- `apps/web/src/pages/earthquake-globe.astro` and the gallery link: ordinary
  Astro embedding, with no integration/runtime changes.

## Architecture decision: orthographic SVG, not a 3D runtime

Status: accepted with the written design on 2026-10-14. This section is the
durable decision record in the repo's existing spec convention; no new ADR
directory or parallel workflow documents are scaffolded.

### Context

The user requires pure FoldKit and no new dependencies. Existing geo functions
cannot currently support a correct rotating globe unchanged. A new renderer
would add lifecycle, picking and disposal concerns while weakening that intent.

### Decision

Use FoldKit-rendered SVG and an additive, framework-independent globe geometry
module. Derive view geometry from immutable data and current Model values.
Reference official D3 algorithms without installing D3 at runtime. Do not alter
`ProjectionObject`, `geoOrthographic` or `geoPath` semantics for current callers.

### Options, consequences and trade-offs

1. Additive pure globe module: selected. Narrow, testable geometry and ordinary
   FoldKit rendering; a new public subpath requires export and consumer checks.
2. Extend the existing general projection/GeoJSON stream: deferred. Rotation,
   polygon clipping and resampling would broaden compatibility obligations.
3. Three.js/Three-Globe: rejected by the user; introduces new runtime dependencies.

SVG supports the desired appearance and inspectable marks without GPU resource
management. It does not provide physical lighting, raised geometry or general
3D rendering. The back hemisphere is intentionally hidden; the table preserves
access to every accepted event. Performance is qualified against the recorded
fixture, not a blanket large-dataset claim.

Follow-up: none automatically authorised. Review this decision before expanding
to country polygons, live data or another rendering backend.
Review point: written-spec approval and first browser qualification.

## Decision challenge and boundaries

Trigger: additive public geometry contract and source/provenance boundary.
The platform already owns SVG, events and lifecycle; USGS owns the observations.
Viz owns pure geometry, while the app owns data validation, camera, selection,
accessibility and display policy. No shared application controller is added.

Strongest counterargument: this can grow into a partial cartography engine and
encourage a visually attractive but misleading earthquake display. Limit the
geometry to points/open graticule lines, retain provenance and exact event data,
and explicitly exclude geographic polygon parity and live/safety claims.

| Claim                                    | Observed evidence                                           | Gap / acceptance                                                         |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| No new dependency is needed              | Existing FoldKit SVG/events and pure Viz layers             | Dependency manifests/lockfile unchanged; rendered browser proof required |
| Existing projection is incomplete        | Source omits rotation and clipping                          | Front/back, horizon and rotation tests before implementation             |
| D3 is an appropriate algorithm reference | Official orthographic, rotation and circle-clipping sources | Pin actual source commits and preserve notices before porting            |
| Snapshot is a stable oracle              | USGS defines event IDs and GeoJSON fields                   | Actual captured bytes, provenance and decoder checks not yet obtained    |
| Globe is useful and accessible           | Proposed list/selection/keyboard design only                | Browser, keyboard and task acceptance still unobserved                   |

Verdict: **proceed** for this written design only. Boundary review: **safe with
noted risk** under the stated ownership and compatibility limits. Stop before
implementation until the spec and then implementation plan are approved.

## Data contract and provenance

The input is USGS GeoJSON, with coordinates ordered longitude, latitude, depth
in kilometres. Preserve stable event IDs, magnitude, location, event time and
official source URL. Keep unknown magnitude/depth distinct from zero; accept
finite negative measurements rather than inventing positivity constraints.

Decode the envelope at the app boundary. A malformed envelope or duplicate event
ID is a fixture failure. Exclude non-earthquake entries and rows with unusable
IDs, times or geographic coordinates; report exclusion counts/reasons rather
than silently dropping or fabricating locations. Coordinates must be finite,
longitude within [-180, 180] and latitude within [-90, 90]. Null optional display
fields remain explicit unknowns. Invalid optional numeric values become unknown
with diagnostics. Never coerce strings into measurements.

The accepted event collection is readonly. Sort a copy by descending event time,
then ID for ties. Use IDs for selection and rendered keys, never array positions
or place labels. Preserve raw measurements in details, including negative depth.
External links must be HTTPS USGS event links, not arbitrary feed-provided URLs.

Display the observation window, captured/generated UTC timestamps, source and
accepted/excluded counts. These are recorded observations, not "live" data.
All chart/data assets are local; tests never depend on the current feed or clock.
The snapshot must not be fabricated or silently resampled. A feed fetch/provenance
failure stops capture instead of substituting a synthetic dataset.

## Pure globe geometry contract

The additive module accepts geographic coordinates and a finite view centre,
positive radius and translation. The screen convention is east to the right,
north upward, with the supplied centre at the SVG centre. Rotation is spherical,
not independent longitude/latitude subtraction or a planar SVG transform.

Point projection returns screen coordinates plus a facing/visibility value
separate from earthquake depth. Do not emit far-side markers or interactive
targets. Treat the mathematical horizon consistently with a documented numeric
tolerance; projection and line clipping must share that policy. Invalid numeric
configuration is rejected, not converted into NaN SVG attributes. Input arrays
are never mutated.

Open graticule lines are clipped in spherical space before projection, inserting
horizon intersections and splitting visible segments. Do not join across an
invisible run or use a disk clip as a replacement for hemisphere visibility.
A final SVG disk clip may constrain marker edges at the limb. General polygons,
adaptive geographic resampling and full D3 projection API parity are not claimed.

Reference the official D3 sources listed below. The expected local `d3-main/`
reference checkout is absent at this baseline; before code changes, restore or
retain exact upstream source snapshots with commit hashes and licence records.
Reference-only retrieval is not permission to install D3. Do not assume an
existing source-header licence label is correct without checking upstream.

## Model, interaction and visual contract

The app Model owns the geographic view centre, zoom, selected event ID and a
tagged idle/dragging gesture. Geometry and marker appearance are derived values,
not a second mutable camera or event store. Use existing typed past-tense Message
and update patterns. DOM measurements/events remain ordinary FoldKit effects.

Start centred on the Pacific at longitude 180, latitude 0, zoom 1. Normalise view
longitude to [-180, 180) and clamp view latitude to [-90, 90]. Drag deltas are
relative to the gesture's start centre and measured globe radius; do not apply
cumulative deltas repeatedly. Ignore unrelated pointer IDs. End dragging on
release, cancellation or leaving the active interaction surface. Do not mutate
the DOM directly or continue a hidden subscription after unmount.

Zoom buttons adjust by a factor of 1.25 within [1, 2]. Reset restores the default
view and clears the gesture/selection. Arrow controls turn by 15 degrees with
equivalent keyboard actions. Handled keys prevent default only while the chart
control is focused; do not hijack page scrolling. No automatic spin or inertia.

Marker/table activation selects a stable ID; table activation also recentres
the view. Ordinary rotation preserves selection/details even if the event moves
behind the globe, while hiding its marker. Invalid IDs are no-ops. Dragging must
not accidentally activate a point on release. Tooltips and selection are not
pointer-only: the table supplies a complete keyboard inspection path.

Use a responsive, unframed SVG scene with a compact toolbar, labelled legends,
details and an event table. Reuse theme tokens and existing scale/colour helpers.
Magnitude radius is a bounded display encoding, not proportional seismic energy:
map [-1, 8] linearly to [3, 10] SVG units and label/clamp the display range.
Unknown magnitude uses a distinct hollow marker. Depth colour uses a labelled
[0, 700] km display range, with an explicit unknown style; preserve unclamped
measurements in details. No colour-only selection, severity or prediction cues.

Invalid/empty data has a clear message and usable navigation, not invented points.
Small screens must retain controls, details and the list without overlap. This
slice does not require a land texture, decorative lighting or an external atlas.

## Verification and acceptance

Meaningful tests precede implementation and assert independent expected results:

- Projection: centre, cardinal directions, poles, dateline-adjacent coordinates,
  rotation round trips, all-hidden points and non-finite/invalid configuration.
- Visibility/clipping: opposite-hemisphere points rejected; exact/near-horizon
  points consistent; graticule enters/exits at the limb without chords through
  hidden geometry. Original unclipped orthographic behaviour must fail a witness.
- Decoder: USGS coordinate order, null/negative fields, non-finite/out-of-range
  coordinates, non-earthquake records, duplicate IDs, stable ordering and frozen
  inputs. Expected examples are not calculated using the implementation itself.
- Updates: reset/zoom limits, pointer identity/cancellation, no drag-click
  confusion, selection persistence behind the globe, table recentering and
  keyboard equivalence. No state or subscription leak after unmount.
- Rendering: no hidden-side marker or focusable target, finite paths/coordinates,
  truthful recorded-time labels, unknown-value styles and accessible table/details.
- Browser: desktop/mobile screenshots and pixel checks show a nonblank, correctly
  framed globe; drag/zoom/selection alter the expected scene; keyboard, touch,
  themes, empty/failure and route-exit/re-entry are checked. Treat automated
  geometry tests as distinct from live browser acceptance.

Before editing, establish repo-required typecheck/lint baselines. Before claiming
implementation complete, run `bun run check`, `bun typecheck`, and `bun run test`
from the workspace root. Do not run unfiltered root `bun test` through upstream
reference trees. Build/package-import checks must cover the proposed additive
export/declarations; retain workspace-only/unpublished status without a release.

No verification or performance result is claimed by this design. EHS dogfood is
ordinary engineering observation with mandatory host guidance, not isolated
EHS effectiveness or a comparative benchmark. Any extra agent trial requires
its own scope, payload and delegation consent.

## Source references and next gate

- [USGS GeoJSON summary and seven-day feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php).
- [D3 orthographic projection source](https://github.com/d3/d3-geo/blob/main/src/projection/orthographic.js).
- [D3 spherical rotation source](https://github.com/d3/d3-geo/blob/main/src/rotation.js).
- [D3 spherical circle-clipping source](https://github.com/d3/d3-geo/blob/main/src/clip/circle.js).
- [D3 upstream licence](https://github.com/d3/d3-geo/blob/main/LICENSE).

Review this written scope, especially the points/graticule-only first slice,
additive geometry boundary and interaction/data policies. Spec approval permits
writing the implementation plan, not starting product code. The plan must then
be reviewed and its execution method chosen before implementation. No fixture
capture, dependency installation, code, release or independent agent trial has
run during this design step.
