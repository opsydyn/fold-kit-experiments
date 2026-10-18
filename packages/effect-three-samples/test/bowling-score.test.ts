import { expect, test } from 'bun:test';

import { finished, frames, freshRack, marks, score } from '../src/bowling/score';

test('open frames add up; spares and strikes take their bonus rolls', () => {
  expect(score([3, 4, 5, 2])).toBe(14);
  // A spare (7/) then 4: 10 + 4, then 4 + 0.
  expect(score([7, 3, 4, 0])).toBe(18);
  // A strike then 3, 4: 10 + 7, then 7.
  expect(score([10, 3, 4])).toBe(24);
  // Bonuses not rolled yet leave the frame uncounted.
  expect(frames([10, 3]).map((frame) => frame.total)).toEqual([null, null]);
  expect(score([10, 3])).toBe(0);
});

test('a perfect game is 300, twelve strikes; all nines and misses is 90', () => {
  expect(score(Array(12).fill(10))).toBe(300);
  expect(finished(Array(12).fill(10))).toBe(true);
  expect(finished(Array(11).fill(10))).toBe(false);
  const nines = Array.from({ length: 10 }, () => [9, 0]).flat();
  expect(score(nines)).toBe(90);
  expect(finished(nines)).toBe(true);
});

test('the tenth frame: an open frame ends it; a spare or strike brings bonus rolls', () => {
  const nine = Array(18).fill(0);
  expect(finished([...nine, 3, 4])).toBe(true);
  expect(finished([...nine, 7, 3])).toBe(false);
  expect(score([...nine, 7, 3, 5])).toBe(15);
  expect(score([...nine, 10, 10, 10])).toBe(30);
});

test('a fresh rack comes each frame, and in the tenth after a strike or spare', () => {
  expect(freshRack([])).toBe(true);
  expect(freshRack([3])).toBe(false);
  expect(freshRack([3, 4])).toBe(true);
  expect(freshRack([10])).toBe(true);
  const nine = Array(18).fill(0);
  expect(freshRack([...nine, 10])).toBe(true);
  expect(freshRack([...nine, 10, 4])).toBe(false);
  expect(freshRack([...nine, 6, 4])).toBe(true);
  expect(freshRack([...nine, 6])).toBe(false);
});

test('a scoresheet marks strikes, spares and misses', () => {
  const [strike, spare, open, tenth] = frames([
    10,
    7,
    3,
    0,
    5,
    ...Array(12).fill(0),
    10,
    6,
    4,
  ]).filter((_, index) => [0, 1, 2, 9].includes(index));
  expect([strike, spare, open, tenth].map((frame) => frame && marks(frame))).toEqual([
    'X',
    '7 /',
    '- 5',
    'X 6 /',
  ]);
});
