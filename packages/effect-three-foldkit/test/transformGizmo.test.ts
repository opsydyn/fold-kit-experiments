import { expect, test } from 'bun:test';

import { type Placement, perspectiveCamera } from '@opsydyn/effect-three';

import { TransformGizmo } from '../src/index.ts';

const camera = perspectiveCamera({ position: [0, 0, 10], lookAt: [0, 0, 0] });
const crate: Placement = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const ray = (x: number) => ({ origin: [x, 0, 10] as const, direction: [0, 0, -1] as const });

/** The gizmo after a press on its x arrow over the crate's middle. */
const pressedX = () =>
  TransformGizmo.update(
    TransformGizmo.init('mover'),
    TransformGizmo.Message.Pressed({ handle: 'x', ...ray(0), placement: crate, camera }),
  );

/** The gizmo after that press and a drag to `x`. */
const draggedTo = (x: number) =>
  TransformGizmo.update(pressedX().model, TransformGizmo.Message.Dragged(ray(x)));

test('a press takes hold without reporting a move', () => {
  const pressed = pressedX();
  expect(TransformGizmo.held(pressed.model)).toBe(true);
  expect(pressed.outMessage).toBeUndefined();
});

test('a drag reports Moved with the placement along the held axis', () => {
  const moved = draggedTo(1.5).outMessage;
  expect(moved?._tag).toBe('Moved');
  expect(moved?.placement.position[0]).toBeCloseTo(1.5, 6);
  expect(moved?.placement.position[1]).toBeCloseTo(0, 6);
});

test('a release reports Finished where the drag ended, and lets go', () => {
  const released = TransformGizmo.update(draggedTo(1.5).model, TransformGizmo.Message.Released());
  expect(released.outMessage?._tag).toBe('Finished');
  expect(released.outMessage?.placement.position[0]).toBeCloseTo(1.5, 6);
  expect(TransformGizmo.held(released.model)).toBe(false);
});

test('a release without a drag finishes nothing', () => {
  const released = TransformGizmo.update(
    TransformGizmo.init('mover'),
    TransformGizmo.Message.Released(),
  );
  expect(released.outMessage).toBeUndefined();
});

test('hovering and choosing a mode change only the gizmo', () => {
  const start = TransformGizmo.init('mover');
  const hovered = TransformGizmo.update(start, TransformGizmo.Message.Hovered({ handle: 'y' }));
  expect(hovered.model.gizmo.hovered).toBe('y');
  const scaling = TransformGizmo.update(start, TransformGizmo.Message.ChoseMode({ mode: 'scale' }));
  expect(scaling.model.gizmo.mode).toBe('scale');
});

test('handles are named by key, and drawn under it', () => {
  const start = TransformGizmo.init('mover');
  expect(TransformGizmo.handleOf(start, 'mover:z')).toMatchObject({ _tag: 'Some', value: 'z' });
  expect(TransformGizmo.handleOf(start, 'crate')).toMatchObject({ _tag: 'None' });
  expect(TransformGizmo.nodes(start, crate, camera).key).toBe('mover');
});
