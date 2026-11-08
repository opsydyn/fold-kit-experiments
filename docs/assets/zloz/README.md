# Zloz logo concepts

Three authored SVG studies. **B — Nested frame is the user-selected direction**;
the [final asset set and usage rules](final/README.md) are now available. Review them at
`http://127.0.0.1:4328/brand/zloz/` after building and previewing `@opsydyn/promo`
with `--host 127.0.0.1 --port 4328`.

| Concept               | Meaning                                            | Tradeoff                                     |
| --------------------- | -------------------------------------------------- | -------------------------------------------- |
| A — Assembly junction | Three faceted parts meet around an open port       | Distinct and compact, but abstract           |
| B — Nested frame      | A folded system boundary, inner element and bridge | Explicit containment; can read as a document |
| C — Connected planes  | Independent pieces joined by a stepped connection  | Open silhouette; less detail at small sizes  |

The user selected **B — Nested frame** on 2026-11-08, superseding the initial
recommendation of A. Preserve the folded boundary, inner element and bridge
during refinement. The review shows all concepts beside the actual Viz folded-strip and Three
cube geometry, using the existing family typography and light/dark palette.

## Asset contract

- Color SVGs are canonical geometry on a 32×32 grid, with CSS-variable fills and
  standalone light-palette fallbacks. No fonts, external resources or SVG IDs.
- Monochrome SVGs preserve that geometry and use `currentColor`. Regenerate with
  `node docs/assets/zloz/generate-mono.mjs` after changing a color source.
- Standalone marks include a title and accessible name. Beside a visible product
  name, the review hides the decorative SVG from assistive technology.
- The review includes 16, 24 and 32px proofs plus monochrome at 32px. The SVG grid
  includes internal breathing room. See the final identity guide for minimum-size
  and clear-space rules.
- Use **Foldkit Zloz** publicly. **Złóż** appears only in the name's explanation.

The reusable comparison component is
[`ZlozFamilyHeader.astro`](../../../apps/promo/src/components/ZlozFamilyHeader.astro).
It imports existing Viz and Three favicon sources, rather than copying their
geometry. It is a static comparison header, not the final shared site navigation.
No runtime package names, imports, saved formats or deployed sites change here.

See [the brief](../../assessments/2026-11-08-zloz-logo-and-site-brief.md) and
[visual evidence](../../../apps/promo/evidence/zloz-logos.md).
