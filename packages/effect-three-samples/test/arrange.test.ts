import { expect, test } from 'bun:test';

import { Message } from '../src/arrange/message';
import { init, startThings } from '../src/arrange/model';
import { update } from '../src/arrange/update';

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;
const crateAt = (model: Model) => model.things.find((thing) => thing.key === 'crate')?.placement;

/** A ray from straight above, down onto `(x, z)`. */
const down = (x: number, z: number) => ({
  origin: [x, 10, z] as const,
  direction: [0, -1, 0] as const,
});

/** Drags the crate's x handle from its middle to x = `to`, and lets go. */
const moveCrate = (model: Model, to: number): Model => {
  const [x = 0, , z = 0] = crateAt(model)?.position ?? [];
  const pressed = step(model, Message.PressedScene({ key: 'gizmo:x:tip', ...down(x, z) }));
  const dragged = step(pressed, Message.DraggedScene(down(to, z)));
  return step(dragged, Message.ReleasedScene());
};

test('dragging the gizmo moves the selected thing, and each move can be undone and redone', () => {
  const moved = moveCrate(start, 0.5);
  expect(crateAt(moved)?.position[0]).toBeCloseTo(0.5, 5);
  expect(moved.past).toHaveLength(1);
  const undone = step(moved, Message.ClickedUndo());
  expect(crateAt(undone)).toEqual(crateAt(start));
  const redone = step(undone, Message.ClickedRedo());
  expect(crateAt(redone)?.position[0]).toBeCloseTo(0.5, 5);
  // A new move after an undo drops what could have been redone.
  expect(moveCrate(undone, -1).future).toEqual([]);
});

test('snapping rounds moves to quarter units', () => {
  const snapping = step(start, Message.ClickedSnapping());
  expect(crateAt(moveCrate(snapping, 0.62))?.position[0]).toBeCloseTo(0.5, 5);
});

test('a press off the gizmo moves nothing; clicks select things; the camera orbits only freely', () => {
  const pressed = step(start, Message.PressedScene({ key: 'ball', ...down(0, -0.8) }));
  expect(step(pressed, Message.DraggedScene(down(2, 0))).things).toEqual(startThings);
  expect(step(start, Message.ClickedThing({ key: 'cone' })).selected).toEqual(['cone']);
  expect(step(start, Message.ClickedThing({ key: 'gizmo:x' })).selected).toEqual(start.selected);
  const free = {
    _tag: 'Drag' as const,
    button: 0,
    deltaX: 40,
    deltaY: 0,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    modifiers: { shift: false, control: false, alt: false, meta: false },
  };
  const onCrate = { ...free, key: 'crate' };
  expect(step(start, Message.MadeGesture({ gesture: free })).camera).not.toEqual(start.camera);
  expect(step(start, Message.MadeGesture({ gesture: onCrate })).camera).toEqual(start.camera);
});

const shiftDrag = (deltaX: number, deltaY: number, x = 0, y = 0) => ({
  _tag: 'Drag' as const,
  button: 0,
  deltaX,
  deltaY,
  x,
  y,
  width: 800,
  height: 600,
  modifiers: { shift: true, control: false, alt: false, meta: false },
});

test('a shift-drag on nothing boxes things without orbiting; its release selects them', () => {
  // From the top left corner across the whole canvas: everything.
  const drawing = step(start, Message.MadeGesture({ gesture: shiftDrag(800, 600, -1, 1) }));
  expect(drawing.camera).toEqual(start.camera);
  const boxed = step(drawing, Message.EndedGesture());
  expect([...boxed.selected].toSorted()).toEqual(['ball', 'cone', 'crate', 'ring']);
  // A gesture end with no box changes nothing.
  expect(step(start, Message.EndedGesture()).selected).toEqual(start.selected);
});

test('the gizmo moves everything selected alike, and one undo puts them all back', () => {
  const both = { ...start, selected: ['crate', 'cone'] };
  const moved = moveCrate(both, 0.5);
  const coneAt = (model: Model) => model.things.find((thing) => thing.key === 'cone')?.placement;
  // The crate went from −1.5 to 0.5; the cone goes the same 2 units, from 1.5.
  expect(coneAt(moved)?.position[0]).toBeCloseTo(3.5, 5);
  expect(coneAt(step(moved, Message.ClickedUndo()))).toEqual(coneAt(start));
});
