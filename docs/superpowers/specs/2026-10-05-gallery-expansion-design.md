# Foldkit Viz gallery expansion

Approved scope: expose the existing chart breadth on the promo site, add grouped and stacked bars, add a configurable word cloud, and provide SVG paint and measured text-layout utilities.

## Boundaries

Keep the six homepage cards curated. Expand `/examples/` with additional families rendered through existing Viz primitives: bars, area, streamgraph, donut, radar, heatmap, treemap, packed circles, tree, box plot and violin. Add working native Foldkit examples for grouped/stacked bars and word cloud. Existing line, histogram, scatter and dataset explorers remain available.

Geometry accepts caller data and accessors and returns coordinates without DOM, Foldkit, Effect or D3 runtime dependencies. Colours and SVG definitions belong to an optional Foldkit adapter. New bars support grouped/stacked and vertical/horizontal layouts, preserve datum identities, include zero and handle signed values.

Word cloud accepts measured text bounds, padding, rotation and a spiral strategy. Use deterministic size-first placement based on d3-cloud's documented spiral approach, with conservative rotated bounding rectangles rather than pixel sprites. Return omitted words explicitly; do not silently shrink them. Browser font loading and text measurement run in Commands, with revision checks to discard stale results. No new D3 dependency.

SVG paint utilities render caller-named dot/hatch patterns and linear/radial gradients. IDs remain caller-owned to prevent collisions. Text wrapping consumes a measurement callback, preserves explicit line breaks and marks overflow; it performs no browser work itself.

## Acceptance

Light/dark and narrow layouts work. Native controls alter geometry through Model → Message → update. Word cloud offers spiral, rotation and padding controls with keyboard-focusable words and a complete data table. Bars offer grouping and orientation controls with an accessible data table. Examples include readable source/configuration. Tests cover signed and sparse bars, cloud collisions and containment, stale measurement results, wrapping and invalid inputs. New public subpaths build and import in an external consumer. Required workspace checks and native browser QA pass before committing.
