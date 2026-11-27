# ADR 0128 — Evaluate a standalone Astro Effect UI renderer

Proposed for the private preview on 2026-11-26. Review after the browser fixture
passes and upstream publishes its upgrade guide.

Astro controls island activation and navigation. Effect UI owns each component
tree and its scope. The renderer connects the two through Astro's renderer API
and Effect UI's HTML hosts. It transfers only the state needed to adopt the
server-rendered tree. Components used in this pilot must put only public data
in their serialized model and queries.

Keep the private renderer under `experiments/astro-effect-ui` with its own
preview dependency. A second backend in the existing integration would couple
the preview lifecycle to FoldKit's application wrapper, build plugin and
DOM replacement. An application-local script could prove mounting, but would
leave Astro's renderer and activation contract untested. Reuse the existing
adapter's verification cases and keep the new renderer independently installable.

Test static HTML, two instances of one component, adoption by DOM identity,
retained and removed roots across Astro client navigation, and scope finalizers.
Use Astro's built-in directives for the first slice. First-interaction replay
requires an adoption-aware directive and a decision about directive ownership
on mixed pages. Full-page metadata and Flags, Astro slots, broad version
compatibility and npm publication require their own qualification.

## Shared Dataset Explorer

The shared component owns selection, retained snapshots and the response log.
Astro supplies the Web API or the Promo fixture base path as props. The
standalone export starts the same component with local fixtures. The first
request starts on the browser mount so Astro can render the controls without
fetching a snapshot while building the page.

The explorer keeps its request generations in the model. The race demo needs
both responses to finish and be visible in the log even when the slower
response is superseded. Using the runtime query cache for this example would
make that logging depend on the host's handling of superseded requests.
The component therefore uses scoped Effect UI commands and accepts a result
only for the pending generation of its transport and station. The browser
mount owns resize and hash listeners.

The source tokenizer and line-link construction are shared with the remaining
examples. Their existing FoldKit adapters stay available while those callers
migrate. The standalone export copies the explorer's Effect UI sources and
the pure Viz modules it imports. Its browser entry supplies SVG metadata
creation for the pinned preview, since its npm install does not apply the
monorepo's Bun patch.

The Promo editor launcher is a separate Effect UI island. Effect UI owns
the revision-keyed host and its mount scope, while the StackBlitz SDK
owns the host's children. Closing hides the host to retain in-page edits.
Restart replaces its key and releases the old mount. Unmount removes the
iframe and aborts the template fetch. The download link is available in
the initial HTML.

## Promo Histogram

Astro renders the same Effect UI component used by the Histogram starter.
Viz remains responsible for binning and chart geometry. The component owns
measured width, dataset, bin count and export feedback. Its export command
captures settings when requested and the download generator applies those
settings to the starter. Dataset Explorer and Histogram share the Effect UI
source renderer, highlighter and scoped hash listener. The npm starter uses
the same SVG metadata host as the Dataset Explorer starter.

The FoldKit source renderer remains available to the examples that still
consume it. Histogram's starter vendors the Effect UI source renderer and
the pure Viz modules used by its geometry.

## Cartesian chart views

Viz exposes a small Effect UI Cartesian renderer for the SVG frame, grid,
axes and accessible data table. Scatter, Histogram and Dataset Explorer
use those pieces with their existing Viz geometry. The consuming component
supplies its own marks, keyboard messages and selection rules. A frame with
keyboard inspection cancels the browser default only when the handler
returns a message, so Tab can leave the chart normally.

The standalone site exports include this Viz subpath and its declarations.
The FoldKit adapter stays available to its remaining callers while they
migrate.
