import { expect, test } from 'bun:test';

import { noModifiers, perspectiveCamera } from '@opsydyn/effect-three';

import { BoxSelect } from '../src/index.ts';

const camera = perspectiveCamera({ position: [0, 0, 10], lookAt: [0, 0, 0] });
const selectable = [
  { key: 'left', at: [-2, 0, 0] as const },
  { key: 'middle', at: [0, 0, 0] as const },
  { key: 'right', at: [2, 0, 0] as const },
];

/** A shift-drag pressed at the middle of an 800 × 600 canvas, moved by `(dx, dy)`. */
const drag = (
  deltaX: number,
  deltaY: number,
  overrides: Partial<BoxSelect.DragGesture> = {},
): BoxSelect.DragGesture => ({
  _tag: 'Drag',
  button: 0,
  modifiers: { ...noModifiers, shift: true },
  width: 800,
  height: 600,
  x: 0,
  y: 0,
  deltaX,
  deltaY,
  ...overrides,
});

/** The box after drags of `moves`, each claimed. */
const drawn = (moves: ReadonlyArray<BoxSelect.DragGesture>) =>
  moves.reduce(
    (model, move) => BoxSelect.update(model, BoxSelect.dragOf(move)).model,
    BoxSelect.init(),
  );

test('a shift-drag on nothing is claimed; a plain one, or one on a mesh, is not', () => {
  const start = BoxSelect.init();
  expect(BoxSelect.claims(start, drag(10, 10))).toBe(true);
  expect(BoxSelect.claims(start, drag(10, 10, { modifiers: noModifiers }))).toBe(false);
  expect(BoxSelect.claims(start, drag(10, 10, { key: 'middle' }))).toBe(false);
  // Once drawing, every drag moves the box, even after shift is let go.
  const drawing = drawn([drag(10, 10)]);
  expect(BoxSelect.claims(drawing, drag(10, 10, { modifiers: noModifiers }))).toBe(true);
});

test('drags grow the box from the press, placed in CSS pixels', () => {
  const model = drawn([drag(100, 50), drag(60, 25)]);
  expect(BoxSelect.drawing(model)).toBe(true);
  expect(BoxSelect.rectangle(model)).toMatchObject({
    _tag: 'Some',
    value: { left: 400, top: 300, width: 160, height: 75 },
  });
});

test('the box holds what it covers, and its release selects that and clears it', () => {
  // Pressed just below left of the middle, then 360 pixels right and 50 up: the middle
  // and the right, not the left.
  const model = drawn([drag(360, 50, { x: -0.1, y: -0.1 }), drag(0, -100)]);
  expect(BoxSelect.inside(model, camera, selectable)).toEqual(['middle', 'right']);
  const ended = BoxSelect.update(model, BoxSelect.Message.Ended({ camera, selectable }));
  expect(ended.outMessage).toMatchObject({ _tag: 'Selected', keys: ['middle', 'right'] });
  expect(BoxSelect.drawing(ended.model)).toBe(false);
});

test('an end with no box, or a cancel, selects nothing', () => {
  const none = BoxSelect.update(BoxSelect.init(), BoxSelect.Message.Ended({ camera, selectable }));
  expect(none.outMessage).toBeUndefined();
  const cancelled = BoxSelect.update(drawn([drag(10, 10)]), BoxSelect.Message.Cancelled());
  expect(BoxSelect.drawing(cancelled.model)).toBe(false);
  expect(cancelled.outMessage).toBeUndefined();
  expect(BoxSelect.inside(cancelled.model, camera, selectable)).toEqual([]);
});
