# Scene Composition

## A standalone headless consumer

`assets/headless/` is a complete TypeScript project: a Model, `sceneFor(model)` built
from `@opsydyn/effect-three/kernel`, and Node tests that reconcile it with
`createSceneGraph()`. It pins `@opsydyn/effect-three@0.1.0`, `three@0.186.1`,
`effect@4.0.0` and TypeScript 6.0.3 and runs without a browser, renderer or FoldKit.
`reconcile(description)` returns `Applied { ops }` or `Invalid { error }`; an invalid
description (a duplicate key, an unknown shared resource or behaviour) changes
nothing. `object(key)` returns the three.js object for assertions and `store.stats()`
the live geometries and materials.

For runtime tests, `SceneRuntime.make` with `recordingRendererFactory()`,
`FrameSource.layer(createManualFrames())` and Effect's `TestClock` runs frames on
demand and records renders and disposal.

## Describing scenes

`scene({ camera, children, resources, render, ... })` and the node builders fill in
three.js's defaults, so a description is fully specified data.

- **Nodes:** `mesh`, `instances` (+ `instance`, diffed per instance key), `group`,
  `borrowed` (an application-owned object by id, with `play(clip)`), `label`, `text`
  (extruded typeface text), lights, `grid` and `shaderGrid`.
- **Geometry and materials:** shapes are owned by one mesh, shared through
  `resources` (`sharedGeometry(id)`, `sharedMaterial(id)`), or lent
  (`lentGeometry(id)` with `store.lendGeometry`). Changing a material within its kind
  updates it in place; another kind replaces it.
- **Motion without Messages:** `rotation: spin(...)`, `behaviour: behave('float')`,
  `transition: ease(...)` for eased moves. Reduced motion freezes them.
  `rotation: billboard({ lockX, lockY, lockZ })` faces the camera every frame.
- **Lines:** `line({ key, points, width, worldUnits, dashed, dashSize, gapSize,
vertexColors, segments })`, drawn by the render kit (empty without one); curves through
  `catmullRomPoints(points, { segments })`, `cubicBezierPoints` and
  `quadraticBezierPoints`. `mesh({ edges: edges({ color, width, threshold }) })`
  outlines hard edges (never picked); `trail({ width, length, taper, fade })` on a group
  or mesh leaves a ribbon behind it, recorded in scene time.
- **Transform gizmo:** keep `TransformGizmo.Model` (from the Foldkit adapter) and the
  object placements in your Model; add `TransformGizmo.nodes(model.gizmo, placement,
camera)` to the scene; on a pointer down whose key `TransformGizmo.handleOf` names,
  send `Pressed` with the ray, the placement and the camera; send `Dragged` for drag
  rays and `Released` at the end; apply the `Moved` OutMessage's placement and record
  history on `Finished`. Don't orbit while `TransformGizmo.held`. For several selected
  things, place the rest with `movedAlike(firstBefore, placement, otherBefore)`.
- **Box select:** keep `BoxSelect.Model` in your Model; for a `Drag` gesture
  `BoxSelect.claims`, send `BoxSelect.dragOf(gesture)` instead of orbiting; on
  `onGestureEnd` send `Ended` with the camera and `{ key, at }` for each selectable
  thing, and take `Selected { keys }` as the new selection. `BoxSelect.rectangle` places
  an HTML outline over the canvas; `BoxSelect.inside` marks what the box holds so far.
- **Pivot controls:** as the transform gizmo, with `PivotControls`: send `Pressed` with
  the handle, the hit `point` and the placement; `Dragged` with the ray and `snap`;
  `Released`. Every handle shows at once, sized in scene units (`scale`).
- **Measuring tape:** keep `MeasuringTape.Model`; send `Placed` with a click's hit
  `point` (make the floor `interactive` while measuring), `Pointed` from pointer moves
  (`null` on leave), and `Cleared`; add `MeasuringTape.nodes(model.tape)` to the scene
  and `MeasuringTape.label(model.tape, h)` to the view's `overlays`. A click that ends
  an orbit drag is still a click: skip it if the camera moved since the press.
- **Viewport gizmo:** keep `ViewportGizmo.Model` in your Model and put
  `ViewportGizmo.hud(model.view, model.camera)` in `scene({ hud })`; send `Entered` and
  `Left` from pointer enter and leave, and `Pressed` with the hit key and the camera from
  pointer down; keep `Turned { camera }`. Give the camera `damping` to ease round. A
  `hud` takes any nodes (Drei's `Hud`); keys stay distinct from the scene's.
- **Points:** `points({ key, positions, colors, sizes, size, round })`, `sparkles({ key,
count, spread, size, color, seed })` and `stars({ key, radius, depth, count, fade, seed
})`, drawn by the render kit; sparkles and stars move in scene time (frozen under
  reduced motion) and scatter the same way for the same `seed`.
- **Drei helpers as data:** `roundedBox()` and `backdrop()` shapes; levels of detail with
  `group({ detail: detailed({ distances, hysteresis }), children: [near, mid, far] })`
  (hidden levels are not picked); `perspectiveCamera({ shake: cameraShake({ decay:
true, trigger }) })` shakes once per `trigger` (seeded, pure in scene time, still under
  reduced motion); `borrowed` under several keys clones the model (skinned ones with
  bones of their own), with `castShadow`/`receiveShadow` for every mesh.
- **Staging:** `environment()` lighting, `sky()`, `contactShadows()`,
  `renderSettings({ effects: [bloom(), vignette(), film()] })`, `views` for several
  cameras, `renderTextures` for scenes drawn onto materials, `hud` for nodes drawn over
  the scene, `overlays` for Model HTML pinned to points.

## Events and controls

Hits carry the mesh `key` (and `instance`), the world point, distance, normal, uv
and the ancestor `path`. A press captures the pointer: `onDrag` keeps reporting with a
world `ray`; `pointOnPlane(ray, plane)` turns it into a dragged position.

With `scene({ gestures: 'scene' })` the canvas claims drags, the wheel and pinches.
Each arrives as a `Gesture`; `orbit(model.camera, gesture, options)` returns the next
camera, following three's `OrbitControls`. A camera's `damping` eases the drawn camera
there; `autoRotate` turns it by itself, and before the next gesture `onAutoRotated`
says where it got to: keep it with `autoRotated(model.camera, detail)` before orbiting.
`fitCamera` and `scene({ measure: [keys] })` (`onMeasured`) frame what is there.

## Engines and assets

Create one environment per page and pass engines once:

```ts
const environment = EffectThreeFoldkit.makeEnvironment(window, {
  physics: loadRapier(), // scenes wait for its WebAssembly
  labels: troikaLabels(),
});
```

- **Physics:** `physics({ gravity, joints, debug })` on the scene and `body({ type,
mass, collider, colliders, collisionGroups, ... })` on meshes, groups, borrowed models
  and instances. Joints (`joint` with `fixedJoint`, `sphericalJoint`, `revoluteJoint`,
  `prismaticJoint`, `ropeJoint`, `springJoint`, and motors) are data; collisions and
  contact forces arrive as `onCollision` and `onContactForce`. A body's pose is the
  simulation's; change its position in the Model to teleport it.
- **Labels:** `label({ key, text, font, fontSize, maxWidth, outlineWidth,
colorRanges, curveRadius, material })`. Give each a font URL (TTF, OTF or WOFF;
  troika cannot read WOFF2). A label named in `measure` reports its laid-out size as
  `onLabelMeasured`.
- **Assets:** `environment.assets.loadModel`, `loadTexture`, `loadFont` and
  `loadEnvironment` are Effects for Commands; settle them into the Model and refer to
  the id. Loading an id again replaces and frees the old asset; `unload(id)` frees it.

## Renderers

`webglRendererFactory` is the default. `webgpuRendererFactory` uses three's
`WebGPURenderer` (real WebGPU, or its WebGL 2 backend); WebXR on it is untested. Labels
draw under it with `troikaLabels` from `@opsydyn/effect-three-troika/webgpu`, which
draws with either renderer; the root entry's draws only with WebGL. Pass the factory as `makeEnvironment(window, { renderer })`.

## Agents

Export `devTools = { Message }` beside `init`, `update` and `view` (an astro-foldkit
island passes the module to `makeApplication`) and, in development, the Foldkit DevTools
MCP server (`@foldkit/devtools-mcp`) can read the Model and dispatch Messages, each
decoded against the schema first. Give agents intent-level Messages with closed choices
(`PlacedPlant { at, kind }`, `kind` a `Schema.Literals`) rather than raw pointer events,
clamp what they place in `update`, and keep high-frequency Messages out of history with
`excludeFromHistory`. The XR room sample does this. With several pages or dev servers
open, pass `runtime_id` from `foldkit_list_runtimes` on each tool call, and set
`FOLDKIT_PROJECT_ROOT` to the app's directory so the server joins that app's relay.

## Immersive sessions

`scene({ xr: xr({ origin, heading, glide, hitTest, anchors, planes, meshes }) })`
makes a scene presentable; `environment.xr.enter('immersive-vr' | 'immersive-ar')`
from a click's Command starts the session. Controllers and hands point, click and
drag like a mouse; sticks and buttons arrive as `onXRStick` and `onXRButton`. Keep the
player's place in the Model: `locomote` and `teleport` change `xr`, and gliding reports
`onXRMoved` (`glided(model.xr, detail)`). `group({ follow: headSpace() })` and the
other spaces (`jointSpace`, `controllerSpace`, `anchorSpace`, `planeSpace`,
`meshSpace`) ride tracked things without a Message per frame.
