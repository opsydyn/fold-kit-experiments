# effect-three roadmap: capability parity with React Three Fiber

**Goal:** anything you can build with React Three Fiber (R3F) you can build with
effect-three. The target is matching what you can build, not matching R3F's API. The
Model owns state, scenes are typed data, and per-frame work is pure behaviours. So where
R3F mutates objects in `useFrame` or suspends on a loader, we offer the Model-driven
equivalent.

References are pinned in [references.md](references.md). R3F paths below are under
`react-three-fiber-main/packages/fiber/src` at `d74622e` (fiber 9.8.1). Every phase
traces the reference before designing (the R3F reference rule in `CLAUDE.md`).

**Status key:** ✅ done · 🟡 partial · ❌ missing · ⏸ designed for, not built.
**Sizes:** S ≈ ≤1 day · M ≈ 2–4 days · L ≈ a week or more.

## Where we are (2026-10-15)

Phases 0–5 of the [plan](PLAN.md) are complete, plus eased transitions and four
geometries (`feat/effect-three-transitions`). The hosted catalogue is groups, meshes,
ambient and directional lights, and one perspective camera.

## R1. Expressiveness: say more in a scene

| Capability                    | R3F reference                                                 | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                          | Size |
| ----------------------------- | ------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Geometry                      | any three geometry via the catalogue (`core/extend.ts`)       | ✅     | Box, sphere, plane, cylinder, torus, cone, capsule, ring and circle, every default checked against three.js constructors in a test. Extrude and lathe from point data remain.                                                                                                                                                                                                                        | S    |
| Materials                     | any three material                                            | ✅     | `basic`, `lambert`, `phong`, `standard`, `physical` and `normalMaterial`, with opacity, transparency, side, wireframe, flat shading and emission; defaults checked against three.js. Same-kind changes apply in place (recompiling when transparency, side or flat shading change); a kind change replaces the material, and shared replacements swap onto every user. Textures are R3.              | M    |
| Lights                        | any three light                                               | ✅     | Ambient, directional, point, spot (world-space target, matrix kept current) and hemisphere, with three.js defaults checked in a test.                                                                                                                                                                                                                                                                | S    |
| Shadows                       | `shadows` in `core/configuration.ts`                          | ✅     | `render.shadows` (`basic`, `percentage`, `soft`, `variance`, as R3F names them), `castShadow`/`receiveShadow` on meshes, and `castShadow`, `shadowMapSize`, `shadowBias` (plus `shadowArea` for directional) on lights. three 0.186 folded PCF soft into PCF, so `soft` maps to PCF; per-light `shadow.radius` softness is not exposed yet.                                                          | M    |
| Orthographic camera           | `orthographic` in `core/configuration.ts`                     | ✅     | `orthographicCamera({ zoom })`: as in R3F, the frustum spans the viewport in CSS pixels and `zoom` is pixels per world unit. Switching camera kind replaces the camera object; picking works through either.                                                                                                                                                                                         | S    |
| Renderer options              | `gl`, `dpr`, `flat`, `linear` in `core/configuration.ts`      | 🟡     | `render` settings in the description: tone mapping (default `none`, not R3F's ACES, so validated colours render as given), exposure and output colour space, applied by the frame loop only when they change. Pixel ratio follows the device. A `[min, max]` pixel-ratio clamp, clear colour and creation-time WebGL options (already passable to `webglRendererFactory`) remain to document or add. | S    |
| Full pointer events           | `EventHandlers` in `core/events.ts`                           | ✅     | Enter, move, leave, down, up, click, double-click, context menu, wheel and missed, with key, button, point, distance, face normal and uv. Click, double-click and context menu follow the press target as in R3F; misses use its 2 px tolerance. Pointer cancel ends hover like leave.                                                                                                               | M    |
| Event propagation and capture | `stopPropagation`, `PointerCaptureTarget` in `core/events.ts` | ❌     | Bubble through ancestor groups by key, a declarative stop, and pointer capture for drags. Needed before drag controls.                                                                                                                                                                                                                                                                               | M    |

**Showcase (done):** a 3D bar chart sample: foldkit-viz scales, eased bars, a theme
subscription, hover readout, pinning with misses to clear, double-click to isolate a
series, and a data table.

**Exit:** every R1 row ✅, with tests mirroring the kernel's existing property tests and a
sample using lights, shadows and the new events.

## R2. Frames and performance

| Capability                  | R3F reference                                          | Status | Design note                                                                                                               | Size |
| --------------------------- | ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- | ---- |
| `demand` and `never` frames | `frameloop`, `invalidate`, `advance` in `core/loop.ts` | ⏸      | Render only when a reconcile, a resize or an active behaviour or transition needs a frame. `never` for tests and capture. | M    |
| Instancing                  | `InstancedMesh` via the catalogue                      | ❌     | A keyed instance list on one mesh, diffed into per-instance matrix and colour updates. Picking reports the instance key.  | L    |
| Adaptive performance        | `performance`/`regress` in `core/configuration.ts`     | ❌     | Drop pixel ratio while frames are slow; recover when idle.                                                                | S    |

**Exit:** a static scene renders zero frames between updates; 10,000 instanced meshes
under the existing frame budget.

## R3. Real content

| Capability       | R3F reference                                                 | Status | Design note                                                                                                                                        | Size |
| ---------------- | ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Borrowed objects | `primitive` and `dispose={null}` in `core/reconciler.tsx`     | ⏸      | The application lends a three.js object by id; the library hosts it and never disposes it. The escape hatch for anything not yet in the catalogue. | M    |
| Textures         | `useLoader` in `core/hooks.tsx`                               | ❌     | Textures as shared resources loaded by a Command; the Model tracks loading as `AsyncData`. Disposal follows the existing reference counts.         | M    |
| GLTF models      | `useLoader` + `GLTFLoader` (`three/examples/jsm`)             | ❌     | A loaded model becomes a borrowed subtree with addressable named nodes; its resources are released when the last scene stops using it.             | L    |
| Animation clips  | Drei `useAnimations` (`drei-main/src/core/useAnimations.tsx`) | ❌     | Clip playback as a behaviour of scene time, so it stays deterministic and pausable.                                                                | M    |

**Exit:** a sample loads a textured GLTF model, plays a clip, and leaves no GPU resources
behind after unmount (checked by the existing leak oracle).

## R4. Composition

| Capability                 | R3F reference                             | Status | Design note                                                                                                                                                           | Size |
| -------------------------- | ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| User-defined behaviours    | `useFrame` priorities in `core/hooks.tsx` | 🟡     | Spin and transitions today. Add typed, pure behaviours (`(time, params) => pose`) registered once, so anything `useFrame` animates can be expressed without mutation. | M    |
| Multiple views and portals | `createPortal` in `core/portal.tsx`       | ❌     | Several cameras or viewports over one scene, and scissored views on one canvas.                                                                                       | M    |
| Render targets             | Drei `RenderTexture`, `Fbo`               | ❌     | A scene rendered into a texture that another scene uses as a shared resource.                                                                                         | M    |
| Post-processing            | `@react-three/postprocessing`             | ❌     | An ordered list of passes in the description, owned by the renderer's scope.                                                                                          | L    |

## R5. Helpers, XR and physics (last, by decision)

Drei-style helpers, XR and physics come after R1–R4.

| Area          | Reference                                                                                 | Design note                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Controls      | Drei `OrbitControls`, `CameraControls`, `web/DragControls`; three `examples/jsm/controls` | The camera stays in the Model: controls become pointer and wheel Messages, with an `update` helper that applies the maths. Needs R1 propagation and capture. |
| Text and HTML | Drei `Text`, `Text3D`, `web/Html`                                                         | SDF text as a geometry kind; HTML overlays positioned from projected points.                                                                                 |
| Staging       | Drei `Environment`, `ContactShadows`, `Stage`, `Sky`, `Grid`                              | Built from R1–R4 pieces rather than new kernel kinds where possible.                                                                                         |
| XR            | `advance(timestamp, …, frame: XRFrame)` in `core/loop.ts`; `@react-three/xr`              | Needs R2's frame modes so the XR session drives frames.                                                                                                      |
| Physics       | `@react-three/rapier`                                                                     | Physics as a behaviour source that owns poses for chosen nodes, mirroring how `spin` owns rotation.                                                          |

## Not planned

- An open catalogue with arbitrary props (`extend`, `attach`, `position-x`). Borrowed
  objects (R3) cover the escape hatch while the catalogue stays closed and typed.
- Imperative refs and per-frame mutation from application code. User-defined behaviours
  (R4) replace them.
- React-specific machinery: Suspense, context bridging, the test renderer.
