import { expect, test } from 'bun:test';

import {
  clearTape,
  createSceneGraph,
  placeTapeEnd,
  pointTape,
  scene,
  tape,
  tapeLength,
  tapeMiddle,
  tapeNodes,
} from '../src/kernel/index.ts';

test('two clicks place the ends and measure between them; a third starts again', () => {
  const first = placeTapeEnd(tape(), [0, 0, 0]);
  expect(tapeLength(first)).toBeUndefined();
  const measured = placeTapeEnd(first, [3, 4, 0]);
  expect(tapeLength(measured)).toBe(5);
  expect(tapeMiddle(measured)).toEqual([1.5, 2, 0]);
  const again = placeTapeEnd(measured, [1, 1, 1]);
  expect(again).toMatchObject({ from: [1, 1, 1], to: null });
  expect(clearTape(again)).toEqual(tape());
});

test('while the second end is placed, the tape runs to the pointer', () => {
  const first = placeTapeEnd(tape(), [0, 0, 0]);
  const pointing = pointTape(first, [0, 0, 2]);
  expect(tapeLength(pointing)).toBe(2);
  expect(tapeLength(pointTape(pointing, null))).toBeUndefined();
  // Before the first end, and once measured, the pointer changes nothing.
  expect(pointTape(tape(), [1, 0, 0])).toEqual(tape());
  const measured = placeTapeEnd(first, [1, 0, 0]);
  expect(pointTape(measured, [9, 9, 9])).toBe(measured);
});

test('a snapping tape rounds each end to its step', () => {
  const measured = placeTapeEnd(placeTapeEnd(tape({ snap: 0.5 }), [0.1, 0.2, 0.26]), [1.3, 0, 0]);
  expect(measured.from).toEqual([0, 0, 0.5]);
  expect(measured.to).toEqual([1.5, 0, 0]);
});

test('it draws a dashed line to the pointer, a solid one once measured, and is never picked', () => {
  const first = placeTapeEnd(tape(), [0, 0, 0]);
  const preview = tapeNodes('tape', pointTape(first, [1, 0, 0]));
  const measured = tapeNodes('tape', placeTapeEnd(first, [1, 0, 0]));
  const lineOf = (node: typeof preview) =>
    node._tag === 'Group' ? node.children.find((child) => child._tag === 'Line') : undefined;
  expect(lineOf(preview)).toMatchObject({
    dashed: true,
    points: [
      [0, 0, 0],
      [1, 0, 0],
    ],
  });
  expect(lineOf(measured)).toMatchObject({ dashed: false });
  const ends =
    measured._tag === 'Group' ? measured.children.filter((child) => child._tag === 'Mesh') : [];
  expect(ends).toHaveLength(2);
  const graph = createSceneGraph();
  expect(graph.reconcile(scene({ children: [measured] }))._tag).toBe('Applied');
  expect(graph.interactiveObjects()).toHaveLength(0);
});
