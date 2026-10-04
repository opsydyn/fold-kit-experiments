# Foldkit Viz promo site

The approved light and dark mockups define the visual direction: an editorial
studio with a folded ribbon mark, oversized “Give your data shape.” headline,
layered chart hero, six curated examples and a short path into code.

## App boundary

Create `apps/promo` as private workspace `@opsydyn/promo`, using Astro 7.1.1
and TypeScript. Generate a static site; no hosting adapter or deployment is
required. Existing `apps/web` remains the integration demonstration app.

Use `@opsydyn/foldkit-viz` through workspace module imports to calculate SVG
geometry at build time. Do not copy chart algorithms, import the demo app's
internals, add D3 or display mockup images as the website. Astro owns page
chrome and its small theme script; no application effects or remote chart
state are introduced.

## Pages and content

- `/`: approved hero, three principles, six chart tiles, quick-start teaser,
  footer. Hero values are illustrative monthly activity. Hover and keyboard
  focus reveal individual month totals.
- `/examples/`: the same six examples with larger plots, explanations and
  links to the exact primitive source. Curves have native radio controls to
  compare precomputed SVG paths without application JavaScript.
- `/docs/`: installation, a working scale/line/SVG example, module links,
  architectural boundaries and links to the existing integration source.

Navigation, CTA buttons and footer links must lead to real pages or source
locations. Illustrative datasets must be labelled. Use a regional map in the
geographic tile from the repository's existing world-atlas dependency.

## Theme, layout and access

Preserve the mockups' composition at desktop widths. Use ivory/charcoal
surfaces, off-white dark-mode text, cobalt/coral/gold/mint/lavender charts and
fine dividers. Reflow to one column on phones without horizontal scrolling.

Theme defaults to the browser colour preference, respects a saved choice and
can be toggled via an accessible native button. Apply the preference before
first paint, persist when storage is available, and continue working when
storage is blocked. SVGs have accessible names and descriptions. Chart hover
information is also available by keyboard. Respect reduced motion.

## Verification

Verify theme preference resolution and chart data-to-display contracts with
focused tests. Check generated routes and links, then inspect desktop and
mobile in both themes in a browser, including persistence and keyboard
interaction. Run root lint/format, typecheck and workspace tests plus a
production build. Add the promo build to the root build pipeline and document
the launch command and default port (4322).
