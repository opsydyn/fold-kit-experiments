import { expect, test } from 'bun:test';

import type { Placement } from '@opsydyn/effect-three';

import { PivotControls } from '../src/index.ts';

const crate: Placement = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
/** A ray from straight above, down onto `(x, z)`. */
const down = (x: number, z: number) => ({
  origin: [x, 10, z] as const,
  direction: [0, -1, 0] as const,
});

/** The controls after a press on the x arrow, halfway along it. */
const pressedX = () =>
  PivotControls.update(
    PivotControls.init('pivot'),
    PivotControls.Message.Pressed({ handle: 'arrow-x', point: [0.5, 0, 0], placement: crate }),
  );

test('a press takes hold, a drag reports Moved along the arrow, and a release Finished', () => {
  const pressed = pressedX();
  expect(PivotControls.held(pressed.model)).toBe(true);
  expect(pressed.outMessage).toBeUndefined();
  const moved = PivotControls.update(
    pressed.model,
    PivotControls.Message.Dragged({ ...down(1.75, 0.3), snap: false }),
  );
  expect(moved.outMessage?._tag).toBe('Moved');
  expect(moved.outMessage?.placement.position[0]).toBeCloseTo(1.25, 6);
  expect(moved.outMessage?.placement.position[2]).toBeCloseTo(0, 6);
  const released = PivotControls.update(moved.model, PivotControls.Message.Released());
  expect(released.outMessage).toMatchObject({ _tag: 'Finished' });
  expect(PivotControls.held(released.model)).toBe(false);
});

test('a release without a drag finishes nothing; hovering highlights; handles are named', () => {
  const start = PivotControls.init('pivot', { scale: 2 });
  expect(PivotControls.update(start, PivotControls.Message.Released()).outMessage).toBeUndefined();
  const over = PivotControls.update(start, PivotControls.Message.Hovered({ handle: 'rotator-y' }));
  expect(over.model.pivot.hovered).toBe('rotator-y');
  expect(PivotControls.handleOf(start, 'pivot:sphere-z')).toMatchObject({ value: 'sphere-z' });
  expect(PivotControls.handleOf(start, 'crate')).toMatchObject({ _tag: 'None' });
  expect(PivotControls.nodes(start, crate).key).toBe('pivot');
});
