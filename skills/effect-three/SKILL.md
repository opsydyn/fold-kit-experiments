---
name: effect-three
description: Use when building or reviewing 3D scenes with @opsydyn/effect-three and its Foldkit adapter (@opsydyn/effect-three-foldkit), adding physics (@opsydyn/effect-three-rapier) or labels (@opsydyn/effect-three-troika), keeping cameras, controls, XR and scene events in a Foldkit Model, choosing WebGL or WebGPU, or testing scenes headlessly. Astro is not required.
---

# effect-three

Describe a Three.js scene as plain data derived from the application's Model; the
library diffs each description against the last and changes only what changed. Scene
events come back as the application's own Messages, and Effect scopes own every GPU
resource, renderer and listener. This skill works without Astro or another skill.

## Establish the consumer contract

Read the installed versions, export maps and declarations before choosing APIs. The
[headless example](assets/headless/package.json) targets the published
`@opsydyn/effect-three@0.1.0` with `three@0.186.1` and `effect@4.0.0`, and needs no
browser. The Foldkit adapter targets FoldKit `0.167.x`. These are qualified baselines,
not instructions to downgrade another project.

The four packages are released together at one version, and `-foldkit`, `-rapier` and
`-troika` take the core as a peer at exactly that version: install matching versions,
one core per application. They are `0.x`: a breaking change bumps the minor version.

## Choose the smallest layer

| Need                                                   | Public entry                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Describe scenes; orbit, locomotion and event types     | `@opsydyn/effect-three` (builders also on `/kernel`)                          |
| Reconcile and inspect scenes without a browser         | `@opsydyn/effect-three/kernel` (`createSceneGraph`, no Effect, no DOM)        |
| Run a scene with Effect services and a frame source    | `@opsydyn/effect-three` (`SceneRuntime`, `FrameSource`, `ResourceRegistry`)   |
| Show a scene in a Foldkit view, events as Messages     | `@opsydyn/effect-three-foldkit` (`makeEnvironment`, `makeSceneMount`, `view`) |
| Rigid bodies, joints, collisions                       | `@opsydyn/effect-three-rapier` (`loadRapier()` as the environment's physics)  |
| Distance-field labels                                  | `@opsydyn/effect-three-troika` (`troikaLabels()` as the environment's labels) |
| Sky, shader grid, contact shadows on a custom renderer | `@opsydyn/effect-three/webgl` or `/webgpu` render kits                        |

Install Rapier and troika only on pages that need them; Rapier embeds WebAssembly.
Without an engine, bodies stay put and labels are empty, but descriptions still
reconcile. See [scene composition](references/scenes.md) for the description rules,
events, assets, engines, renderers and XR, and [the Foldkit example](assets/foldkit-scene.ts)
for a view with selection and a Model-owned orbit camera.

## Keep state in the Model

- **Scenes are data.** A description holds no closures and no three.js objects. Derive
  it in `view` from the Model each render; equal descriptions cost nothing, and changed
  ones reuse their objects.
- **Keys are identity.** Keys are unique across the whole scene, nested groups
  included. Use the record's stable id, never its index in a filtered or sorted list.
  A node keeps its three.js object while its key and kind stay the same.
- **The Model owns what persists**: the camera (`orbit`, `rotateCamera`, `fitCamera`),
  the XR player (`locomote`, `teleport`, `glided`), selection and hover. Things that
  move every frame without changing the Model are behaviours (`spin`, `float`, user
  `behaviours`), physics, damping and `autoRotate`; the scene reports where they end
  (`AutoRotated`, `XrMoved`) when the Model needs it.
- **Events are opt-in Messages.** Pass only the handlers you need (`onClick`,
  `onGesture`, `onCollision`, `onXRStick`…). Scenes do not claim the page's gestures
  unless `scene({ gestures: 'scene' })`; then ignore gestures that began on a mesh
  you drag, as an R3F app disables controls while dragging.
- **The application owns assets and loading.** Load models, textures, fonts and HDR
  panoramas as Effects in Commands (`environment.assets.load*`), settle them into the
  Model, and refer to them by id. A description may name an id before it is lent; it
  appears when lent. Lent objects, textures and geometries are never disposed by the
  library.

## Verify

Copy `assets/headless/` into a standalone project and run `npm install`,
`npm run check` and `npm test`. The tests reconcile real descriptions and check object
identity, resource release and atomic rejection. For browser work also check resize,
an off-screen pause, reduced motion, pointer and keyboard paths, and light and dark
page themes (renderers are opaque unless created with `alpha`, as three's are).

When changing the packages themselves, trace React Three Fiber, Drei or three.js first
and keep the catalogue typed and closed; consult the repository's ADRs. Consult
`astro-foldkit` only when embedding into Astro, and `foldkit-viz` only for chart
geometry (its scales can place 3D marks).
