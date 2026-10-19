# Drei catalogue audit

Drei at `bf6f4ad` (`drei-main/src/core`, `drei-main/src/web`), against effect-three 0.1.0,
2026-10-18. Each component is one of:

- **✅ covered**: effect-three has it, by the API named;
- **🔁 a Model pattern**: no API needed, because the Model already does it (the pattern named);
- **📋 candidate**: worth adding to the typed catalogue, sized S, M or L;
- **— out of scope**: specialised, React-specific, or against the closed, Model-driven
  catalogue (reasons given).

## Covered (✅)

| Drei                                      | effect-three                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `OrbitControls`, `MapControls`            | `orbit` (with `orbitOptions`, `screenSpacePanning`), damping, `autoRotate`  |
| `CameraControls` (smooth moves)           | camera `damping` eases any Model change                                     |
| `PerspectiveCamera`, `OrthographicCamera` | `perspectiveCamera`, `orthographicCamera`                                   |
| `Bounds`, `useAspect`, `Resize` (framing) | `scene({ measure })`, `fitCamera`, `clipCamera`, `centerOffset`             |
| `Center`                                  | `centerOffset` on a measured box                                            |
| `Float`                                   | `behave('float')`                                                           |
| `Instances`                               | `instances`, diffed per instance key                                        |
| `Gltf`/`useGLTF`, `useAnimations`         | `environment.assets.loadModel`, `borrowed({ animation: play(…) })`          |
| `Texture`/`useTexture`                    | `environment.assets.loadTexture`, `map: id`                                 |
| `Environment`, `useEnvironment`           | `environment()`, presets via `environmentPresetUrl`, `loadEnvironment`      |
| `ContactShadows`, `Sky`, `Grid`, `Stage`  | `contactShadows()`, `sky()`, `shaderGrid()`, `stage()`                      |
| `Text`, `Text3D`, `useFont`               | `label()` (troika), `text()`, `loadFont`                                    |
| `RenderTexture`, `Fbo`                    | `renderTextures`                                                            |
| `View`, `Hud` (another camera on top)     | `views`                                                                     |
| `Html`                                    | `overlays`                                                                  |
| `Effects`                                 | `renderSettings({ effects: [bloom(), vignette(), film()] })`                |
| `PerformanceMonitor`, `AdaptiveDpr`       | `PerformanceChanged`, `renderSettings({ resolution })`                      |
| `web/DragControls`                        | `Drag`/`DragEnd` with pointer capture, `pointOnPlane`                       |
| shapes (`Box`, `Sphere`, `Plane`, …)      | the nine shape builders                                                     |
| `Wireframe` (plain)                       | any material's `wireframe`                                                  |
| `SpotLight` (plain)                       | `spotLight` (not the volumetric cone: see candidates)                       |
| `Billboard`                               | `rotation: billboard({ lockX, lockY, lockZ })`                              |
| `RoundedBox`, `Backdrop`                  | `roundedBox()`, `backdrop()` shapes, with Drei's defaults                   |
| `Detailed`                                | `group({ detail: detailed({ distances, hysteresis }) })`                    |
| `CameraShake`                             | a camera's `shake: cameraShake({ intensity, decay, … })`                    |
| `Clone`                                   | `borrowed` shown under several keys (skinned models get their own bones)    |
| `Line`, `Segments`                        | `line({ points, width, dashed, vertexColors, segments })`, drawn by the kit |
| `CatmullRomLine`, `*BezierLine`           | `catmullRomPoints`, `cubicBezierPoints`, `quadraticBezierPoints` for `line` |

## A Model pattern (🔁)

| Drei                                     | The pattern                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `useCursor`                              | hover in the Model; the scene element's `className` sets the cursor |
| `web/KeyboardControls`                   | Foldkit key subscriptions as Messages; `orbitKey` for the camera    |
| `web/Select`, `web/CycleRaycast`         | selection in the Model from click and hover Messages                |
| `Preload`, `Progress`, `web/Loader`      | `AsyncData` in the Model while asset Commands run                   |
| `Stats`, `StatsGl`                       | `PerformanceChanged`; `onReconciled` for what each update did       |
| `BBAnchor`                               | `overlays` at a point from a `measure`d box                         |
| `VideoTexture`, `web/WebcamVideoTexture` | lend a three `VideoTexture` with `store.lendTexture`                |
| `Image`                                  | a plane with a lent or loaded `map`                                 |
| `useIntersect` (the canvas)              | scenes already pause when off screen                                |

## Candidates (📋)

| Drei                                                        | Size | Notes                                                                  |
| ----------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `Points`, `PointMaterial`                                   | M    | A `points` node, instanced like `instances`                            |
| `Sparkles`, `Stars`, `Cloud`                                | M    | Built on `points` (Sparkles, Stars) and instanced sprites (Cloud)      |
| `Edges`, `Outlines`                                         | S–M  | Edges geometry from a mesh; inverted-hull outlines (a render-kit part) |
| `Decal`                                                     | M    | A projected geometry on a target mesh, by key                          |
| `Lightformer`                                               | M    | Environments made from emissive shapes, rendered to an environment map |
| `FlyControls`, `FirstPersonControls`, `PointerLockControls` | S–M  | Pure functions from gestures and keys, as `orbit` is                   |
| `web/PresentationControls`, `web/ScrollControls`            | S–M  | Gesture- and scroll-driven Model updates                               |
| `MotionPathControls`                                        | M    | A camera or node behaviour along a curve                               |
| `TransformControls`, `web/pivotControls`, `Gizmo*`          | M    | Foldkit submodels with OutMessages ("Beyond parity", 5)                |
| `Trail`                                                     | M    | A line that follows a node, in scene time                              |
| `CubeCamera`                                                | M    | Dynamic reflections: a render texture into a cube map                  |
| `meshBounds`, `Bvh`                                         | S–M  | Cheaper or accelerated picking for large meshes                        |
| `GradientTexture`, `MatcapTexture`, `Ktx2`                  | S    | Generated and compressed textures; a matcap material kind              |
| `SpotLight` (volumetric), `Mask`                            | M    | Render-kit parts                                                       |

## Out of scope (—)

| Drei                                                                                                | Why                                                                                            |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `shaderMaterial`, `MeshDistortMaterial`, `MeshWobbleMaterial`, `MeshDiscardMaterial`                | Arbitrary shaders: the catalogue is closed and renderer-neutral (ADR-003)                      |
| `MeshTransmissionMaterial`, `MeshReflectorMaterial`, `MeshRefractionMaterial`, `MeshPortalMaterial` | WebGL shader effects; reconsider per renderer kit, after TSL parity                            |
| `AccumulativeShadows`, `softShadows`, `Caustics`, `BakeShadows`                                     | Shader-patching shadow techniques; `shadows: 'soft'` and contact shadows cover the common case |
| `MarchingCubes`, `Splat`, `Sampler`, `ComputedAttribute`, `CurveModifier`, `Svg`                    | Specialised geometry pipelines                                                                 |
| `PositionalAudio`                                                                                   | Audio belongs to the application, not the scene graph                                          |
| `ScreenQuad`, `ScreenSpace`, `ScreenSizer`, `Fisheye`, `AsciiRenderer`                              | Specialised rendering                                                                          |
| `SpriteAnimator`, `useSpriteLoader`, `Fbx`, `DetectGPU`, `Helper`, `MultiMaterial`                  | Niche, or application-level                                                                    |
| `web/FaceControls`, `web/FaceLandmarker`, `web/Facemesh`, `DeviceOrientationControls`               | Device and vision input: an application's own subscriptions                                    |
| `useContextBridge`, `useCamera`, `useDepthBuffer`, `useBoxProjectedEnv`, `AdaptiveEvents`           | React-specific, or internal to effects not taken                                               |

## Recommendation

Done (2026-10-19): `Billboard`, `RoundedBox` and `Backdrop`, `Detailed`, `CameraShake`
and `Clone`, the S candidates; then `line` with its curves. Next: `points` (with
`Sparkles` and `Stars`, M); `Trail` (a line that follows a node, which needs the node's
recent path, not only scene time); then transform gizmos as submodels, which the scene
editor in "Beyond parity" needs.
