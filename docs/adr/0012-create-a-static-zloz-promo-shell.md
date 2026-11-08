# ADR 0012: Create a static Zloz promo shell

## Status

Accepted for the approved Zloz promo-shell slice, 2026-11-08. Extends ADR 0011.

## Decision

Create private `apps/zloz-promo`, using the existing Astro and Fontsource Inter
catalog versions. Astro owns the document, navigation, theme preference and
static downloads. The home page uses the selected Nested frame asset and the
Viz/Three family styling with the approved Compose / Model / Communicate copy.

Generate a real C4 system-context preview from an app-owned fixture through the
public core architecture/geometry APIs at build time. Use the optional Mermaid
package for its source, identity and explicit loss report. Publish canonical JSON
and the complete Mermaid bundle as static downloads. Label the preview static;
editing belongs in the separately running workbench. No app-to-app source imports
or graph runtime changes are required. Brand SVGs retain their existing source.

Keep configurable base paths and workbench URLs. Default workbench links are
explicitly local. No canonical production origin is assumed. No hosting workflow,
credentials, npm names or package publication is changed. Add the workspace to
local root build/dev commands without deploying it through existing Pages CI.

## Alternatives and consequences

Embedding the whole workbench would complicate a promotional shell and duplicate
its controls. A decorative graph would fail the real-model requirement. A new
design-system package would expand scope; reuse the existing visual vocabulary
in app-owned CSS, matching its tokens and responsive family layout. Interactive
Foldkit examples and broader docs remain a subsequent slice.

Code examples reuse the Viz/Three shared highlighting engine, token-tree renderer,
source-line anchors and light/dark syntax stylesheet from the private dataset
explorer package. Highlight once at build time with a shared server engine; no
grammar/WASM highlighter is sent to the browser. Existing catalog-managed HAST
serialization and Oniguruma dependencies match the sibling promo apps.

Boundary review: **safe**. Allowed dependencies are Astro, local font assets,
the public graph core, optional Mermaid exporter and existing shared highlighting
utilities. The promo owns only its
fixture and presentation; package geometry, serialization and conversion remain
in packages. Verify static content without JavaScript, theme persistence/system
and blocked-storage behavior, download fidelity/loss visibility, nested base
paths, mobile layout and local links before committing.
