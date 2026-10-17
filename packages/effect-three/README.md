# @opsydyn/effect-three

Declarative Three.js scenes with Effect owning every lifetime: GPU resources, renderers, frame subscriptions and event queues are acquired in a `Scope` and released when it closes. Scenes are plain data, so they can be derived from an application model, diffed and tested without a browser.

The core is independent of any UI framework and of the DOM. For Foldkit, use [`@opsydyn/effect-three-foldkit`](../effect-three-foldkit/README.md).

> Status: private, pre-release (`0.0.0`). The API is documented in [`etc/effect-three.api.md`](etc/effect-three.api.md).

## Describe a scene

```ts
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  scene,
  sharedGeometry,
  sharedMaterial,
  spin,
  standard,
} from '@opsydyn/effect-three';

const description = scene({
  resources: {
    geometries: [{ id: 'cube', geometry: box() }],
    materials: [{ id: 'paint', material: standard({ color: 0x14b8a6 }) }],
  },
  children: [
    ambientLight({ key: 'ambient', intensity: 0.4 }),
    directionalLight({ key: 'sun', position: [3, 4, 5] }),
    mesh({
      key: 'cube',
      geometry: sharedGeometry('cube'),
      material: sharedMaterial('paint'),
      rotation: spin({ axis: 'y', radiansPerSecond: 1 }),
      interactive: true,
    }),
  ],
});
```

- **Keys are unique across the whole scene.** A node keeps its three.js object while its key and kind stay the same, including when it moves to another group. A different kind under the same key replaces the object in place.
- **Descriptions are fully specified data.** The constructors fill in defaults, and nothing in a description is a closure or a three.js object.
- **Shapes:** `box`, `sphere`, `plane`, `cylinder`, `torus`, `cone`, `capsule`, `ring` and `circle`, owned by one mesh or shared through `resources`. Parameter names and defaults are three.js's own.
- **Materials:** `basic`, `lambert`, `phong`, `standard`, `physical` and `normalMaterial`, each with opacity, transparency, `side`, wireframe and (lit kinds) flat shading and emission. Defaults are three.js's own. Changing a material within its kind updates it in place; changing its kind replaces it.
- **Shadows and render settings:** `scene({ render: renderSettings({ shadows: 'soft', toneMapping: 'aces' }) })`, then `castShadow`/`receiveShadow` on meshes and `castShadow` on directional, point and spot lights. Tone mapping defaults to `none` (React Three Fiber defaults to ACES) so colours render exactly as given.
- **Instancing:** `instances({ key, geometry, material, instances: [instance({ key, position, color })] })` draws many copies in one call. Updates rewrite only the instances that changed, and hits name the instance (`instance` on the event).
- **Views:** `scene({ views: [view({ key: 'front', camera, rect: { width: 0.5 } }), ...] })` draws several cameras into parts of one canvas; picks use the view under the pointer and report it as `view`.
- **Post-processing:** `renderSettings({ effects: [bloom({ strength: 1.5 }), vignette()] })` applies three.js's composer passes in order (`bloom`, `vignette`, `film`); with no effects the scene renders straight to the screen.
- **Render textures:** `scene({ renderTextures: [renderTexture({ id: 'screen', camera, children })] })` draws a little scene of its own into a texture that any material uses with `map: 'screen'`; it redraws only when its scene changes.
- **Orbit controls:** `scene({ gestures: 'scene', camera: model.camera })` claims drags, wheel and pinches from the page and reports each as a `Gesture`; `orbit(model.camera, gesture)` returns the next camera, as three.js's `OrbitControls` would move it. A camera's `damping` eases the rendered camera there. See [ADR-006](../../docs/effect-three/adr/006-controls-as-data.md).
- **Fitting:** `scene({ measure: ['model'] })` reports the node's world box as a `Measured` event whenever it changes; `fitCamera(camera, box, area)` frames it as Drei's `Bounds` does, and `orbitKey` moves the camera for arrow keys.
- **HTML overlays:** `overlay({ key: 'tag', node: 'cone', position: [0, 1, 0], center: true })` is a point the scene places after every drawn frame, as Drei's `Html`; the Foldkit view's `overlays: [{ overlay, content }]` moves Model-rendered HTML there.
- **Text:** `text({ text: 'Hello', font: 'inter', depth: 0.2 })` is extruded (or, at depth 0, flat) text from a typeface JSON font lent with `store.lendFont` (`assets.loadFont` in Foldkit), as Drei's `Text3D`, with `letterSpacing`, `lineHeight` and `align` applied (three ignores them).
- **Labels:** `label({ key: 'title', text: 'Hello', font: '/inter.woff', fontSize: 0.5 })` is crisp distance-field text at any size, as Drei's `Text`: wrapping (`maxWidth`), anchors, alignment, spacing and outlines. Pass an engine (`troikaLabels()` from `@opsydyn/effect-three-troika`); fonts are TTF, OTF or WOFF (troika 0.52 cannot read WOFF2).
- **Staging:** `scene({ environment: environment(), sky: sky() })` adds image-based lighting (three's `RoomEnvironment`, or a lent panorama with `map`) and a daylight sky, as Drei's `Environment` and `Sky`; `grid({ key })` draws three's `GridHelper`, `contactShadows()` draws Drei's soft ground shadows, and `shadowMaterial()` shows only the shadows cast onto it.
- **Stage:** `const { lights, contactShadows, environment } = stage({ radius: 1.2, height: 2 })` is Drei's `Stage` lighting (presets `rembrandt`, `portrait`, `upfront`, `soft`) for content centred on the origin; spread the parts into `scene`. Measure the content (`scene({ measure })`), place it at `centerOffset(box)` (Drei's `Center`), light it with `stage(stageBounds(box))` and frame it with `fitCamera`.
- **Grids and presets:** `shaderGrid({ key, infinite: true })` is Drei's fading shader `Grid`; `environmentPresetUrl('sunset')` is one of Drei's ten environment HDRs, for `assets.loadEnvironment`.
- **Physics:** `mesh({ body: body({ collider: 'ball', restitution: 0.6 }) })` under `scene({ physics: physics() })` makes a rigid body the simulation moves; kicks are `impulse: { id, impulse }`, applied once per id, and collisions arrive as `Collision` events. Pass an engine (`loadRapier()` from `@opsydyn/effect-three-rapier`) to the scene graph or the Foldkit environment. See [ADR-007](../../docs/effect-three/adr/007-physics-as-a-pose-source.md).
- **XR:** `scene({ xr: xr({ origin: [0, 0, 4] }) })` lets a scene be presented in a WebXR session; in Foldkit, run `environment.xr.enter('immersive-vr')` from a click's Command. The session drives frames, the player stands at `origin`, and controllers and hands hover, click and drag along their rays. Thumbsticks arrive as `XrStick` events (`locomote(model.xr, stick)` snap-turns and steps), buttons as `XrButton`, and in AR with `xr({ hitTest: true })` a select reports the real surface it met (`XrSurface`). See [ADR-008](../../docs/effect-three/adr/008-immersive-sessions.md).
- **Cameras:** `perspectiveCamera({ fov })` or `orthographicCamera({ zoom })`. As in React Three Fiber, an orthographic frustum follows the viewport in CSS pixels, with `zoom` in pixels per world unit.
- **Lights:** `ambientLight`, `directionalLight`, `pointLight`, `spotLight` (aimed at a world-space `target`) and `hemisphereLight`, with three.js defaults.

## Run it

```ts
import { Effect, Layer } from 'effect';
import { FrameSource, ResourceRegistry, SceneRuntime } from '@opsydyn/effect-three';

const program = Effect.gen(function* () {
  const handle = yield* SceneRuntime.make({ scene: description, renderer, viewport });
  yield* handle.update(nextDescription); // diff and apply; equal scenes cost no host changes
  handle.pointer({ _tag: 'PointerDown', x: 0, y: 0, button: 0 }); // normalised device coords
  // handle.events: Stream of PointerEnter | PointerMove | PointerLeave | PointerDown | PointerUp
  //   | Click | DoubleClick | ContextMenu | Wheel | PointerMissed | Drag | DragEnd | Gesture
}).pipe(Effect.scoped);

const environment = Layer.mergeAll(ResourceRegistry.layer, FrameSource.layer(scheduler));
```

- `renderer` is a `RendererFactory`: a plain object whose `create()` returns a renderer bound to one drawing surface. The WebGL2 implementation lives in the browser adapter. A WebGPU one can be added without touching the core.
- `FrameSource.layer(scheduler)` takes any `FrameScheduler`: `requestAnimationFrame`, three's `setAnimationLoop`, or `createManualFrames()` in tests.
- Pointer events follow React Three Fiber's semantics: click, double-click and context menu go only to the mesh that was pressed; a click that hits nothing and moves at most 2 CSS pixels is a `PointerMissed`. Hits carry the key, world-space point, distance, face normal and uv.
- `make` is atomic. If the description is invalid (`InvalidScene`), the renderer can't be created (`RendererUnavailable`), or startup is interrupted, everything already acquired is released before it returns.

## Resource ownership

| Mode   | Declared as                                                              | Lifetime                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned  | `geometry: box(...)`, `material: standard(...)`                          | Created for one mesh, disposed with it. Owned material changes are applied in place.                                                                                                                                                                                        |
| Shared | `sharedGeometry(id)`, `sharedMaterial(id)` plus a `resources` definition | Created on first use, reference-counted across every scene using the same `ResourceRegistry`, disposed when the last user releases it. Changing a shared material updates it in place; changing a shared geometry swaps a new one onto every user and disposes the old one. |

Borrowed objects and textures are the application's own: lend them to the store and the library shows them but never disposes them.

```ts
const withdraw = store.lend('car', gltf.scene); // then: borrowed({ key: 'car', id: 'car' })
store.lendTexture('bricks', texture); // then: standard({ map: 'bricks' })
```

A `borrowed` node may name an id before it is lent, so a description can refer to a model that is still loading; it appears when lent and disappears when withdrawn. Hits inside a borrowed object carry the `part` name of the mesh hit.

## Animation

Behaviours own animated properties: a mesh's rotation is either model-owned (`fixed`) or behaviour-owned (`spin`), never both. A behaviour's output is a pure function of scene time, so frames are deterministic and frame-rate independent.

Behaviours replace React Three Fiber's `useFrame` with data: a node names one, `behaviour: behave('float', { speed: 2 })`, and the behaviour (a pure function of scene time registered with the scene) adds a position offset, a rotation and a scale factor on top of the node's transform each frame. `float` (Drei's `Float`) is built in; register your own through `SceneRuntime.make({ behaviours })` or `makeEnvironment(window, { behaviours })`:

```ts
const orbit: Behaviour = (pose, seconds, params) =>
  pose.offset.set(Math.cos(seconds) * (params['radius'] ?? 1), 0, Math.sin(seconds));
```

Transitions decide how `position` and `scale` reach new values. The Model always owns the target; a transition only shapes the journey:

```ts
mesh({
  key: 'cube',
  position: [model.column, 0, 0],
  transition: ease({ seconds: 0.35, easing: 'easeOutBack' }), // default: instant()
  geometry: box(),
  material: standard({ color: 0x14b8a6 }),
});
```

- A new target mid-flight restarts from the pose on screen, so nothing jumps. A node moving to another group keeps its world position and travels to its new place.
- Easings: `linear`, `easeInOutCubic` (default), `easeOutCubic`, `easeOutBack`. Tweens run in the frame loop without allocating and never reach `update`.

Frames render on demand by default: a scene draws after any change and while anything animates, then stops requesting frames until the next change, so nothing ever calls `invalidate`. `render: renderSettings({ frames: 'always' })` draws every display frame, as React Three Fiber's default does; `frames: 'never'` draws only on `handle.advance`.

When frames run persistently slow, the scene emits `PerformanceChanged { fps, factor }` (Drei's `PerformanceMonitor` algorithm). Store the factor in the Model and pass it back as `renderSettings({ resolution })` to lower the pixel ratio until frames recover.

`handle.setAnimating(false)` freezes scene time (for `prefers-reduced-motion`) while frames keep rendering; transitions then land at once, including any in flight.

## Testing

Everything needed for deterministic headless tests ships with the package:

- `recordingRendererFactory()`: counts renders and records viewport and disposal.
- `createManualFrames()`: frames run when you call `step()`.
- Effect's `TestClock`: scene time comes from the `Clock` service's monotonic reading.
- `createSceneGraph()`: the synchronous kernel on its own, with `object(key)` and resource `stats()` for assertions.

## Architecture

- `src/kernel`: plain TypeScript (descriptions, keyed diff, applier, resource store, behaviours, pointer hit testing). It must not import `effect` ([ADR-003](../../docs/effect-three/adr/003-kernel-runtime-layering.md)).
- `src/runtime`: Effect services, scopes and typed errors.

Decisions and their evidence are in [`docs/effect-three`](../../docs/effect-three/).

## Development

```sh
bun run test         # unit and property tests (effect/Arbitrary)
bun run check        # strict lint, layering and single-effect checks
bun run typecheck    # TypeScript 7
bun run bench:check  # benchmarks against the plan's budgets
bun run build        # dist JS (bun build) and declarations (tsc)
bun run api:check    # fail if the public API changed without updating etc/
```

Current benchmark results (Apple Silicon, 1,000 meshes):

| Case                         | Median                 | Budget |
| ---------------------------- | ---------------------- | ------ |
| No-op reconcile              | ~120 µs                | 200 µs |
| One changed property         | ~130 µs, 1 op          | 500 µs |
| Runtime mount + unmount      | ~17 µs                 | 1 ms   |
| Frame with one animated mesh | ~31 ns, no heap growth | 50 µs  |
