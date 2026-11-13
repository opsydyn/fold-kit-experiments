# ADR 0074: Measure intrinsic group headings

## Status

Accepted for the approved opt-in group-heading measurement slice, 2026-11-13.
Architecture, boundary, delivery and test-quality reviews are **self-review**.

## Decision

Introduce `LayoutGroupHeaderSpec` (identity, padding, gap) independently of the
sized `LayoutGroupHeader`. Native C4/DDD `groupHeader` options discriminate declared
sizing from `sizing: 'intrinsic'`. Intrinsic options need no width/height. They use
natural max-content dimensions, retain the existing positioning/content/control
slots and keep collapsed headings compact. The measured target is the complete
HTML heading/drag border box, marked with the existing group-header attribute.

Core exposes transient `ZlozGroupHeaderMeasurements` state and start/update/resolve
functions. Start validates existing unique groups, spacing, visibility and request
identity, then copies specs and the collapsed-group snapshot. Requests capture
editor revision, exact graph serialization and caller-owned render key. Collapsed
or hidden requested headings must be expanded before starting. Current results
require every requested heading once with positive finite dimensions; measured
sizes plus spacing must remain finite. A ready state combines measured sizes with
copied padding/gap into complete layout declarations. Invalid batches fail together;
old IDs, revisions, source, renderer and visibility results cannot publish or
resolve usable bounds. Resolve again before starting ELK and before applying its
completion. Cancelling replaces state with idle; new runs need fresh IDs.

Extract shared freshness, complete-batch and detached-bounds helpers from edge
measurement, preserving its public request/result shapes. Extract the scoped
native box observer into one private resource used by both Mount adapters. It
waits for font readiness, supports fractional border-box dimensions and physical
mapping of vertical writing modes, and cleans observer/timer on completion or
unmount. Nested native canvases are isolated even when a child canvas is not
measuring. Missing/duplicated/zero-sized/fragmented/unsupported targets fail. The
same positive finite 3000ms default / 60000ms maximum deadline applies. SSR hooks
are inert. Native font loading itself continues after cancellation; callbacks are
suppressed. No application state or DOM mutation is hidden in the observer.

Foldkit exposes `zlozView.groupHeaderMeasurement` and composable
`zlozGroupHeaderMeasurement` for custom scoped hosts. The probe lives directly
inside a `data-zloz-group-header-measurement-scope` host, targeting HTML elements
marked `data-zloz-group-header=group ID`. The normal view manages its scope/probe;
C4/DDD renderers provide targets. Headless core remains browser/Effect independent.
No source, graph, history, receipt, CLI or export wire format changes are made.

## Workbench and alternatives

Domain review defaults remain unchanged. Measure intrinsic heading adds summary
and provenance content variants, Measure/Cancel and explicit Arrange. Heading and
edge measurement have separate state and may supply one layout together. Content
or heading-mode changes cancel pending heading work and layout. Theme belongs in
the render key. The host rechecks heading freshness when ELK finishes. Successful
layout consumes the revision, so another arrangement needs fresh measurements.
Arrange retains focus through aria-disabled protection and reducer guards.
Working graph/Undo, source projection and all findings stay separate and unchanged.

A fixed declared size would leave content sizing manual. Screen-rectangle division
by an old camera zoom would create incorrect bounds after asynchronous rendering.
Duplicated per-feature observers would split cleanup/isolation logic. Continuous
measurement/auto-layout would add feedback loops and policy/Undo obligations. The
selected explicit batch design shares existing lifecycle guarantees and keeps
measurement independent from layout and semantic source data.

## Scope, qualification and rollback

One HTML border box is observed. Margins, overflow, local transforms, shadows,
portals, SVG targets and later image/font/style changes need explicit handling.
Render all requested targets; disable culling or choose a rendered subset. Renderer
keys must cover every size-affecting option, spacing and resource version; hosts
must cancel/supersede requests when view configuration changes. Group-relative
percentage sizing may change after layout and is not stabilized automatically.
Reserve separately placed controls explicitly through padding/custom slots.

Test complete/invalid/overflowed batches, detachment, source/revision/renderer and
collapsed/ancestor visibility, replacement and cancellation. Keep edge measurement
regressions. Test native group/edge target isolation, SSR/deadlines and intrinsic
C4/DDD sizing. Install actual tarballs for runtime and strict-type qualification.
Workbench tests execute ELK and reject renderer changes during completion. Browser
checks actual summary/provenance sizes, Cancel/content replacement during delayed
font readiness, focus, both layout directions, zoom independence, combined edge
measurement, themes/Minimal mode, source findings and working-model equality.
Inspect captures and run root typecheck/check/tests and production build.

No dependencies, provider activation, publishing or deployment are added. Existing
Alchemy SDK/publication gates remain. Revert the local commit to roll back.
