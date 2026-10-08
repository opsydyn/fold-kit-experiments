import { Option } from 'effect';
import { expect, it } from 'vitest';

import { arrowKeyNav, nextIndex } from './keyboard';

it.each([
  [1, -1, 0, 0],
  [2, -1, 0, 1],
  [3, -1, 0, 2],
  [1, 0, 0, 0],
  [2, 0, 1, 1],
  [2, 1, 0, 0],
  [3, 0, 1, 2],
  [3, 1, 2, 0],
  [3, 2, 0, 1],
])('navigates %s items from %s in both directions', (count, current, forward, reverse) => {
  for (const [key, expected] of [
    ['ArrowRight', forward],
    ['ArrowDown', forward],
    ['ArrowLeft', reverse],
    ['ArrowUp', reverse],
  ] as const) {
    const actual = arrowKeyNav(key, (direction) => nextIndex(count, current, direction));
    expect(actual).toEqual(Option.some(expected));
  }
});
