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

| Capability                    | R3F reference                                                 | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Size |
| ----------------------------- | ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Geometry                      | any three geometry via the catalogue (`core/extend.ts`)       | ✅     | Box, sphere, plane, cylinder, torus, cone, capsule, ring and circle, every default checked against three.js constructors in a test. Extrude and lathe from point data remain.                                                                                                                                                                                                                                                                                     | S    |
| Materials                     | any three material                                            | ✅     | `basic`, `lambert`, `phong`, `standard`, `physical` and `normalMaterial`, with opacity, transparency, side, wireframe, flat shading and emission; defaults checked against three.js. Same-kind changes apply in place (recompiling when transparency, side or flat shading change); a kind change replaces the material, and shared replacements swap onto every user. Textures are R3.                                                                           | M    |
| Lights                        | any three light                                               | ✅     | Ambient, directional, point, spot (world-space target, matrix kept current) and hemisphere, with three.js defaults checked in a test.                                                                                                                                                                                                                                                                                                                             | S    |
| Shadows                       | `shadows` in `core/configuration.ts`                          | ✅     | `render.shadows` (`basic`, `percentage`, `soft`, `variance`, as R3F names them), `castShadow`/`receiveShadow` on meshes, and `castShadow`, `shadowMapSize`, `shadowBias` (plus `shadowArea` for directional) on lights. three 0.186 folded PCF soft into PCF, so `soft` maps to PCF; per-light `shadow.radius` softness is not exposed yet.                                                                                                                       | M    |
| Orthographic camera           | `orthographic` in `core/configuration.ts`                     | ✅     | `orthographicCamera({ zoom })`: as in R3F, the frustum spans the viewport in CSS pixels and `zoom` is pixels per world unit. Switching camera kind replaces the camera object; picking works through either.                                                                                                                                                                                                                                                      | S    |
| Renderer options              | `gl`, `dpr`, `flat`, `linear` in `core/configuration.ts`      | ✅     | `render` settings in the description: tone mapping (default `none`, not R3F's ACES, so validated colours render as given), exposure and output colour space, applied only when they change. `makeEnvironment(window, { pixelRatio })` takes R3F's `dpr` (a number or `[min, max]`, default `[1, 2]`) and follows ratio changes from display moves and zoom. Creation-time WebGL options (antialias, alpha, power preference) pass through `webglRendererFactory`. | S    |
| Full pointer events           | `EventHandlers` in `core/events.ts`                           | ✅     | Enter, move, leave, down, up, click, double-click, context menu, wheel and missed, with key, button, point, distance, face normal and uv. Click, double-click and context menu follow the press target as in R3F; misses use its 2 px tolerance. Pointer cancel ends hover like leave.                                                                                                                                                                            | M    |
| Event propagation and capture | `stopPropagation`, `PointerCaptureTarget` in `core/events.ts` | ✅     | Declarative equivalents of R3F's callbacks. Bubbling: every hit carries its ancestor `path`, and `interactive` groups make all their meshes pickable, so one handler serves a group (one Message per event replaces `stopPropagation`). Capture: a press on a mesh captures the pointer (DOM `setPointerCapture` included); moves emit `Drag` with a world-space ray, anywhere, and the release emits `DragEnd`. `pointOnPlane` turns a ray into a drag point.    | M    |

**Showcase (done):** a 3D bar chart sample: foldkit-viz scales, eased bars, a theme
subscription, hover readout, pinning with misses to clear, double-click to isolate a
series, and a data table.

**Exit (met):** every R1 row ✅, with the kernel's property tests generating every new
geometry, material, light, camera and render setting, and the studio sample using lights,
shadows, materials, the orthographic camera and drag capture.

## R2. Frames and performance

| Capability                  | R3F reference                                          | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| --------------------------- | ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `demand` and `never` frames | `frameloop`, `invalidate`, `advance` in `core/loop.ts` | ✅     | `render.frames`: `always`, `demand` (the default, unlike R3F's `always`) or `never`, plus `handle.advance` for manual frames. No `invalidate` is ever needed: the graph knows when it needs a frame (any reconcile with operations, resize, animation toggle, a shared resource changed by another scene, or a running spin or tween) and the scene unsubscribes from frames when idle. Off-screen scenes unsubscribe too, so an idle page requests no animation frames at all (checked in a real browser). | M    |
| Instancing                  | `InstancedMesh` via the catalogue                      | ✅     | `instances({ key, geometry, material, instances: [instance({ key, position, rotation, scale, color })] })`, declarative like Drei's `Instances` but diffed: an update rewrites only the slots that changed (one moved instance among 10,000 reconciles in ~0.27 ms), capacity doubles as lists grow, picking reports the instance key, and removal frees the instance buffers.                                                                                                                              | L    |
| Adaptive performance        | `performance`/`regress` in `core/configuration.ts`     | ✅     | Drei's `PerformanceMonitor` algorithm in the kernel frame loop, reported as a `PerformanceChanged { fps, factor }` event (`onPerformanceChange`), and `render.resolution` to scale the pixel ratio, as `AdaptiveDpr` does. The app decides the policy in its Model. The factor starts at 1, and idle gaps of on-demand scenes reset measurement rather than counting as slow.                                                                                                                               | S    |

**Exit (met):** a static scene requests zero animation frames between updates (proved in
the adapter's browser test), and the city sample draws 10,000 instances in one call, with
one changed instance reconciling in ~0.27 ms (budget 2 ms).

## R3. Real content

| Capability       | R3F reference                                                 | Status | Design note                                                                                                                                                                                                                                                                                                           | Size |
| ---------------- | ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Borrowed objects | `primitive` and `dispose={null}` in `core/reconciler.tsx`     | ✅     | `store.lend(id, object)` and a `borrowed({ key, id })` node: R3F's `<primitive>` by reference, so descriptions stay data. The transform goes on a wrapper, the object is never disposed, a node may name an id before it is lent (it appears when lent), a second user gets a clone, and hits inside name the `part`. | M    |
| Textures         | `useLoader` in `core/hooks.tsx`                               | ✅     | `store.lendTexture(id, texture)` and `map: id` on basic, Lambert, Phong, standard and physical materials, updating owned and shared materials when a loan changes. The Foldkit adapter's `environment.assets.loadTexture(id, url)` loads one as an Effect for a Command (sRGB), owning and disposing it.              | M    |
| GLTF models      | `useLoader` + `GLTFLoader` (`three/examples/jsm`)             | ✅     | `environment.assets.loadModel(id, url)` loads with three's `GLTFLoader` and lends the scene (with its clips) for a `borrowed` node; it reports part and clip names, and `unload` frees the model's GPU resources (checked against `renderer.info.memory` in a real browser).                                          | L    |
| Animation clips  | Drei `useAnimations` (`drei-main/src/core/useAnimations.tsx`) | ✅     | `borrowed({ animation: play(clip, { speed, loop }) })`: playback is a pure function of scene time (driven with `AnimationMixer.setTime`), so it pauses, rewinds under DevTools time travel and keeps on-demand frames coming only while it changes the pose.                                                          | M    |

**Exit (met):** the workshop sample loads a textured scene (a generated glTF robot and a
tiled floor texture) through Commands, plays its clips, and unloads them; the adapter's
browser test proves unloading returns GPU geometry to its baseline.

## R4. Composition

| Capability                 | R3F reference                             | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                           | Size |
| -------------------------- | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| User-defined behaviours    | `useFrame` priorities in `core/hooks.tsx` | ✅     | `behave(name, params)` on groups, meshes, instances and borrowed nodes; behaviours are registered pure functions of scene time writing a pose offset (position, rotation, scale) composed on the node's own or eased transform, allocation-free (1,000 floating meshes ~125 µs per frame). Built-in `float` is Drei's `Float`. Unknown names are rejected; eased moves start from the pose on screen. | M    |
| Multiple views and portals | `createPortal` in `core/portal.tsx`       | ❌     | Several cameras or viewports over one scene, and scissored views on one canvas.                                                                                                                                                                                                                                                                                                                       | M    |
| Render targets             | Drei `RenderTexture`, `Fbo`               | ❌     | A scene rendered into a texture that another scene uses as a shared resource.                                                                                                                                                                                                                                                                                                                         | M    |
| Post-processing            | `@react-three/postprocessing`             | ❌     | An ordered list of passes in the description, owned by the renderer's scope.                                                                                                                                                                                                                                                                                                                          | L    |

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
