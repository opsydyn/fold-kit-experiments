# Plot beyond Cartesian — design

**Status:** approved for foldkit-viz 0.22.0, 2026-11-14. Fifth release of the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13),
extending [ADR 0037](../../adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md).

## Goal

Every remaining chart demo is a plot spec: polar charts, maps, networks and
trees. `apps/web/src/ui` keeps no chart modules except the two the reference apps
use, and the three demos that show primitives rather than charts.

## Principles kept

- The spec stays JSON: GeoJSON goes into a spec as data, and layouts (trees,
  packing, chords, forces) run at compile time into static geometry.
- Geometry stays pure; renderers gain only what new geometry needs to draw.
- Errors are RangeErrors that start with the spec path.

## Polar coordinates

- A plot-level `coordinates: 'polar'` maps x to angle and y to radius, inside
  the largest circle that fits each facet less room for labels.
  `polar: { inner?, start? }` sets the inner radius as a share of the outer
  (default 0) and where the angle starts, in degrees clockwise from twelve
  o'clock (default 0).
- A band x gives each category an equal sector; a continuous x spans the full
  circle. y is linear from the inner to the outer radius, from zero.
- Marks in polar coordinates:
  - bar: a wedge per row, from its start (zero, `y0`, or its stack) to its
    value, so stacked bars become wind roses.
  - line and area: points placed by angle and radius. A band x closes the
    shape, so a line or area over categories is a radar.
  - dot and text: placed by angle and radius.
  - rule: a circle for a y value, a spoke for an x value.
  - Any other mark is an error naming the spec path.
- Facets carry a `polar` frame (centre, radii, angular and radial ticks) instead
  of x and y axes. Renderers draw rings at the radial ticks and spokes at the
  angular ticks, labelled outside the outer ring.

## Arcs

`{ mark: 'arc', value, fill?, text?, inner?, start?, end?, padAngle?, labels? }`
fills its panel with a pie: one slice per row, in row order, between `start`
and `end` degrees (default a full circle). `inner` makes a donut and `text`
writes the first row's value in the middle, so a gauge is a facet per metric
with a filled and an empty slice over a partial circle.

## Maps

- A plot-level `projection: { type, rotate?, zoom?, center? }` with type
  `equirectangular`, `mercator`, `naturalEarth1`, `orthographic` or `albers`.
  The projection is fitted to every geo mark's features in each facet; `zoom`
  scales about `center` (longitude, latitude), for zoomable maps.
- `{ mark: 'geo', features }` draws GeoJSON (a feature collection, a feature, a
  geometry or a sphere). Its rows are the features' properties, with the feature
  `id` as `id`, so `fill: 'gdp'` reads a property and a choropleth is features
  whose properties carry the data.
- `{ mark: 'graticule', step? }` draws lines of latitude and longitude.
- In a projected plot dot and text marks place x as longitude and y as latitude
  through the projection; there are no x and y axes. Other marks are an error.

## Networks and trees

Each fills its panel and runs its layout at compile time.

- `tree`: rows with a `path` field, as treemap takes, laid out tidy (default) or
  as a cluster with all leaves level, left to right or `radial`. Links are curved
  paths, nodes are dots, labels sit beside them.
- `pack`: circle packing of `path` and `value`. A node takes the fill of its
  first leaf row, so colour by a top-level field colours each group.
- `chord`: rows of `source`, `target` and `value` make a flow matrix. Groups are
  outer arcs in categorical colours by name, and ribbons take their source's
  colour.
- `arc-diagram`: rows of `source`, `target` and optional `value`. Nodes sit in
  order of first appearance along the bottom of the panel, with a semicircle
  above for each link, its width from `value`.
- `force`: rows of `source` and `target`. Nodes take positions from a seeded
  force layout run to a fixed number of iterations, so the output is stable.

## Voronoi

`{ mark: 'voronoi', x, y, fill?, stroke? }` draws each point's Voronoi cell,
clipped to the plot area, on Cartesian axes.

## Demos moved into the grammar

Radar, wind rose, donut, gauge, choropleth, zoomable choropleth, map
projections, chord, arc diagram, force graph, packed circles, tidy tree, radial
tree and Voronoi become specs; zoomable choropleth and map projections stay
small apps over specs. Their `ui` modules are removed.

## Exit criteria

Every chart demo is a library spec except the three that show primitives
(easing curves, colour spaces and phyllotaxis), and `apps/web/src/ui` holds no
chart modules beyond `histogram-chart` and `scatter-chart`, which the reference
apps use.

## Outcome, 2026-11-14

- Implemented as designed, with these differences:
  - Polar sectors are centred on their category, so the first points straight
    up, as compass and radar charts expect.
  - A radial tree labels only its leaves.
  - Radial tick labels sit midway between the first two spokes.
- Two existing primitives had bugs, now fixed:
  - `math/delaunay`'s orientation test had the opposite sign to the
    robust-predicates convention Delaunator assumes, so triangulations were not
    Delaunay and Voronoi cells missed their sites. There is now a regression test.
  - `shape/geo` drew rings that cross the antimeridian straight across the map.
    It now unwraps their longitudes so they carry on past the edge.
- Choropleths with missing data layer one geo mark of every country under a
  second filled from the data, because a continuous colour scale has no "no
  data" colour.

## Out of scope

Projected lines and areas, orthographic clipping at the horizon beyond what
`shape/geo` does, animated force layouts, and polar zoom.
