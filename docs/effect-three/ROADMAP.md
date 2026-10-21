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
| XR            | `advance(timestamp, …, frame: XRFrame)` in `core/loop.ts`; `@react-three/xr`              | ✅     | Sessions as Commands ([ADR-008](adr/008-immersive-sessions.md)): `scene({ xr: xr({ origin, heading, referenceSpace }) })` opts in; the Foldkit environment's `xr.enter(mode)` presents it with the session driving frames (React Three Fiber's `setAnimationLoop` hand-off) and the player at the origin through an offset reference space; controller selects are pointer events along their rays. Tested with a real session under Meta's IWER. Hover and drag along every source's ray (pinches included), sticks and buttons as `XrStick`/`XrButton` with `locomote` (snap turn, step) and `teleport`, AR passthrough with `xr({ hitTest: true })` reporting `XrSurface` on select, and rays and hand joints drawn; tested under IWER with a synthetic floor. Since added: anchors (`xr({ anchors })`, `anchorSpace`), detected planes and meshes (`XrPlanes`, `XrMeshes`), the DOM overlay, gliding (`XrMoved`) and tracked spaces to follow (`jointSpace`, `headSpace`, `controllerSpace`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Physics       | `@react-three/rapier`                                                                     | ✅     | Bodies as data ([ADR-007](adr/007-physics-as-a-pose-source.md)): `mesh({ body: body({ type, collider, mass, … impulse }) })` under `scene({ physics: physics() })`, react-three-rapier's defaults. The kernel steps an engine-neutral world on scene time (fixed steps, interpolation, auto colliders) and reports `Collision` events; `@opsydyn/effect-three-rapier` implements it with Rapier. Bodies on groups and borrowed models (a collider per mesh inside), a body per instance (`InstancedRigidBodies`, collisions naming the instance), and joints as data (`physics({ joints })`: fixed, spherical, revolute with limits, prismatic, rope, spring; `contacts` off for chains). Colliders of a body's own (cuboid, ball, capsule, cylinder, cone), joint motors (`velocityMotor`, `positionMotor`), `ContactForce` events over a body's threshold, and `physics({ debug: true })` drawing Rapier's lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## After R5: candidates (2026-10-18)

The parity roadmap is complete. Three directions are open; they are not exclusive, and
the first two differ a lot in size.

### A. Publish the packages (S–M) ✅

Published as 0.1.0 on 2026-10-18, with provenance, all four together. Everything above
was usable only inside this monorepo before then: `@opsydyn/effect-three`,
`-foldkit`, `-rapier` and `-troika` were private at `0.0.0`. The repository already
releases `astro-foldkit` and `foldkit-viz` with release-please and
`npm publish --provenance`, so the path exists:

- ✅ a first version (`0.1.0`), `private` dropped, `publishConfig.access: public`, a
  `LICENSE` in each package, build leftovers kept out of the tarballs;
- ✅ literal versions in the published manifests, as `tools/check-catalog.ts` requires
  (it now accepts any catalog's version, since these build with the `strict` one);
- ✅ the core a peer of the other three, pinned to their own version (one store, one
  set of scene types), and a workspace link for local work;
- ✅ `pack:check` (publint, attw) for all four, in CI;
- ✅ release-please: the four as linked versions (`bump-minor-pre-major`, so breaking
  changes bump the minor in 0.x; `initial-version: 0.1.0`, since a package's first
  release otherwise defaults to 1.0.0), the peer pin kept in step through `extra-files`, and
  the release changelog normaliser generalised to six packages (first changelogs arrive
  as added files);
- ✅ the publish workflow: the four by manual dispatch only, Bun packing (which turns
  workspace links into versions) and npm publishing the tarball with provenance;
- ✅ each README states the 0.x promise and the limits.

**Releasing.** Merging to `main` makes release-please open (or update) its release PR,
proposing 0.1.0 for the four together. Merging that PR tags and releases them on GitHub
but publishes nothing: `release-please.yml` publishes only `astro-foldkit` and
`foldkit-viz`. Publishing is then a manual dispatch of `publish.yml` per package, from
the release tag, in order: `effect-three` first, then `effect-three-rapier`,
`effect-three-troika` and `effect-three-foldkit` (each pins the core as a peer at the
same version). It needs the `NPM_TOKEN` secret and is hard to take back (npm allows
unpublishing for 72 hours).

### B. A WebGPU renderer (L) ✅

Done ([ADR-010](adr/010-webgpu-renderer.md)): `webgpuRendererFactory` and `webgpuKit`, on real WebGPU or `WebGPURenderer`'s WebGL 2 backend; labels draw under it since E (troika's TSL labels). The notes below are as planned.

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
- ✅ XR anchors, planes and DOM overlay; joint poses as data: `group({ follow })` rides
  a tracked space (head, hand joint, controller, anchor, plane), `xr({ anchors, planes,
domOverlay })`, and `XrPlanes` events ([ADR-008](adr/008-immersive-sessions.md)).
- ✅ Collision groups and per-collider events in physics: `body({ collisionGroups,
solverGroups })` with `interactionGroups`, and collisions naming each body's part.

### D. Parity gaps before publishing (S each) ✅

The "not yet" notes the ADRs recorded, closed before the first release:

- ✅ Camera `autoRotate` (with `AutoRotated` and `autoRotated`), and damping for view
  cameras ([ADR-006](adr/006-controls-as-data.md)).
- ✅ Label `colorRanges`, `curveRadius`, a scene `material`, and `LabelMeasured`
  layouts ([ADR-009](adr/009-labels-drawn-by-an-engine.md)).
- ✅ Lent geometries (`store.lendGeometry`, `lentGeometry(id)`) and XR detected meshes
  (`xr({ meshes })`, `XrMeshes`, `xrMesh(id)`) ([ADR-008](adr/008-immersive-sessions.md)).
- ✅ The kernel coverage gate (95% of lines) runs with the core package's tests.

Still limits, to state in each README rather than fix here: WebXR on `WebGPURenderer`
is untested (IWER cannot render it), and DOM overlay is checked only in the session
request. (Labels under WebGPU were a third, until E.)

### E. After 0.1.0

- ✅ Four high-fidelity promo examples (marble machine, type gallery, bowling, XR room)
  and a guide brought up to 0.1.0.
- ✅ Pages that need labels stayed on WebGL under `?renderer=webgpu`, and said why, until
  the TSL labels below; pages without labels no longer load troika at all.
- ✅ Labels under WebGPU (M) ([spike results](spike-results.md#labels-under-webgpu-2026-10-19)):
  a render kit names its kind of material (`RenderKit.shading`, `'webgl'` or `'tsl'`), a
  `LabelEngine` may add `createTsl`, and `troikaLabels` from
  `@opsydyn/effect-three-troika/webgpu` draws with node materials: troika's layout and
  distance-field atlas (`getTextRenderInfo`), and troika's shader ported to TSL (outlines
  and blur, curves, colour ranges, lit materials, picking over the text block). Every
  sample now runs under `?renderer=webgpu`, labels included, and the label e2e runs on
  WebGL, WebGPU and WebGPU's WebGL 2 backend. Not ported: clip rectangles, inner strokes
  and outline offsets (`LabelNode` has none), and label shadows.
- Real-device checks (needs a headset): VR and AR in the room and toybox, WebXR on
  `WebGPURenderer`, and the DOM overlay; they retire the three documented limits.
- ✅ A Drei catalogue audit ([drei-audit.md](drei-audit.md)): every component is covered,
  a Model pattern, a sized candidate, or out of scope with a reason.
- ✅ The audit's S candidates, each traced from Drei at `bf6f4ad`:
  `rotation: billboard()` faces the camera each frame; `roundedBox()` and `backdrop()`
  are shapes; `group({ detail: detailed({ distances }) })` shows one level by the
  camera's distance (three's `LOD.update`), and picking skips what is hidden, as
  `LOD.raycast` does; a camera's `shake: cameraShake()` is seeded noise, pure in scene
  time, still under reduced motion; and `borrowed` clones skinned models with
  `SkeletonUtils.clone`, so each copy animates on its own, with Drei `Clone`'s
  `castShadow` and `receiveShadow` shorthands.
- ✅ Lines (Drei's `Line` and `Segments`): `line({ points, width, worldUnits, dashed,
vertexColors, segments })`, drawn by each render kit with three's fat lines (`Line2`
  and `LineMaterial` for WebGL, `Line2NodeMaterial` for WebGPU), pickable within their
  width; Drei's curve lines are point builders (`catmullRomPoints`, `cubicBezierPoints`,
  `quadraticBezierPoints`, `catmullRomColors`). Checked by pixel on three renderers. The
  bowling lane's aim guide uses one.
- ✅ The rest of the line and points families. `mesh({ edges: edges() })` draws a mesh's
  hard edges (Drei's `Edges`, three's `EdgesGeometry`) as kit lines, never picked.
  `trail()` on a group or mesh is Drei's `Trail`, recorded on a 60 Hz scene-time clock
  rather than per frame (so a trail is as long at any frame rate) and drawn as a
  camera-facing ribbon of vertex colours that either renderer draws, with `taper` and
  `fade` for Drei's `attenuation`. `points()`, `sparkles()` and `stars()` are Drei's
  `Points` (with `PointMaterial`), `Sparkles` and `Stars`: the kernel makes the buffers,
  seeded where Drei uses `Math.random`, and each kit draws them (Drei's shaders under
  WebGL; instanced sprites with `PointsNodeMaterial` and the same maths in TSL under
  WebGPU), moving in scene time and still under reduced motion. Round dots and lines are
  checked by pixel on three renderers. The promo's curves example shows them all.
  Transform gizmos and the other widgets followed as submodels (5).

## Beyond parity

Parity made effect-three able to build what React Three Fiber builds. These go where it
cannot easily follow, because they rest on what is different here: the Model is the whole
truth, scenes are a pure function of it, every change is a Schema-typed Message, and
Effect owns every lifetime.

1. **Event-sourced replay** ([ADR-011](adr/011-event-sourced-replay.md)). Record the
   player's inputs, let deterministic physics produce the rest: shareable runs as links,
   ghost replays, bug reports that reproduce, and time travel that covers the physics
   world.
   ✅ First, the bowling spike: rolls recorded and replayed from a link, each starting from
   a world at rest.
   ✅ Then on the timeline (2026-10-20, with ADR-014): the tabletop's "Replay this game"
   link carries every throw and rebuild with its step and the world's checksums; opening
   it plays the game back at its pace, with no session, and checks the world against the
   record (14 of 14 checks met in Chromium). Throws land mid-motion, so nothing waits for
   rest. ADR-011 is accepted.
2. **Lockstep multiplayer and XR co-presence.** If every peer runs the same `update`,
   sharing the input stream (an Effect `Stream` over a socket) shares the world; other
   players' heads and hands are more tracked spaces. Needs inputs applied at step
   boundaries (see ADR-011) and, later, rollback, which pure updates make possible.
   ✅ First ([ADR-013](adr/013-lockstep-collaboration.md), 2026-10-20): editing
   together. The kernel's `Lockstep` is the protocol as data (turns, members, the
   leader admitting and dropping, welcomes); the editor's shared changes are Edits sent
   through it over a `BroadcastChannel`, so tabs of one browser edit one scene with one
   history. Checked over a simulated lossy-timing network and in two real tabs.
   ✅ Then between machines (2026-10-20): `bun run relay` is a WebSocket relay that hands
   each message to every other peer in a room and reads none of them, and the editor
   with `?relay=ws://host:port/room` runs its session through it, the socket a Foldkit
   managed resource. A lost relay leaves each editor working alone until it reconnects.
   Checked with real sockets and with separate browser contexts, which share no
   channel.
   ✅ Then physics ([ADR-014](adr/014-physics-in-lockstep.md), 2026-10-20): the Model
   keeps the world's clock. `physics({ until })` steps a world toward a step and stops
   there, reporting `PhysicsReached` with a checksum of every body's pose; whatever
   changes while it waits lands at that step, however the frames fell. `Timeline` holds
   inputs stamped with their step, `physics({ run })` starts a world over, and
   `@opsydyn/effect-three-rapier/deterministic` is Rapier's cross-platform build. The
   promo's tabletop example throws balls at a tower from every peer: a turn's throws
   land at that turn's step, a newcomer replays the record from step 0, and peers
   compare checksums every second. Checked by simulated peers, real Rapier at random
   frame timings, and three browser contexts through the relay.
   ✅ Then a snapshot welcome ([ADR-018](adr/018-snapshot-welcome.md)):
   `physics({ snapshotAt })` reports a snapshot of the world, and `physics({ from })`
   starts a run from one, with Rapier's snapshots in the page and in a worker. The
   tabletop's leader snapshots at each check, and a newcomer starts from its latest
   rather than replaying from step 0.
   ✅ Then rollback ([ADR-019](adr/019-rollback.md)): `physics({ keep })` keeps the
   world's latest stops, and a run starts from one by step. The tabletop with
   `?predict=1` runs its world to the turn it sends, shows its own throws at once, and
   rolls back a few steps when another's lands where its world has been; checked with
   real Rapier worlds over a network two turns late. Next: XR co-presence, other
   players' heads and hands as tracked spaces in a shared session.
3. **Agent-native 3D.** Descriptions and Messages are Schema-decoded, and an invalid
   description is rejected whole, so a model's actions cannot leave the world broken.
   Expose the Model and Messages as tools (Foldkit DevTools already serves an MCP relay)
   and an assistant can furnish a room or set up a shot, undoably and replayably.
   ✅ First step: the XR room exports `devTools = { Message }` and an intent-level
   `PlacedPlant { at, kind }`; through `@foldkit/devtools-mcp` an agent reads the Model
   and places plants, and an unknown kind is refused by the schema (checked end to end
   in a headless browser, 2026-10-19; what we found about the MCP server is in
   [devtools-mcp-notes.md](devtools-mcp-notes.md)).
   ✅ Then a scene-level vocabulary (2026-10-20): `describeScene` and `formatSummary`
   say what a scene contains (camera, things with kind, size, colour and place, lights,
   bounds, staging) in a few lines an agent reads; `shotCamera` frames a box from a
   named angle (`front`, `three-quarter`, `top`, `low` …) and `moodStaging` lights a
   scene by mood (`studio`, `daylight`, `sunset`, `night`). The editor takes them as
   intents, `PlacedThing`, `FramedShot` and `ChoseMood`, exported to the DevTools MCP
   server; an agent placed things, chose a mood and framed a shot through it, and a mood
   the schema does not know was refused (checked end to end in a headless browser).
   Next: tools that answer with a scene's description directly, rather than the raw
   Model.
4. **Tooling from Schema.** An inspector generated from the scene schemas, save and load
   as JSON, undo and branching history from the immutable Model, and scene diffs in
   review from the kernel's own ops.
   ✅ First ([ADR-012](adr/012-tooling-from-schema.md)): `SceneFile.save` and `read`
   (the schema's encoding in a versioned envelope; every generated scene reads back
   unchanged), `History` (a tree of Model values: undo, redo, branches kept and chosen),
   and `sceneChanges` with `formatChanges` and `bun run scene:diff a.json b.json` (the
   kernel's own operations as lines for review). The arrange example undoes along
   branches.
   ✅ Then the inspector: `Inspector.fields(schema, value)` walks any schema's AST beside
   a value (a scene node, a material, an app's own record) and lists its fields by kind,
   colours and vectors known by their `SceneSchema` types; `Inspector.edit` puts a new
   value at a path and decodes it, so nothing the schema refuses gets in. The adapter's
   `inspectorView` draws the form. The arrange example inspects the selected thing.
   With it, 4 is done.
5. **Interaction widgets as Foldkit submodels.** A transform gizmo, box select, a
   measuring tape, an XR teleport arc: pure, property-tested, composed through
   OutMessages, as ADR-006 did for cameras.
   ✅ First: the transform gizmo (three's `TransformControls`, which Drei's wraps). The
   core's `gizmoNodes`, `pressGizmo` and `dragGizmo` are pure, checked against three's
   controls to six decimal places for every translate handle in both spaces, rotation,
   scale and snaps; `basic({ depthTest: false })` draws its handles over everything, as
   three's are. The adapter's `TransformGizmo` is the Foldkit submodel: Messages in,
   `Moved` and `Finished` OutMessages out, the parent keeping every placement. The
   promo's arrange example selects, moves, turns, scales, snaps and undoes.
   ✅ Then box select (three's `SelectionBox`, which Drei's `Select` wraps). The core's
   `boxSelect` is pure, checked against three's box for perspective and orthographic
   cameras; a new `GestureEnd` scene event ends a drag that began on nothing. The
   adapter's `BoxSelect` submodel draws the box from shift-drags and reports `Selected`;
   `movedAlike` lets one gizmo move a whole selection.
   ✅ Then the viewport gizmo (Drei's `GizmoHelper` with `GizmoViewport`), on a new
   `hud` (Drei's `Hud`): nodes drawn over the scene with their own camera in CSS
   pixels, anchored to a corner, picked first. `viewportGizmoNodes` turns with the
   camera as Drei's does (checked against the inverse of three's camera matrix), and
   the adapter's `ViewportGizmo` reports `Turned { camera }` from `cameraAlong`; a
   damped camera eases round as Drei's tween.
   ✅ Then the pivot controls (Drei's `PivotControls`): every handle at once, turned
   with the object and sized in scene units. `pivotNodes`, `pressPivot` and `dragPivot`
   follow Drei's maths for arrows, plane squares, quarter arcs and scaling spheres,
   checked against Drei's handlers replayed with three's matrices; the adapter's
   `PivotControls` is the submodel. The arrange example switches between the two
   gizmos.
   ✅ Last, the measuring tape, which neither three nor Drei has: `tape`, `placeTapeEnd`,
   `pointTape` and `tapeNodes` (two clicked ends, a dashed run to the pointer while the
   second is placed, optional snapping), and the adapter's `MeasuringTape` with its
   length as an overlay at the middle. The arrange example measures between anything on
   the table. Next: the XR teleport arc, the last widget of 5 (`teleport` today moves
   the player to where a straight ray points).
6. **Effect-native data and assets.** KeyedQuery-style asset loading cancelled when the
   Model stops asking, level of detail as a stream of descriptions, Rapier in a Worker
   behind the same engine contract, and server rendering of a `SceneDescription` for
   previews.
   ✅ First ([ADR-015](adr/015-assets-a-scene-asks-for.md), 2026-10-20): a scene asks for
   its assets (`scene({ assets: [modelAsset({ id, url })] })`), and the environment loads
   each once however many scenes ask, aborts a load no scene asks for any more, and frees
   an asset when the last scene stops asking; scenes hear `onAssetLoaded` and
   `onAssetFailed`. The workshop example unloads by no longer asking, which cancels a load
   under way (checked with the robot's request held in the network).
   ✅ Then level of detail as a stream (ADR-015, levels): an asset lists coarser
   `levels`, all loaded at once; each is shown as it arrives if it is finer than what is
   shown, and once the finest is shown the coarser loads still under way are cancelled.
   Scenes hear each level, with whether it is `final`. The workshop's robot and floor
   start coarse and sharpen.
   ✅ Then server rendering for previews
   ([ADR-016](adr/016-previews-without-a-browser.md)): `previewSvg` draws a description
   as a flat-shaded SVG without a browser or GPU, ordered by a binary space partition so
   floors and walls never cover what stands on them, and `scene:preview` draws a scene
   file. The promo's guide shows two examples drawn at build time.
   ✅ Last, Rapier in a Worker ([ADR-017](adr/017-physics-in-a-worker.md)):
   `remotePhysics(worker)` is a `PhysicsEngine` whose worlds live in a worker running
   `servePhysics`, pipelined a frame behind, with an optional `received()` on the world
   contract so `until` reports wait for the worker's answer. The tabletop takes
   `?physics=worker`, and its peers agree whether their physics is in the page or in a
   worker. With it, every part of 6 is done.

A flagship that ties them together: a collaborative, replayable scene editor with an
assistant, built as a Foldkit app (4 and 5 for editing, 1 for history, 2 for
collaboration, 3 for the assistant).
✅ First, single-user (2026-10-20): the promo's editor example. The document is a list
of scene nodes in the Model; it adds, duplicates and deletes them, selects by click,
outliner or box, moves them with the gizmo (lights by their markers), edits any field
in an inspector read from `SceneSchema.SceneNode`, undoes along branches or jumps to
any step, saves and opens scene files, and lists the changes since saving with the
kernel's diff. Since then it takes an assistant's intents (3) and edits together, in
tabs or through a relay between machines (2).

### Recommendation

The replay spike (1), the Drei audit and its S candidates, agent control of the XR room
(3), labels under WebGPU (E), the line and points families, the transform gizmo, box
select, the viewport gizmo, the pivot controls and the measuring tape (5) are done, and so is
tooling from Schema (4): scene files, branching history, review diffs and the inspector.
The scene editor ties them together, agents can describe and stage a scene through it
(3), and tabs, or machines through a relay, edit it together in lockstep (2); physics
runs in lockstep too, inputs landing at a step the Model sets (2), and a game replays
from a link, checked step by step against its record (1). Data and assets (6) are done:
scenes ask for their assets, loaded, shared, cancelled and freed for them, coarse levels
first; a scene previews as SVG without a browser; and Rapier steps in a worker behind the
same engine contract. A newcomer to a lockstep session starts from the leader's
snapshot, and a predicting peer rolls back for late inputs (2).

Still open:

- XR co-presence (2): other players' heads and hands as tracked spaces, over the
  lockstep session and relay that already exist.
- The XR teleport arc (5), the last interaction widget.
- Agent tools that answer with a scene's description (`describeScene`) rather than the
  raw Model (3).
- Real-device XR checks (E, needs a headset): VR and AR in the room and toybox, WebXR on
  `WebGPURenderer`, and the DOM overlay. Until then they stay documented limits.

## Not planned

- An open catalogue with arbitrary props (`extend`, `attach`, `position-x`). Borrowed
  objects (R3) cover the escape hatch while the catalogue stays closed and typed.
- Imperative refs and per-frame mutation from application code. User-defined behaviours
  (R4) replace them.
- React-specific machinery: Suspense, context bridging, the test renderer.
