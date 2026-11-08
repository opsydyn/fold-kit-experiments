# ADR 0011: Align Zloz with the Viz and Three family

## Status

Accepted for the user-approved Nested frame identity and family styling slice,
2026-11-08.

## Decision

Use the existing Viz/Three neutral light/dark surfaces, blue primary accent,
coral/gold secondary colors and Inter Variable typography for Zloz's board and
promo. The selected Nested frame mark supplies its distinct identity.

The private board app declares the same catalog-managed Fontsource Inter
dependency as the promo apps. Fonts are bundled locally; no third-party font
request is needed. SVG wordmarks contain outlined lettering generated from that
font, with its OFL notice retained alongside the assets. Generation tooling is
an asset-generation concern, not a graph runtime dependency.

Keep brand assets in `docs/assets/zloz/final`. The Astro shell consumes the SVG;
the board maps family CSS variables through the existing public FlowTheme API.
Do not change package defaults, public token names, graph data or saved theme
preference keys. The dedicated Zloz promo will reuse this visual direction.

## Alternatives and consequences

A separate green identity would contradict the user's family consistency
requirement. Importing another app's font styles would create an app-to-app
runtime dependency. A new shared design-system package is disproportionate to
this visual slice. Keep the existing app-owned styles, document matching family
values, and check the rendered board in both themes against the promo palette.

Boundary review: **safe**. Only private app styling/dependency metadata and brand
assets change. Existing headless and Foldkit adapter contracts remain intact.
Native inputs, system preference, persistence, graph actions and Undo retain
their existing ownership. Publication and deployment remain separate slices.
