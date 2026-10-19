import { expect, mock, test } from 'bun:test';

import { createPose } from '@opsydyn/effect-three';
import { Option } from 'effect';

// The view uses the page's environment; the update logic and scene under test never do.
await mock.module('../src/curves/environment', () => ({
  environment: {},
  sceneMount: () => undefined,
}));
const { Message } = await import('../src/curves/message');
const { init, startControls } = await import('../src/curves/model');
const { handleKey, update } = await import('../src/curves/update');
const { sceneFor } = await import('../src/curves/scene');
const { ride } = await import('../src/curves/ride');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;

/** A ray from the camera straight down -z through `(x, y)`. */
const towards = (x: number, y: number) => ({
  origin: [x, y, 9] as const,
  direction: [0, 0, -1] as const,
});

test('dragging a handle moves its control point in the stage, kept on it', () => {
  const held = step(start, Message.PressedHandle({ key: handleKey(2), ...towards(0, -0.5) }));
  expect(held.held).toEqual(Option.some(2));
  const moved = step(held, Message.DraggedHandle({ key: handleKey(2), ...towards(1, 2) }));
  expect(moved.controls[2]).toEqual([1, 2, 0]);
  const far = step(held, Message.DraggedHandle({ key: handleKey(2), ...towards(9, -9) }));
  expect(far.controls[2]).toEqual([4, -2.4, 0]);
  const dropped = step(moved, Message.DroppedHandle());
  expect(dropped.held).toEqual(Option.none());
  expect(step(dropped, Message.ClickedReset()).controls).toEqual(startControls);
});

test('the scene draws the curve, its polygon, a swing, five handles with edges and the comet', () => {
  const keys = sceneFor(start).children.map((child) => child.key);
  expect(keys).toEqual([
    'stars',
    'curve',
    'polygon',
    'swing',
    ...startControls.map((_, index) => handleKey(index)),
    'comet',
  ]);
  const dashed = sceneFor(step(start, Message.ClickedDashes())).children[1];
  expect(dashed?._tag === 'Line' && dashed.dashed).toBe(true);
});

test('the comet rides the curve through its handles, round once a lap', () => {
  const params = Object.fromEntries([
    ['lap', 8],
    ...startControls.flatMap(([x, y], index) => [
      [`x${index}`, x],
      [`y${index}`, y],
    ]),
  ]);
  const at = (seconds: number) => {
    const pose = createPose();
    ride(pose, seconds, params);
    return pose.offset.toArray();
  };
  // It starts at the first handle and is back there a lap later.
  expect(at(0)[0]).toBeCloseTo(-3, 5);
  expect(at(0)[1]).toBeCloseTo(-0.4, 5);
  expect(at(8)[0]).toBeCloseTo(-3, 5);
  expect(at(2)).not.toEqual(at(0));
});
