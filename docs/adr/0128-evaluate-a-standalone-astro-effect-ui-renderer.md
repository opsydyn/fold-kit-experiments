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
