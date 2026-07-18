# Viz Selection Contract Design

## Context

`@opsydyn/foldkit-viz` already provides pure, chart-local brush state in
`math/brush`, while `apps/web` owns a histogram-to-scatter filter example.
The parent app currently derives filtering directly from the histogram's private
brush state. This makes the interaction difficult to reuse across charts and
does not establish a shared contract for future hover, active-series, or zoom
interactions.

This slice establishes the first public interaction primitive without adding a
FoldKit runtime, DOM event handling, or Astro lifecycle behaviour to Viz.

## Decision

Add a pure public `@opsydyn/foldkit-viz/interaction/selection` module. It
defines a discriminated `Selection` union with three states:

- `None` represents no active parent-owned selection.
- `Interval` represents a normalised continuous-domain selection on either the
  `x` or `y` axis.
- `Keys` represents stable datum identities for future hover and active-series
  coordination.

The module exposes constructors and pure query helpers for normalisation,
clamping, clearing, domain membership, and key membership. It has no FoldKit or
browser dependency.

`math/brush` remains unchanged as a local pixel-gesture primitive. It converts
pointer movement into a chart-local pixel extent; it is not the cross-chart
selection contract.

## Ownership And Data Flow

`apps/web/src/apps/histogram-brush` owns `selection: Selection` in its parent
model, initially `None`.

1. The histogram processes its existing brush message and maintains its local
   pixel brush state.
2. The parent reads `Histogram.getBrushDomain()` from the updated histogram.
3. A present domain becomes `Selection.Interval` on the `x` axis. An absent
   domain becomes `Selection.None`.
4. The parent derives filtered scatter data solely from `selection`, rather
   than from the histogram's brush state.
5. Scatter hover and keyboard messages remain chart-local and do not replace
   the parent selection.

The current brush UX is retained: ranges below the chart's existing minimum
pixel extent clear the selection, and the clear action restores every scatter
point.

`Selection.Keys` is intentionally delivered as an extension point, not wired
into the histogram/scatter example in this slice. A future hover or active
series implementation can publish keys through the same parent-owned model.
Likewise, a future zoom implementation can update an interval selection without
requiring a new shared state shape.

## Public API And Compatibility

The selection API is exported from both:

- `@opsydyn/foldkit-viz`
- `@opsydyn/foldkit-viz/interaction/selection`

The package manifest will gain the matching `exports` and `typesVersions`
entries. Existing `math/brush` and `math/zoom` imports remain supported and
unchanged.

This is an additive minor-package capability. It does not add a runtime
`foldkit` dependency to Viz and does not alter Astro package APIs.

## Tests And Documentation

Add focused Viz tests for:

- interval normalisation and clearing invalid/empty intervals;
- clamping an interval to a domain;
- domain and key membership queries.

Update histogram-brush tests to prove:

- a brush transition stores the equivalent parent-owned interval and filters
  the scatter data;
- clearing stores `None` and restores all points;
- non-brush scatter messages do not change the parent selection.

Document the selection ownership boundary in the Viz README and mark the
corresponding first interaction-layer roadmap item complete. Keep the later
linked-view, keyboard, accessible-summary, and property-test roadmap work
unchecked.

## Verification

Run:

```sh
bun run check
bun typecheck
bun run test
git diff --check
```

The complete root suite must pass. The smoke packaging test must run without
being scheduled concurrently with commands that rebuild package `dist`
directories.
