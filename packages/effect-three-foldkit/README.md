# @opsydyn/effect-three-foldkit

A thin Foldkit adapter for [`@opsydyn/effect-three`](../effect-three/README.md): derive a Three.js scene from your Model, get pointer interaction back as your own typed Messages, and let Foldkit's runtime own the scene's lifetime.

> Status: private, pre-release (`0.0.0`). The API is documented in [`etc/effect-three-foldkit.api.md`](etc/effect-three-foldkit.api.md). Live samples are in `apps/web` at `/effect-three` and on the effect-three promo site (`apps/three-promo`); their source is in [`packages/effect-three-samples`](../effect-three-samples/).

## Use it

```ts
// entry: once per application
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

export const environment = EffectThreeFoldkit.makeEnvironment(window);
export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
```

```ts
// message.ts
export const Message = defineMessageUnion({
  ClickedCube: { key: Schema.String },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});

// view.ts
EffectThreeFoldkit.view(
  {
    scene: sceneFor(model), // plain data derived from the Model
    mount: sceneMount,
    className: styles.scene, // the element needs a size
    onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
    onClick: ({ key }) => Message.ClickedCube({ key }),
  },
  h,
);
```

- **Updates are in place.** Foldkit hands the element a new scene on every render, and the core diffs it, so unchanged scenes cost no host changes and changed ones reuse their three.js objects.
- **Animation never touches the Model.** Behaviours such as `spin` run in the frame loop, outside Foldkit's `update`.
- **Events are typed and opt-in:** `onClick`, `onDoubleClick`, `onContextMenu`, `onPointerDown`, `onPointerUp`, `onPointerEnter`, `onPointerMove`, `onPointerLeave`, `onPointerMissed`, `onWheel`, `onDrag`, `onDragEnd`, `onError` and `onReconciled`. Only the handlers you pass are bound. Hits carry the mesh key, world-space point, distance, face normal and uv.
- **Groups and drags:** hits carry their ancestor `path`, and an `interactive` group makes every mesh inside it pickable. A press on a mesh captures the pointer, so `onDrag` keeps firing off the mesh and off the canvas; pair its `ray` with `pointOnPlane` to drag along a plane.
- **Pixel ratio:** `makeEnvironment(window, { pixelRatio: [1, 2] })` takes a fixed ratio or a `[min, max]` range around the device's (the default is `[1, 2]`, as React Three Fiber's `dpr`), and re-measures when the device ratio changes.
- **Assets:** `environment.assets.loadModel(id, url)` and `loadTexture(id, url)` load glTF models and textures as Effects for Commands (settle them into `AsyncData`), lend them to the store, and own them: loading an id again replaces and disposes the old asset, and `unload(id)` frees it. Show a model with `borrowed({ id, animation: play('wave') })`; use a texture with `map: id`.
- **Browser defaults:** a context menu over an interactive mesh keeps the browser's menu shut; elsewhere it opens as usual. Wheel listening is passive, so the page still scrolls.
- **Update telemetry:** `onReconciled` reports what each update did (created, updated, moved, removed, replaced, reordered) and the GPU resources held afterwards. It fires at startup and after updates that changed something, never for no-ops, so storing it in the Model can't loop.
- **Lifecycle:** `StartedScene` once the scene is running, or `FailedScene { reason }` (malformed or invalid scene, or no WebGL2).

## What the Mount handles

| Concern              | Behaviour                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unmount              | Releases the renderer, the WebGL context (`forceContextLoss`), GPU resources, pointer listeners, observers and the frame subscription.                                                                        |
| Resize               | `ResizeObserver` updates the camera aspect and drawing buffer; device pixel ratio is capped at 2.                                                                                                             |
| Off-screen           | `IntersectionObserver` pauses frames while the element isn't visible.                                                                                                                                         |
| Reduced motion       | `prefers-reduced-motion: reduce` freezes behaviours; frames still render.                                                                                                                                     |
| DevTools time travel | While Foldkit reports the view as `Paused`, pointer input and scene events are dropped.                                                                                                                       |
| Validation           | Scenes passed through `view` are type-checked at compile time and skip runtime validation. Any other value assigned to the element is Schema-decoded, and failures arrive as `onError` with `MalformedScene`. |

`<effect-three-scene>` is never registered with `customElements`, so there's nothing to re-register under HMR or guard during SSR. See [ADR-002](../../docs/effect-three/adr/002-foldkit-adapter-seam.md).

## Options

`makeEnvironment(window, { renderer })` takes an optional renderer factory per canvas (WebGL2 by default). Use it for a WebGPU renderer or for test instrumentation.

## Development

```sh
bun run test       # unit tests
bun run test:e2e   # Playwright in headless Chromium with SwiftShader
bun run check      # strict lint
bun run build      # dist JS and declarations
bun run api:check  # public API report
```

The browser tests prove the vertical slice end to end:

- typed click Messages;
- animation with zero `update` calls;
- in-place updates (pixel checks);
- full release on unmount, with listeners read through the Chrome DevTools Protocol;
- 20 mount/unmount cycles without WebGL context warnings;
- golden frames on a paused fake clock (`UPDATE_GOLDENS=1` rewrites them);
- three's renderer memory returning to baseline;
- the time-travel pause gate.
