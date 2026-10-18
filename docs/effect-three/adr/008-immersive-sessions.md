# ADR-008: Immersive sessions are Commands; the scene says where the player stands

- Status: Accepted (2026-10-17).
- Evidence: `packages/effect-three-foldkit/src/dom/xr.ts`, `dom/xrHub.ts`, `src/xr.ts`;
  `packages/effect-three/src/kernel/pointer.ts` (`pickRay`, `createSelectTracker`);
  `e2e/xr.test.ts` (a real WebXR session under Meta's IWER emulating a Quest 3).
- References: React Three Fiber `core/configuration.ts` and `core/loop.ts` at `d74622e`;
  pmndrs/xr at `0e1acd8` (`packages/xr/src/store.ts`, `init.ts`, `emulate.ts`).

## Context

`@react-three/xr` keeps a store with `enterVR()`/`enterAR()`, connects it to the renderer,
and places the player with `<XROrigin>`. React Three Fiber hands frame driving to the
session (`xr.setAnimationLoop`) while it presents. Controllers are pointers that hit-test
along their target rays and raise the usual pointer events.

Browsers start a session only from a user gesture, and a session is page-wide: one at a
time, presenting one renderer.

## Decision

- **A scene opts in with data.** `scene({ xr: xr({ origin, heading, referenceSpace,
framebufferScale }) })`. The kernel only holds it; its renderer contract stays free of
  WebXR.
- **Entering and leaving are Commands.** The Foldkit environment's `xr.supported(mode)`,
  `xr.enter(mode)` and `xr.exit` are Effects. `enter`, run from the Command a click
  produces, requests a session with the reference space required (pmndrs/xr's
  `buildXRSessionInit`) and presents the mounted scene that describes `xr`.
- **The session drives frames.** As React Three Fiber does: `xr.enabled`, the reference
  space type and framebuffer scale before `setSession`, then `xr.setAnimationLoop` draws
  every frame the session gives while the page's frames stand aside; when it ends the page
  draws again. Offscreen passes keep their own cameras; views and post-processing give way
  to the headset's views.
- **The origin is an offset reference space.** The player stands at `origin` facing
  `heading`, as three.js's teleport example offsets the space; a new origin moves them.
- **Controllers and hands speak the pointer vocabulary.** Every frame each input source's
  target ray is an `Aim`: what it points at gets `PointerEnter` and `PointerLeave` (per
  source). A select (trigger or pinch) becomes `PointerDown`, `PointerUp` and `Click` on
  what its ray hits (`pickRay`), or `PointerMissed`; held on a mesh it captures it, and
  once the ray has turned a degree or moved a centimetre it `Drag`s it until `DragEnd`, as
  @react-three/xr's pointers do (hands never hold still, and a select that does not move
  is a click). A source put down leaves, and ends its drag. `onXRSession` reports
  sessions starting and ending, whoever ends them.
- **Sticks and buttons are discrete events; locomotion is a function.** A thumbstick
  pushed past halfway (back under a third to centre) is an `XrStick`; `xr-standard`
  buttons pressed and released are `XrButton`s. `locomote(xr, stick)` is pmndrs/xr's
  controller locomotion as a step: the right stick snap-turns 45°, the left steps a metre
  along the facing; `teleport(xr, point)` stands the player there. The Model keeps `xr`.
- **AR shows the room.** A session whose environment blend mode is not opaque leaves
  any scene background out of its frames (three already clears to transparent). With
  `xr({ hitTest: true })` it asks for hit testing (optionally) and a select reports where
  its ray met a real surface as `XrSurface { point, normal }`: tap to place.
- **Inputs are drawn.** `xr({ showInputs })` (on by default) draws each source's ray and
  each tracked hand's 25 joints as spheres, as three's `XRHandPrimitiveModel`, in a group
  the kernel leaves alone; pmndrs/xr loads controller and hand models from a CDN instead.

## Consequences

- An app keeps "can present / entering / presenting" in its Model, offers the button only
  when supported, and learns of the end even when the user leaves through the headset.
- Tests run real sessions headlessly with IWER (a test-only dependency). iwer 2.5.0 loses
  offset reference spaces (it treats the `XRRigidTransform` as a matrix), so the test page
  shims that one emulator method.
- Tests drive controllers, sticks, a squeeze, tracked hands and their pinches, and an AR
  session whose hit tests a synthetic floor answers (IWER asks a "synthetic environment
  module" for them; the test page installs one that intersects y = 0).
- Gliding is the session's (`xr({ glide })`, after pmndrs/xr's controller locomotion: the
  left stick moves where the head faces, the right turns, smoothly or by snaps), so it
  needs no Message per frame; `XrMoved` reports where it stopped and `glided(xr, moved)`
  keeps that in the Model, which wins whenever it changes the origin itself. Not yet:
  anchors, planes and meshes, DOM overlay, and joint poses as data.
