import { expect, test } from 'bun:test';

import { History } from '../src/kernel/index.ts';

/** Records `values` one after another, each labelled with itself. */
const recorded = (start: History.History<string>, values: ReadonlyArray<string>) =>
  values.reduce((at, value) => History.record(at, value, value), start);

const abc = recorded(History.make('a'), ['b', 'c']);

test('undo and redo walk back and forward, and stop at the ends', () => {
  expect(History.present(abc)).toBe('c');
  expect(History.canRedo(abc)).toBe(false);
  const back = History.undo(History.undo(abc));
  expect(History.present(back)).toBe('a');
  expect(History.canUndo(back)).toBe(false);
  expect(History.undo(back)).toBe(back);
  expect(History.present(History.redo(History.redo(back)))).toBe('c');
  expect(History.depth(abc)).toBe(2);
});

test('recording after an undo starts a branch and keeps the old future', () => {
  const branched = History.record(History.undo(abc), 'x', 'x');
  expect(History.present(branched)).toBe('x');
  expect(branched.entries.map((entry) => entry.value)).toEqual(['a', 'b', 'c', 'x']);
  // Back at b, redo follows the branch last taken: x. The other is still there.
  const atB = History.undo(branched);
  expect(History.branches(atB).map((entry) => entry.value)).toEqual(['c', 'x']);
  expect(History.present(History.redo(atB))).toBe('x');
  const other = History.chooseBranch(atB, 2);
  expect(History.present(History.redo(other))).toBe('c');
  // Only a branch of the present can be chosen.
  expect(History.chooseBranch(atB, 0)).toBe(atB);
});

test('jumping to any entry makes the way back to it what redo follows', () => {
  const branched = History.record(History.undo(abc), 'x', 'x');
  const jumped = History.jumpTo(branched, 2);
  expect(History.present(jumped)).toBe('c');
  expect(History.pathTo(jumped, 2).map((entry) => entry.label)).toEqual(['Start', 'b', 'c']);
  const fromStart = History.undo(History.undo(jumped));
  expect(History.present(History.redo(History.redo(fromStart)))).toBe('c');
});
