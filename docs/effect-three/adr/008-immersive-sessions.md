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
- **Controllers speak the pointer vocabulary.** A controller's select becomes
  `PointerDown`, `PointerUp` and `Click` on what its ray hits (`pickRay`), or
  `PointerMissed`, as @react-three/xr's pointers do. `onXRSession` reports sessions starting
  and ending, whoever ends them.

## Consequences

- An app keeps "can present / entering / presenting" in its Model, offers the button only
  when supported, and learns of the end even when the user leaves through the headset.
- Tests run real sessions headlessly with IWER (a test-only dependency). iwer 2.5.0 loses
  offset reference spaces (it treats the `XRRigidTransform` as a matrix), so the test page
  shims that one emulator method.
- Not yet: AR features (hit testing, anchors, planes, DOM overlay), hand-tracking joints as
  data, controller hover and drag, teleport and locomotion helpers.
