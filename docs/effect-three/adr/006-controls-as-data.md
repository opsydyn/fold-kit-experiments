# ADR-006: Camera controls are gestures in, cameras out

- Status: Accepted (2026-10-16).
- Evidence: `packages/effect-three/src/kernel/orbit.ts`, `cameraMotion.ts`, `pointer.ts`;
  `test/orbit.test.ts` (checked against three.js's `OrbitControls`), the adapter's
  browser test of orbiting and page scrolling.
- References: three.js `examples/jsm/controls/OrbitControls.js` at 0.186.1; Drei
  `src/core/OrbitControls.tsx` at `bf6f4ad`.

## Context

In React Three Fiber, Drei's `<OrbitControls>` wraps three.js's `OrbitControls`. The
controls listen to the canvas themselves, keep their own state (target, spherical deltas,
damping), and mutate the camera every frame. The application learns of changes through an
`onChange` callback, if at all.

Here the camera is part of the scene description, derived from the Model. Controls that
mutated the host camera would leave the Model out of date: time travel, undo, persistence
and tests would no longer see where the camera is.

## Decision

- **The scene decides who owns gestures.** `scene({ gestures: 'scene' })` claims them,
  as connecting `OrbitControls` does: the wheel no longer scrolls the page, `touch-action`
  is `none`, every press captures the pointer and the context menu stays shut. The default,
  `'page'`, leaves all of these with the page.
- **The kernel reports gestures, not camera moves.** While claimed, every drag, wheel and
  two-pointer pinch on the canvas becomes a `Gesture` event: pixel deltas, the press's
  button and modifiers, the area's size, the view it began in, and the mesh it began on.
  Line and page wheel deltas are converted to pixels as three's controls convert them.
- **Orbiting is a pure function.** `orbit(camera, gesture, options)` returns the next
  `Camera`, following `OrbitControls` step by step: button mapping and modifier swaps,
  rotate, dolly and pan maths, polar, azimuth, distance and zoom limits. The camera's
  `lookAt` is the target, so the Model holds nothing but the camera. `rotateCamera`,
  `dollyCamera` and `panCamera` are exported for keys and buttons.
- **Damping belongs to the camera.** `damping` on a camera eases the rendered camera
  towards its description round the target, in scene time, as `enableDamping` does
  per update. The Model always holds where the camera is going.
- **The Model decides when controls apply.** A gesture that began on a mesh says so
  (`key`), and one over a view names it (`view`); the application ignores what it should,
  as an R3F app disables controls while dragging an object.

## Consequences

- Every camera move is a Message: DevTools replay it, and a test can drive the camera
  without a browser. `orbit` is checked against three's own controls, driven through the
  same mouse and wheel handlers, to six decimal places.
- A gesture that starts on an interactive mesh also orbits unless the application ignores
  it, as in R3F without `stopPropagation`.
- Since added: zoom to cursor (gestures carry where they happened; a middle-drag aims at
  its press point, where three 0.186 has a typo), `orbitKey` for the arrow keys (an app
  maps focused key presses to Messages), and Drei's `Bounds` as measuring events plus
  `fitCamera` and `clipCamera`.
- Not yet: auto-rotate, and damping for view cameras, which still jump.
