# Package-owned PNG export qualification

- **result:** implemented locally, unreleased. Delivery, architecture, boundary and
  test-quality review are **self-review**; recommendation **needs review**.
- **claim:** root package pure PNG planning/review and optional `/browser`
  rasterization/download now compose with `/foldkit` controls. The workbench
  demonstrates them in the existing left sidebar with the canvas always visible.
  This is canonical static model artwork, not arbitrary HTML screenshot fidelity.
- **evidence:** pure lifecycle/view/SSR/workbench tests; installed Node/Bun browser
  entry and strict TypeScript consumer checks; root typecheck, check and all tests;
  production Astro build and TypeDoc. Native Chromium checks and retained actual
  outputs are detailed below. No package publication or deployment occurred.
- **remaining uncertainty:** only local Chromium is qualified here. Other engines,
  physical devices, manual assistive technology, exact font shaping/embedding
  fidelity and hosted acceptance remain unobserved. Native encoding cannot always
  be physically interrupted; logical cancellation discards late results. Per-job
  limits do not guarantee peak memory or latency. Broader D/C/Q audit work remains.
- **next:** perform the approved read-only Alchemy integration review; keep adoption,
  provider execution and release decisions separate. Recommendation **needs review**.

## Reproduction and observed output

From the isolated worktree:

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/png-export-browser.mjs
```

The real-browser script serves the built workbench and built optional package
entry locally. PNG uses real browser decoding, drawing and PNG encoding. Success
is not mocked. It verifies exact equality between decoded preview data URL and
actual downloaded bytes; PNG signature/IHDR are checked by the adapter and files
are decoded independently with the existing test-only `pngjs` dependency.

Chromium **151.0.7922.34**, 1600×1100, reduced motion:

- Model PNG: **828×268, 12,798 bytes**, theme background alpha255.
- Viewport PNG: **2380×2052, 121,823 bytes**, 2× measured surface dimensions and
  transparent pixels preserved. No implicit devicePixelRatio multiplier.
- Native fixture:120×80, transparent corner and opaque content. Typed custom SVG
  badge adapter produces exact centre RGBA **255,0,0,255**.
- Explicit direct-render loss opt-in, output pixel limit, expected-source mismatch,
  encoded-byte limit, empty native encoding, timeout and abort all return distinct
  failures. Failure-only method instrumentation restores native methods afterward.
- All tracked SVG object URLs are revoked; all six allocated test canvases have
  width/height zero after success or failure. No page errors.
- UI loss acceptance gates rendering; actual rendering gates download. Setting
  changes clear consent/preview, live protection disables download, custom download
  composition preserves the package action contract. Minimal mode removes numeric
  readouts/instructions while findings, acceptance, preview and actions remain.
- Pure tests additionally cover stale revisions/generations/scope, cancellation and
  late completion, protection changes during rendering, malformed result metadata,
  detached payloads, size rounding/caps, and graph/Undo preservation.

[Structured browser receipt](png-export-browser.json) ·
[Reproducible script](png-export-browser.mjs) ·
[Actual model PNG](png-export-model.png) ·
[Actual transparent 2× viewport PNG](png-export-viewport.png).

## Visual evidence

[Light native settings/preview](png-export-light.png) ·
[Dark custom download/loss review](png-export-dark-custom.png) ·
[Minimal review](png-export-minimal.png).

All three captures were visually inspected: shared neutral/blue themes, labelled
native settings, an actual raster preview, readable findings, explicit consent,
custom download styling and a visible full-height working canvas. The sidebar
scrolls independently; these are complementary views of the same controls.

See [ADR 0063](../../../docs/adr/0063-rasterize-reviewed-model-artwork-as-png.md)
and [package API guide](../../../packages/foldkit-zloz/README.md#reviewed-png-export-unreleased).
