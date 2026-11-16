# Native v3 PNG qualification

- result: complete
- claim: Native v3 PNG uses the reviewed native SVG/fidelity contract and publishes only current, consented browser artifacts without editing history.
- evidence: Native/legacy tests, installed consumers and source-hashed browser pixel/download/cleanup evidence; measured results below.
- remaining uncertainty: Browser pixels only; no server renderer, hosted publication/deployment, broad performance or human device/AT acceptance.
- next: Native v3 clipboard copy/paste with explicit identity remapping, live policy and atomic Undo.

[ADR 0111](../../../docs/adr/0111-rasterize-reviewed-native-v3-svg-as-png.md)
records scope and alternatives. Architecture, boundary, delivery and test-quality
reviews are self-review. Core owns full-source planning/review; SVG adapters remain
host declarations; the optional browser entry owns raster IO/resource cleanup.
The host Model owns current scope/policy and Command publication. No legacy
snapshot codec, capability erasure or graph/Undo mutation is used.

Coverage includes exact native SVG reuse; dimension/pixel/byte limits; owned
source/options/layout/adapter records/font bytes; mode/camera/revision/settings and
current policy; cancellation/supersession/failure/retry; actual artifact metadata
and byte binding; read-only edition scopes; SSR imports and installed contracts.
Legacy PNG/SVG regressions protect the shared internal extraction. Native direct
browser probes qualify group socket pixels, transparency, crops/scale, output
identity, explicit failures and resource cleanup. Raster files do not retain
editable source semantics; artifacts are trusted renderer results, not PNG imports.

## Observed verification

Local verification on 2026-11-16, Bun 1.4.4 / Node 24.15.0:

- `bun typecheck`: all workspaces exit 0 after new fixture type refinements.
  Focused core typechecking also passed after label markup corrections.
- `bun run test`: all workspace tests exit 0, including **921 core unit tests**,
  **198 workbench tests**, installed Node/Bun peer-free core and browser SSR
  imports, strict Bundler/NodeNext consumers and native PNG review SSR. Cold
  tarballs exercise exact SVG reuse, native job capture and real PNG settlement.
  Existing conditional skips remain; no tests were disabled.
- Production demo build: exit 0, four static routes. API docs: exit 0 with
  warnings treated as errors. `bun run check` passes root lint/format/catalog/
  skills; the generated browser receipt is formatted after capture. Existing
  repository warnings, including the Viz skill-version warning, remain separate.
- Chromium **151.0.7922.34**, 1440×1000, reduced motion: **5 UI interaction groups
  passed, zero page errors**. Actual light/model, dark/custom transparent 2× and
  measured viewport PNG files decode. Preview/download buffers are byte-identical
  for all three. Cancel ignores a delayed decode; changes reset consent; current
  protection and findings remain visible in minimal mode. One Undo after all
  exports still restores the preceding complete layout and invalidates old PNG.
- Direct native probes: **4 successful renders** (transparent ported groups,
  opaque dark, explicit viewport/scale, custom vector output) and **10 explicit
  failures** (missing consent, pixel limit, changed SVG bytes, encoded byte limit,
  callback-time abort, decode failure, unavailable canvas, empty encoding,
  timeout, in-flight abort). Group socket center pixels independently match the
  light `[37, 99, 235, 255]` and dark `[152, 190, 255, 255]` palettes. A known
  320×180 viewport at scale 2 decodes to 640×360; transparent padding has alpha 0.
- Cleanup instrumentation across successes/failures: zero retained object URLs;
  all owned canvases reset to 0×0; all readers inactive with handlers released.
- **164 source SHA-256 hashes** and three preview/download file hashes match the
  final source and captured files. The source SVG for the direct native port
  probe is included; native PNG planning equals that exact validated projection.

The first UI qualification exposed nested label/option text. Dedicated label
regressions failed before the fix and passed after independent label/control
markup was applied to SVG and PNG defaults. Slot APIs remain unchanged. Browser
settings wait for the newly published review generation; stale control requests
are deliberately rejected. Captures and actual output files were visually read.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-png/browser.json) ·
[Light review](../../../apps/zloz-demo/evidence/v3-png/light-review.png) ·
[Dark custom review](../../../apps/zloz-demo/evidence/v3-png/dark-custom-review.png) ·
[Minimal protection](../../../apps/zloz-demo/evidence/v3-png/minimal-protected.png) ·
[Light PNG](../../../apps/zloz-demo/evidence/v3-png/native-light.png) ·
[Transparent 2× PNG](../../../apps/zloz-demo/evidence/v3-png/native-dark-transparent-2x.png) ·
[Viewport PNG](../../../apps/zloz-demo/evidence/v3-png/native-viewport-2x.png) ·
[Native port probe](../../../apps/zloz-demo/evidence/v3-png/native-ported-transparent.png).
The adjacent `v3-png-browser.mjs` reproduces the local IO and resource probes.

No fresh empty-cache CI rehearsal, remote CI, hosted deployment or npm publishing
was performed for this local commit. Local installed fixtures and browser
emulation are not registry, provider or human screen-reader/device acceptance.
Artifact checks bind trusted renderer bytes/metadata; they do not certify arbitrary
external PNGs. Fonts/antialiasing/custom fidelity and broad performance remain
explicit limits.

Recommendation: **needs review** before PR/merge. Next: native v3 clipboard with
full parent/port identity remapping, current policies and one Undo.
