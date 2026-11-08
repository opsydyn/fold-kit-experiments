# Foldkit Zloz — Nested frame identity

Selected by the user on 2026-11-08. Preserve the folded boundary, inner element
and bridge as a single mark. Geometry is the approved B study, now packaged for
use with production names, portable outlined lettering and theme variants.

## Assets

- `mark.svg`, `wordmark.svg`: theme-adaptive inline SVGs. Set `--blue`, `--gold`,
  `--coral` and text `color`; standalone fallbacks use the light palette.
- `*-light.svg`, `*-dark.svg`: fixed family palette for each background. Dark
  variants belong on dark surfaces; these files have transparent backgrounds.
- `*-mono.svg`: `currentColor`, black standalone. Inline them for inherited ink.
- `favicon.svg`: responds to the browser's light/dark preference independently
  of the host site's saved theme. The board's public favicon is generated from it.
- `Inter-OFL.txt`: font attribution/license for the outlined Inter lettering.

The SVGs have accessible titles and no external resources or font dependencies.
Hide decorative marks from assistive technology when adjacent text already names
the product. Do not stretch, rotate, detach the bridge or recolor individual parts
outside the family palettes.

## Scale and spacing

The mark uses the family's 32×32 grid. Minimum display size: 16px; prefer 24px or
32px in navigation. Display the wordmark at least 40px high. Leave clear space of
at least one quarter of the mark's width (8px around a 32px mark), measured outside
the SVG box. No effects or containing badge are required.

Both sites and the board use Inter Variable, neutral backgrounds (`#faf9f6` /
`#111319`), neutral panels (`#fffefa` / `#191c24`), blue primary accents
(`#3d79fa` / `#4485ff`) and family coral/gold secondaries. This matches Viz and
Three. Dark green is not the Zloz shell identity. Semantic diagram content remains
customizable through package APIs.

## Regeneration

Install the existing Bun workspace dependencies, then run from the repo root:

```sh
uv run --with fonttools==4.60.1 --with brotli==1.1.0 docs/assets/zloz/generate-identity.py
```

The script reads the selected study and locally installed Fontsource Inter at
weight 740. It outlines the ASCII wordmark, writes these variants and updates the
board favicon. The font tools are generation-only; they do not ship in the apps
or graph packages. Reinspect the light/dark proofs after changing any source.
