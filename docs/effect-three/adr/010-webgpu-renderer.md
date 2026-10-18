# ADR-010: A WebGPU renderer beside the WebGL one

- Status: Accepted (2026-10-18).
- Evidence: `packages/effect-three/src/webgpu` (the TSL render kit),
  `packages/effect-three/src/kernel/contactShadowPasses.ts`,
  `packages/effect-three-foldkit/src/dom/webgpu.ts` and `webgpuPostprocessing.ts`;
  `e2e/staging.test.ts` and `e2e/everything.test.ts` (each case on WebGL, on
  `WebGPURenderer`'s WebGL 2 backend, and on real WebGPU through SwiftShader).
- References: three.js 0.186.1 `WebGPURenderer` (`three/webgpu`), `objects/SkyMesh.js`,
  `tsl/display/BloomNode.js` and `FilmNode.js`, `RenderPipeline`; `PLAN.md` item 7.

## Context

`PLAN.md` designed the renderer boundary for WebGPU: an async start, no GLSL in
descriptions, one three entry point per backend. The kernel still held GLSL (the sky,
the shader grid, contact shadows) until it moved into a WebGL render kit (ADR-003).

## Decision

- **A renderer brings a render kit.** `RenderKit` (kernel types) makes the shaded parts:
  `webglKit` (`@opsydyn/effect-three/webgl`, GLSL) and `webgpuKit`
  (`@opsydyn/effect-three/webgpu`, TSL: three's `SkyMesh`, the grid and contact shadow
  materials as node materials). A `RendererFactory` carries its kit; the runtime hands
  it to the scene graphs it makes.
- **Contact shadows are shared passes with kit materials.** The kernel runs the passes
  (camera, targets, blurs, plane); a kit supplies the depth-to-shadow material, the blur
  passes and whether its targets read flipped (WebGPU's do, on either backend).
- **`webgpuRendererFactory`** (Foldkit adapter) wraps three's `WebGPURenderer`: WebGPU
  where available, otherwise its WebGL 2 backend (`forceWebGL` forces it), opaque by
  default as `WebGLRenderer` is. It starts asynchronously: `SceneRenderer.ready()`,
  which the runtime awaits before the first frame (a failed start is
  `RendererUnavailable`). Post-processing is a `RenderPipeline` of TSL nodes (bloom,
  vignette, film grain written after `FilmNode`), with the pipeline's output transform
  for tone mapping and colour space.
- **XR goes through either renderer.** Presenting uses a structural `PresentableRenderer`
  and a per-renderer loop setter, set before the session starts (WebGPU's XR manager
  captures the renderer's loop then).
- **Labels need WebGL.** troika's labels are WebGL materials; real WebGPU rejects their
  draw calls and blanks the frame. A kit says `drawsLabels`; under `webgpuKit` the scene
  graph gives the label engine nothing to draw.

## Consequences

- The same scenes draw on both renderers, checked by pixel for contact shadows and the
  grid on three backends. Some output differs by design: `WebGPURenderer` blends in
  linear colour before its output transform (lighter translucent lines, softer
  shadows), and its TSL bloom is gentler on HDR skies than `UnrealBloomPass`.
- WebXR with `WebGPURenderer` is wired but untested: IWER's emulated layer has no
  framebuffer object, which three's WebGL 2 fallback backend cannot render into.
- The samples take `?renderer=webgpu` in the page address.
