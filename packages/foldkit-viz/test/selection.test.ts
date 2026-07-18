import { describe, expect, it } from 'bun:test';

import {
  clampSelection,
  intervalSelection,
  keySelection,
  SELECTION_NONE,
  selectionContainsKey,
  selectionContainsValue,
} from '../src/interaction/selection';

describe('selection contract', () => {
  it('normalises an interval and clears an empty range', () => {
    expect(intervalSelection('x', [300, 100])).toEqual({
      _tag: 'Interval',
      axis: 'x',
      domain: [100, 300],
    });
    expect(intervalSelection('x', [100, 100])).toBe(SELECTION_NONE);
  });

  it('clamps an interval and clears one collapsed by bounds', () => {
    expect(clampSelection(intervalSelection('x', [50, 300]), [100, 200])).toEqual({
      _tag: 'Interval',
      axis: 'x',
      domain: [100, 200],
    });
    expect(clampSelection(intervalSelection('x', [10, 20]), [100, 200])).toBe(SELECTION_NONE);
  });

  it('matches values only on the selected axis', () => {
    const selection = intervalSelection('x', [100, 200]);
    expect(selectionContainsValue(selection, 'x', 150)).toBe(true);
    expect(selectionContainsValue(selection, 'y', 150)).toBe(false);
  });

  it('deduplicates keys and clears an empty key selection', () => {
    const selection = keySelection(['slow', 'slow', 'error']);
    expect(selectionContainsKey(selection, 'slow')).toBe(true);
    expect(selectionContainsKey(selection, 'missing')).toBe(false);
    expect(keySelection([])).toBe(SELECTION_NONE);
  });
});
