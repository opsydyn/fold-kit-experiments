# SVG review and download qualification

- **result:** complete
- **claim:** package-owned SVG review and composable download controls are integrated
  into the workbench's left sidebar. Losses require explicit approval of the current
  artifact; current protection reasons still prevent download. Export leaves editor
  data, camera and Undo unchanged.
- **evidence:** controller/view tests cover stale source/settings/adapter output,
  exact loss consent, live protection, viewport/custom bounds, missing choices and
  old job completion. Workbench tests cover guarded Command publication and completion
  during receipt comparison. Packed Node/Bun consumers exercise the public controller.
  Root `bun run check`, `bun typecheck` and `bun run test` exit 0. Zloz core
  has 468 passing tests and the workbench has 106; the complete workspace suite
  has no failures. `bun run --filter @opsydyn/foldkit-zloz docs` exits 0,
  generating the public API pages. The production build exits 0 and is
  exercised by [the repeatable browser check](svg-review-browser.mjs).
  Chromium 151.0.7922.34 at 1600×1100 with reduced motion observed zero page errors.
  Actual downloads match the exact preview XML bytes, for both a transparent viewport
  crop and a loss-accepted DDD model. XML parsing, measured viewport width, absence
  of the background rectangle, plain SVG filename and script absence are checked.
  Native/custom controls, settings invalidation, edit then Undo invalidation, protection
  with retained content consent, light/dark/minimal views and visible canvas pass.
- **remaining uncertainty:** browser IO success means handoff, not OS save confirmation.
  Manual keyboard/AT, other browsers, physical devices, large-model cost, font
  substitution, ink bounds and embedded resource bytes remain unqualified. Host
  palettes are literal portable paints, not captured DOM/CSS. Trusted adapters must
  remain pure. No hosted qualification, deployment, publication, PNG API or Alchemy
  integration is claimed. Architecture/boundary, delivery and test reviews are
  self-review, with noted typography/performance risks.
- **next:** needs review — define validated embedded-font resources and failure
  reporting to improve standalone typography fidelity. PNG and Alchemy stay deferred.

| Scenario                                                      | Evidence                               |
| ------------------------------------------------------------- | -------------------------------------- |
| Native settings, preview and visible canvas                   | [Capture](svg-review-native.png)       |
| Live download protection after loss acceptance                | [Capture](svg-review-protected.png)    |
| Custom finding cards and download, light                      | [Capture](svg-review-custom-light.png) |
| Custom controls, dark                                         | [Capture](svg-review-custom-dark.png)  |
| Minimal diagnostics retains findings, acceptance and download | [Capture](svg-review-minimal.png)      |
| Actual loss-accepted DDD download                             | [SVG](svg-review-downloaded.svg)       |
| Actual transparent viewport download                          | [SVG](svg-review-viewport.svg)         |

PNG files above are browser evidence, not a product PNG export feature.
