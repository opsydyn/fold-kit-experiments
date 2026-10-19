# Phase 0 spike results (2026-10-14)

Local toolchain: Bun 1.4.2 (pinned target 1.4.3), TypeScript 7.0.2, macOS arm64.
The spike code was removed in Phase 5; it is preserved in commit `02fa947` under each package's `spikes/` folder. D1 was re-verified against Foldkit 0.167.0, the workspace pin, after consolidation.

| Spike       | Question                                                                   | Result                                                                                                                                 | Evidence                                                  |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D1          | Which Foldkit seam gives update-in-place, typed events and scoped release? | **Hybrid works:** `CustomElement.define` for typed props + Schema-decoded events, `Mount.define` (one-shot) for lifecycle.             | `d1-adapter/d1.test.ts` passes in Chromium                |
| D2          | Can the reconciler hot path follow the import-gated lint rules?            | **No, at acceptable cost.** Effect-style (`Option`/`HashMap`/`Array`) diff is 11–21× slower; kernel style lints clean under all rules. | `d2-lint-layering/bench.ts`                               |
| D6          | Can Bun drive deterministic browser visual tests?                          | **Yes.** Playwright library under `bun test`, headless shell + SwiftShader: two renders pixel-identical (0 diff).                      | `d6-playwright/d6.test.ts`                                |
| Lint        | Do oxlint jsPlugins and type-aware rules need Node?                        | **No.** `bunx --bun oxlint` runs `linteffect/*` and `typescript/no-unnecessary-type-assertion`.                                        | `bun run lint`                                            |
| TS 7        | Do Foldkit, three, Effect and Playwright types work under TS 7.0.2?        | **Yes.** 1,012 files checked in 0.17 s, no errors.                                                                                     | `bun run typecheck`                                       |
| Core purity | Can core use three with no DOM lib?                                        | **Yes.** `three` scene graph types check and run headless in Bun; a `document` reference fails compilation.                            | `packages/effect-three/tsconfig.json` (`lib: ["ES2023"]`) |
| Docs        | Does doc tooling support TS 7?                                             | **TypeDoc no** (peer `typescript` ≤ 6.0.x). **API Extractor yes** (bundles TS 5.9.3, reads emitted `.d.ts`).                           | npm registry                                              |

## D1 details

- Mount **must** be `Mount.define`, not `Mount.defineStream`. A completing stream closes the Mount scope immediately and runs the finalisers while the element is still mounted. `define` keeps the scope open until the element unmounts.
- `Prop` is not exported from `foldkit/html`'s public surface. The public route to a diffed DOM property is a `CustomElement.define` property factory, which sets the property without Schema-validating it on each render.
- Foldkit re-sets the property **with a fresh object on every render**, even when the scene is unchanged. In the spike, an unrelated model change (`nodeClicks`) produced a redundant `update:red`. The runtime must short-circuit structurally equal descriptions cheaply.
- Pointer events go through `element.dispatchEvent(new CustomEvent("scene-pointer", { detail }))`. Foldkit decodes `detail` with the declared Schema and maps it to the user's typed Message through `OnScenePointer`. The Mount's own message is just a lifecycle acknowledgement.
- `Mount.define`'s `execute` has `R = never`. Library services (renderer, frame source, resource registry) cannot come from Foldkit's `resources` Layer. They are provided inside the Mount from an adapter-built Layer (see ADR-002).
- Not yet covered (Phase 3): time-travel `viewStateChanges` → `Paused` suppressing events.

## D2 numbers (1,000 keyed nodes, mitata, Apple Silicon)

| Case       | Kernel (plain TS) | Effect style | Ratio |
| ---------- | ----------------- | ------------ | ----- |
| no-op      | 24 µs             | 515 µs       | 21×   |
| one change | 25 µs             | 533 µs       | 21×   |
| all change | 48 µs             | 541 µs       | 11×   |

The Effect-style no-op alone (0.51 ms) exceeds the accepted 0.2 ms budget.

## D6 details

- Launch args: `--use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1`. Use `preserveDrawingBuffer: true` for screenshots.
- Leak oracle works: `renderer.info.memory.geometries` dropped 1 → 0 after `dispose()`. `textures` stayed at **1** with no user textures, because three allocates an internal texture. **Baselines must be captured after the first render, not assumed to be zero.**

## Lint findings that affect later phases

- Idiomatic Foldkit code fails several rules in Effect-importing files: `{ ...model }` (`no-naked-object-state-update`), ternaries in `update`/`view` (`no-ternary`), string comparisons (`no-magic-domain-string`). The demo app must use `Struct.evolve`/`modifyFields`, `Match` and Schema literal unions.
- `no-effect-wrapper-alias` flags any `const x = Effect...` alias. Public Effect values should be functions that return Effects.

## Labels under WebGPU (2026-10-19)

**Question:** can effect-three draw troika labels under `WebGPURenderer`, where troika's
own material (GLSL patched in with `onBeforeCompile`) cannot run?

**Result: yes, by keeping troika's text pipeline and replacing only its shader.**
troika's `getTextRenderInfo` lays text out (fonts, wrapping, bidi, colour ranges) and builds
the glyphs' signed distance fields into an atlas on its own canvas, independent of the
renderer. A TSL node material ports troika's fragment logic: one instanced quad per glyph
over its bounds, the atlas cell from the glyph index (four glyphs per texel, one per
channel), exponential decoding to a signed distance, and anti-aliasing from `fwidth`.
In headless Chromium on SwiftShader's WebGPU adapter, `WebGPURenderer` reported its
WebGPU backend and drew two labels (50 glyphs) cleanly, colour ranges included.

Two findings to carry into an engine:

- **Round the glyph index.** Interpolated across the quad, an index of 5 can arrive as
  4.9999, and `mod(index, 4)` then picks the wrong channel: whole glyphs come out as
  neighbouring ones. troika's GLSL rounds (`floor(ch + 0.5)`) for this reason.
- **Copy the atlas as bytes.** Uploaded as an image, troika's WebGL canvas goes through
  premultiplied alpha, which marks the R, G and B glyphs where the A glyph is thin;
  `readPixels` into a `DataTexture` (troika's own Safari workaround) is exact. The atlas
  grows as labels add glyphs, so an engine must re-read it when troika reports new ones.

Not yet covered: outlines, blur and curves (troika's vertex and outline passes), clip
rectangles, a lit material, and depth with other transparent objects. Evidence:
`packages/effect-three-troika/spikes/tsl-labels/` (`bun spikes/tsl-labels/run.ts`).

**Outcome (2026-10-19): built.** `troikaLabels` from `@opsydyn/effect-three-troika/webgpu`
draws labels this way behind `LabelEngine.createTsl`, with outlines and blur (a first
pass, as troika draws them), curves, colour ranges, lit materials and picking. Two more
findings from building it:

- **troika's glyph indices are integers.** Documented as a `Float32Array`, they are the
  typesetter's glyph id array; given to WebGPU's WebGL 2 backend as is, it declares an
  `int` input and the draw fails ("Vertex shader input type does not match"). Copy them
  to floats.
- **A superseded layout must still draw again.** troika answers a layout whose glyphs an
  earlier, unfinished layout is still building at once, before their fields have landed
  in the atlas. Showing only the latest layout is right, but the earlier one's answer
  must still ask for a frame, or a scene that draws on demand keeps an empty atlas copy.

Against the WebGL path on the samples, glyphs, colour ranges, outlines and layout match;
the clearcoat highlight on the gallery's curved, lit title is narrower under WebGPU.
