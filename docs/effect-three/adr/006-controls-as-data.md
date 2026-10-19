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
- Since added: view cameras damp as the scene's camera does, each on its own.
- Since added (2026-10-19): the transform gizmo, the same way. three's
  `TransformControls` listen to the canvas and move the object; here `gizmoNodes`
  describes the handles from the Model, `pressGizmo` takes hold with the press ray and
  the camera, and `dragGizmo` returns the next placement for each drag ray, following
  three's maths (the drag plane, offsets, snaps, rotation speed) to six decimal places.
  The adapter's `TransformGizmo` submodel reports `Moved` and `Finished` OutMessages;
  the parent keeps the placements, so undo is a list. Evidence: `test/gizmo.test.ts`
  (three's controls as the oracle), the adapter's `transformGizmo.test.ts`, the arrange
  sample.
- Since added (2026-10-19): box select, the same way. three's `SelectionBox` walks the
  scene for meshes inside a frustum; here `boxSelect(camera, size, from, to,
selectable)` takes the candidates from the Model and returns their keys, matching
  three's side planes (and keeping to the camera's near and far, where three's box does
  not). A `GestureEnd` scene event ends a gesture that moved, so a drag on nothing can
  finish what it drew. The adapter's `BoxSelect` submodel claims shift-drags, reports
  `Selected { keys }`, and places its outline in CSS pixels; `movedAlike` moves the rest
  of a selection as the gizmo moved the first. Evidence: `test/boxSelect.test.ts`
  (three's box as the oracle), `test/gestures.test.ts`, the adapter's
  `boxSelect.test.ts`, the arrange sample.
- Since added: `autoRotate` on a camera, after `OrbitControls.autoRotate` (`rotateLeft` by
  `2π / 60 * autoRotateSpeed` a second, only while no gesture is in progress). The
  rendered camera turns round its target in scene time, holding still while a gesture is
  pressed. Before a gesture on a camera that has turned, the scene reports `AutoRotated
{ view?, position }`; `autoRotated(camera, detail)` keeps it, so the gesture goes on
  from where the camera was shown, as gliding reports `XrMoved`. A new position or
  `lookAt` turns on from there; a lens change keeps the turn. A turning camera's pose
  depends on how long it has gone undescribed, so the convergence property describes
  still cameras and `autoRotate.test.ts` covers turning.
