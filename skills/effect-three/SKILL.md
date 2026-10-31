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
`@opsydyn/effect-three@0.6.4` with `three@0.186.1` and `effect@4.1.0`, and needs no
browser. The Foldkit adapter accepts FoldKit `0.167` to `0.170` and is qualified on
`0.170`. These are qualified baselines, not instructions to downgrade another project.

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
| Distance-field labels                                  | `@opsydyn/effect-three-troika` (`troikaLabels()` as the environment's labels; from `/webgpu` to draw under WebGPU too) |
| Sky, shader grid, contact shadows on a custom renderer | `@opsydyn/effect-three/webgl` or `/webgpu` render kits                        |

Install Rapier and troika only on pages that need them; Rapier embeds WebAssembly.
Without an engine, bodies stay put and labels are empty, but descriptions still
reconcile. See [scene composition](references/scenes.md) for the description rules,
events, assets, engines, renderers, XR and agents, and [the Foldkit example](assets/foldkit-scene.ts)
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
- **Editing widgets are submodels.** The adapter's `TransformGizmo`, `PivotControls`,
  `BoxSelect`, `ViewportGizmo` and `MeasuringTape` keep their own Models and report
  OutMessages; the parent keeps the placements, the selection and the camera. Scene
  files (`SceneFile`), branching history (`History`), review diffs (`sceneChanges`), the
  schema-generated inspector (`Inspector`, `inspectorView`), a scene vocabulary for
  agents (`describeScene`, `shotCamera`, `moodStaging`) and editing together
  (`Lockstep`) are pure too; the promo's editor example uses them all. Physics in
  lockstep puts the world's clock in the Model (`physics({ until })`, `Timeline`): the
  tabletop example; `physics({ snapshotAt })` reports a snapshot and `physics({ from })`
  starts a run from one, so a newcomer starts from the leader's world; `physics({ keep })`
  keeps recent stops, and `from: { step, snapshot: null }` rolls back to one. To step physics off the page's thread, serve Rapier in a worker
  (`servePhysics`) and pass `remotePhysics(worker)` as the environment's physics, from
  `@opsydyn/effect-three-rapier/worker`; it is a frame behind, and agrees with peers.
- **The Model says which assets it wants.** List them in the description
  (`scene({ assets: [modelAsset({ id, url })] })`): the environment loads, shares,
  cancels and frees them, and the scene reports `onAssetLoaded` / `onAssetFailed` to
  settle into the Model by id; stop asking to unload. Give an asset coarser `levels`
  (`modelAsset({ id, url, levels: ['robot-low.glb'] })`) to show them first: each
  `onAssetLoaded` says its `level` and whether it is `final`. Commands
  (`environment.assets.load*`) remain for an asset the app owns outright; one way per id. A description may name an id before it is lent; it
  appears when lent. Lent objects, textures and geometries are never disposed by the
  library.
- **A still without a browser:** `previewSvg(description, { width, height })` draws a
  flat-shaded SVG of a scene anywhere JavaScript runs (a build, a server, a test), and
  `bun run scene:preview scene.json out.svg` does it for a scene file. No textures,
  shadows or labels.

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
