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

## Where we are (2026-10-18)

R1 to R5 are done: everything in the tables below is ✅. A scene can hold meshes (nine shapes and text), instances,
groups, borrowed glTF models with their clips, labels, five kinds of light, grids, and
perspective or orthographic cameras in one or more views; render textures,
post-processing, environment lighting, sky and contact shadows; rigid bodies and joints;
and an XR presentation. Pointer, gesture, collision, contact force, measurement and XR
input all come back as typed Messages.

The packages are `@opsydyn/effect-three` (kernel and runtime), `-foldkit` (the
adapter), `-rapier` (physics engine) and `-troika` (label engine), all private and
pre-release. Samples live in `@opsydyn/effect-three-samples`, shown by `apps/web` and
the promo site.

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

| Capability                 | R3F reference                             | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| -------------------------- | ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| User-defined behaviours    | `useFrame` priorities in `core/hooks.tsx` | ✅     | `behave(name, params)` on groups, meshes, instances and borrowed nodes; behaviours are registered pure functions of scene time writing a pose offset (position, rotation, scale) composed on the node's own or eased transform, allocation-free (1,000 floating meshes ~125 µs per frame). Built-in `float` is Drei's `Float`. Unknown names are rejected; eased moves start from the pose on screen.                                                                       | M    |
| Multiple views and portals | `createPortal` in `core/portal.tsx`       | ✅     | `views: [view({ key, camera, rect })]`: Drei's `View` as data. Each view draws scissored into its fractional rect with its own fitted camera; picks and drag rays go through the view under the pointer and hits report `view`. Post-processing applies to the single full view only. The studio's split lens shows it.                                                                                                                                                     | M    |
| Render targets             | Drei `RenderTexture`, `Fbo`               | ✅     | `renderTextures: [renderTexture({ id, width, height, camera, background, children })]`: Drei's `RenderTexture` as data. Each is a nested scene graph on the same store, drawn into its own target (Drei's `useFBO` settings: half-float, linear, 8 samples) only when its scene changes, and lent as a texture so `map: id` uses it. Invalid texture scenes reject the whole update; removing one withdraws the map and disposes the target. The studio's monitor shows it. | M    |
| Post-processing            | `@react-three/postprocessing`             | ✅     | `render.effects: [bloom(), vignette(), film()]`, rendered with three.js's own `EffectComposer` passes rather than the pmndrs `postprocessing` library R3F uses (no new dependency). The composer exists only while effects do, keeps MSAA through a multisampled target, ends in `OutputPass` for tone mapping, and frees its targets when effects go (checked in a real browser).                                                                                          | L    |

**Exit (met):** behaviours, views, post-processing and render textures compose in the
studio sample (a split lens and a render-textured monitor); the adapter's browser tests
prove effects and render targets draw and free their GPU textures when they go.

## R5. Helpers, XR and physics (last, by decision)

Drei-style helpers, XR and physics come after R1–R4.

| Area          | Reference                                                                                 | Status | Design note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Controls      | Drei `OrbitControls`, `CameraControls`, `web/DragControls`; three `examples/jsm/controls` | ✅     | Orbit as data ([ADR-006](adr/006-controls-as-data.md)): `scene({ gestures: 'scene' })` claims the canvas's drags, wheel and pinches and reports them as `Gesture` Messages (with where they happened); `orbit(camera, gesture, options)` returns the next camera, matching three.js `OrbitControls` (0.186.1) step for step, including `zoomToCursor`, and `orbitKey` its arrow keys. Camera `damping` eases every change, as Drei's controls do. Drei's `Bounds` is `scene({ measure })` (bounding boxes as `Measured` events) with `fitCamera` and `clipCamera`. Dragging objects is R1's capture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Text and HTML | Drei `Text`, `Text3D`, `web/Html`                                                         | ✅     | HTML: `overlays: [overlay({ key, node, position, center, distanceFactor, occlude, zIndexRange, view })]` is Drei's `Html` (without `transform`) as data: the kernel places each point after every drawn frame (projection, behind-camera and raycast occlusion hiding, distance scale, depth z-index, as `Html.tsx`), and the Foldkit view renders Model HTML that the adapter moves there. Text: `text({ text, font, size, depth, curveSegments, bevel, center })` is Drei's `Text3D` (three's `TextGeometry`, flat `ShapeGeometry` at depth 0) with Drei's defaults, drawn from a typeface font lent like a texture (`assets.loadFont`); text rebuilds when its font arrives. Text also takes `letterSpacing` (ems), `lineHeight` and `align`, laid out per glyph from three's `createPaths` (Drei passes these to three's `TextGeometry`, which ignores them). Labels ([ADR-009](adr/009-labels-drawn-by-an-engine.md)): `label({ text, font, fontSize, anchorX, anchorY, maxWidth, lineHeight, letterSpacing, textAlign, outline… })` is Drei's `Text` as data, drawn by a `LabelEngine`; `@opsydyn/effect-three-troika` implements it with troika, redrawing when glyphs are ready.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Staging       | Drei `Environment`, `ContactShadows`, `Stage`, `Sky`, `Grid`                              | ✅     | `environment({ map, background, backgroundBlurriness, backgroundIntensity, environmentIntensity })` is Drei's `Environment` (`setEnvProps`): three's `RoomEnvironment` prefiltered by the renderer when there is no map, or a lent equirectangular panorama (`assets.loadEnvironment` for `.hdr`). `sky()` is Drei's `Sky` with its defaults (three's Preetham `Sky`, drawn at the far plane, never picked). `grid()` is three's `GridHelper` as a node. `shadowMaterial()` catches shadows on an undrawn floor. `contactShadows({ position, size, near, far, blur, smooth, opacity, color, resolution })` is Drei's `ContactShadows` with its defaults, drawn by the frame loop through the renderer (depth from below, blurred, on a plane), checked by pixel in a real browser. `stage({ radius, height, preset, intensity, shadows, environment })` returns Drei's `Stage` lighting as scene parts (its four presets, contact shadows at the base, the room environment for Drei's CDN "city"). `shaderGrid({ cellSize, sectionSize, infinite, followCamera, fadeDistance, … })` is Drei's `Grid` (the fading shader plane, its camera uniforms set in `onBeforeRender` so every view and eye gets its own), checked by pixel in a real browser. `Stage`'s measuring, centring and fitting are a Model loop: `scene({ measure })` reports the box, `centerOffset(box, { top })` is Drei's `Center`, `stageBounds(box)` gives `stage` its radius and height, and `fitCamera` is `Bounds`. `environmentPresetUrl('city')` names Drei's ten preset HDRs at its pinned asset commit, for `assets.loadEnvironment`. |
| XR            | `advance(timestamp, …, frame: XRFrame)` in `core/loop.ts`; `@react-three/xr`              | ✅     | Sessions as Commands ([ADR-008](adr/008-immersive-sessions.md)): `scene({ xr: xr({ origin, heading, referenceSpace }) })` opts in; the Foldkit environment's `xr.enter(mode)` presents it with the session driving frames (React Three Fiber's `setAnimationLoop` hand-off) and the player at the origin through an offset reference space; controller selects are pointer events along their rays. Tested with a real session under Meta's IWER. Hover and drag along every source's ray (pinches included), sticks and buttons as `XrStick`/`XrButton` with `locomote` (snap turn, step) and `teleport`, AR passthrough with `xr({ hitTest: true })` reporting `XrSurface` on select, and rays and hand joints drawn; tested under IWER with a synthetic floor. Still to come: anchors, planes, DOM overlay, joint poses as data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Physics       | `@react-three/rapier`                                                                     | ✅     | Bodies as data ([ADR-007](adr/007-physics-as-a-pose-source.md)): `mesh({ body: body({ type, collider, mass, … impulse }) })` under `scene({ physics: physics() })`, react-three-rapier's defaults. The kernel steps an engine-neutral world on scene time (fixed steps, interpolation, auto colliders) and reports `Collision` events; `@opsydyn/effect-three-rapier` implements it with Rapier. Bodies on groups and borrowed models (a collider per mesh inside), a body per instance (`InstancedRigidBodies`, collisions naming the instance), and joints as data (`physics({ joints })`: fixed, spherical, revolute with limits, prismatic, rope, spring; `contacts` off for chains). Colliders of a body's own (cuboid, ball, capsule, cylinder, cone), joint motors (`velocityMotor`, `positionMotor`), `ContactForce` events over a body's threshold, and `physics({ debug: true })` drawing Rapier's lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## After R5: candidates (2026-10-18)

The parity roadmap is complete. Three directions are open; they are not exclusive, and
the first two differ a lot in size.

### A. Publish the packages (S–M)

Everything above is usable only inside this monorepo: `@opsydyn/effect-three`,
`-foldkit`, `-rapier` and `-troika` are private at `0.0.0`. The repository already
releases `astro-foldkit` and `foldkit-viz` with release-please and
`npm publish --provenance`, so the path exists:

- set a first version (`0.1.0`), drop `private`, add `publishConfig.access: public`;
- give published manifests literal versions, as `tools/check-catalog.ts` requires
  (`npm publish` cannot resolve `catalog:`);
- add `pack:check` (publint, attw) for Rapier and troika, as the core and adapter have;
- add the four packages to release-please and the publish workflows;
- state what 0.x promises: the API reports in `etc/` are the surface, and breaking
  changes bump the minor version.

Publishing is outward-facing and hard to take back (npm allows unpublishing for 72
hours), so it needs an explicit go-ahead and the `NPM_TOKEN` secret.

### B. A WebGPU renderer (L) ✅

Done ([ADR-010](adr/010-webgpu-renderer.md)): `webgpuRendererFactory` and `webgpuKit`, on real WebGPU or `WebGPURenderer`'s WebGL 2 backend; labels are not drawn under it. The notes below are as planned.

`PLAN.md` designed the renderer boundary for WebGPU but nothing uses it yet. three 0.186
ships `WebGPURenderer` (`three/webgpu`, sharing `three.core.js` with `three`, so no
duplicate core) with its own XR manager. What stands in the way:

- **GLSL in the kernel.** The sky (`three/addons/objects/Sky.js`), the shader grid and
  contact shadows (`ShaderMaterial`, `onBeforeCompile`) are written for WebGL, though
  ADR-003 keeps the kernel renderer-neutral. They would move behind the renderer: the
  renderer supplies them, as it already supplies `createEnvironment`. three has TSL
  equivalents for some (`objects/SkyMesh.js`, `tsl/display/GaussianBlurNode.js`).
- **Post-processing.** `EffectComposer` and its passes are WebGL-only; WebGPU uses
  `PostProcessing` with TSL nodes (`BloomNode`, `FilmNode`; a vignette would be written).
- **Labels.** troika derives WebGL shaders with `onBeforeCompile`; there is no WebGPU
  path, so labels would be unavailable under WebGPU at first.
- **Async start.** `WebGPURenderer.init()` is async; the renderer factory would return
  an Effect, as `PLAN.md` foresaw.

Worth doing for compute and TSL materials, not for reach: WebGL2 runs everywhere effect-three
targets today.

### C. Smaller follow-ups (S each)

- ✅ Move the kernel's GLSL behind the renderer (B's first step, and ADR-003's rule): the
  sky, shader grid and contact shadows are `webglKit` in `@opsydyn/effect-three/webgl`.
- ✅ Smooth locomotion without a Message per frame: `xr({ glide })` glides the player with
  the sticks in the session and reports `XrMoved` when they let go.
- XR anchors, planes and DOM overlay; joint poses as data.
- ✅ Collision groups and per-collider events in physics: `body({ collisionGroups,
solverGroups })` with `interactionGroups`, and collisions naming each body's part.

### Recommendation

A first: it makes R1–R5 usable outside the monorepo, and it is the smallest. Then C's
first item, which tidies the layering and starts B without committing to it.

## Not planned

- An open catalogue with arbitrary props (`extend`, `attach`, `position-x`). Borrowed
  objects (R3) cover the escape hatch while the catalogue stays closed and typed.
- Imperative refs and per-frame mutation from application code. User-defined behaviours
  (R4) replace them.
- React-specific machinery: Suspense, context bridging, the test renderer.
