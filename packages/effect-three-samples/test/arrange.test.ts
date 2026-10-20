import { expect, test } from 'bun:test';

import { History } from '@opsydyn/effect-three';

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
  const pressed = step(
    model,
    Message.PressedScene({ key: 'gizmo:x:tip', point: [x, 0.4, z], ...down(x, z) }),
  );
  const dragged = step(pressed, Message.DraggedScene(down(to, z)));
  return step(dragged, Message.ReleasedScene());
};

test('dragging the gizmo moves the selected thing, and each move can be undone and redone', () => {
  const moved = moveCrate(start, 0.5);
  expect(crateAt(moved)?.position[0]).toBeCloseTo(0.5, 5);
  expect(History.depth(moved.history)).toBe(1);
  const undone = step(moved, Message.ClickedUndo());
  expect(crateAt(undone)).toEqual(crateAt(start));
  const redone = step(undone, Message.ClickedRedo());
  expect(crateAt(redone)?.position[0]).toBeCloseTo(0.5, 5);
  // A new move after an undo starts a branch; the first move is still there to redo.
  const branched = moveCrate(undone, -1);
  expect(History.canRedo(branched.history)).toBe(false);
  const back = step(branched, Message.ClickedUndo());
  expect(crateAt(step(back, Message.ClickedRedo()))?.position[0]).toBeCloseTo(-1, 5);
  const other = step(back, Message.ClickedBranch());
  expect(crateAt(step(other, Message.ClickedRedo()))?.position[0]).toBeCloseTo(0.5, 5);
});

test('snapping rounds moves to quarter units', () => {
  const snapping = step(start, Message.ClickedSnapping());
  expect(crateAt(moveCrate(snapping, 0.62))?.position[0]).toBeCloseTo(0.5, 5);
});

test('a press off the gizmo moves nothing; clicks select things; the camera orbits only freely', () => {
  const pressed = step(
    start,
    Message.PressedScene({ key: 'ball', point: [0, 0.8, -0.8], ...down(0, -0.8) }),
  );
  expect(step(pressed, Message.DraggedScene(down(2, 0))).things).toEqual(startThings);
  expect(step(start, Message.ClickedThing({ key: 'cone', point: [0, 0, 0] })).selected).toEqual([
    'cone',
  ]);
  expect(step(start, Message.ClickedThing({ key: 'gizmo:x', point: [0, 0, 0] })).selected).toEqual(
    start.selected,
  );
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

test('a press on the viewport gizmo turns the camera to look along its axis', () => {
  const turned = step(
    start,
    Message.PressedScene({ key: 'view:-z:disc', point: [0, 0, 0], ...down(0, 0) }),
  );
  const [x = 0, , z = 0] = turned.camera.position;
  expect(x).toBeCloseTo(0, 9);
  expect(z).toBeLessThan(0);
  // Nothing on the table moved, and hovering a head highlights it.
  expect(turned.things).toEqual(start.things);
  expect(step(start, Message.HoveredScene({ key: 'view:y:disc' })).view.hovered).toBe('y');
  // Its head turns away from under the pointer: letting go there keeps the selection,
  // and the next click on nothing clears it.
  const letGo = step(turned, Message.ClickedNothing());
  expect(letGo.selected).toEqual(start.selected);
  expect(step(letGo, Message.ClickedNothing()).selected).toEqual([]);
});

test('the pivot controls move the selection too, and their drags are undone the same way', () => {
  const pivoting = step(start, Message.ClickedPivot());
  expect(pivoting.style).toBe('pivot');
  // The crate's x arrow, halfway along (0.45 of 0.9), dragged 1 unit further.
  const pressed = step(
    pivoting,
    Message.PressedScene({ key: 'pivot:arrow-x:stem', point: [-1.05, 0.4, 0], ...down(-1.05, 0) }),
  );
  // The transform gizmo's handles do nothing while the pivot is on.
  expect(
    step(pivoting, Message.PressedScene({ key: 'gizmo:x:tip', point: [0, 0, 0], ...down(0, 0) }))
      .before,
  ).toEqual(pivoting.before);
  const moved = step(step(pressed, Message.DraggedScene(down(-0.05, 0))), Message.ReleasedScene());
  expect(crateAt(moved)?.position[0]).toBeCloseTo(-0.5, 6);
  expect(crateAt(step(moved, Message.ClickedUndo()))).toEqual(crateAt(start));
});

test('measuring places a tape end at each click, runs it to the pointer, and skips orbits', () => {
  const measuring = step(start, Message.ClickedMeasure());
  const first = step(measuring, Message.ClickedThing({ key: 'table', point: [0, 0, 0] }));
  // Measuring clicks never select.
  expect(first.selected).toEqual(start.selected);
  expect(step(first, Message.MovedOver({ point: [0, 0, 2] })).tape.tape.pointer).toEqual([0, 0, 2]);
  // A drag across the table orbits; letting go on it places nothing.
  const pressed = step(
    first,
    Message.PressedScene({ key: 'table', point: [1, 0, 1], ...down(1, 1) }),
  );
  const free = {
    _tag: 'Drag' as const,
    button: 0,
    key: 'table',
    deltaX: 40,
    deltaY: 0,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    modifiers: { shift: false, control: false, alt: false, meta: false },
  };
  const orbited = step(pressed, Message.MadeGesture({ gesture: free }));
  expect(orbited.camera).not.toEqual(start.camera);
  expect(
    step(orbited, Message.ClickedThing({ key: 'table', point: [1, 0, 1] })).tape.tape.to,
  ).toBeNull();
  // A still click places the second end: three units.
  const still = step(
    orbited,
    Message.PressedScene({ key: 'crate', point: [3, 0, 0], ...down(3, 0) }),
  );
  const measured = step(still, Message.ClickedThing({ key: 'crate', point: [3, 0, 0] }));
  expect(measured.tape.tape.to).toEqual([3, 0, 0]);
  // Leaving measuring empties the tape.
  expect(step(measured, Message.ClickedMeasure()).tape.tape.from).toBeNull();
});
