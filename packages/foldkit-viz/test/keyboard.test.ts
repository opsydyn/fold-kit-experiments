import { describe, expect, it } from 'bun:test';

import { Option } from 'effect';

import { chartKeyDown, chartKeyDownFocus } from '../src/foldkit/keyboard';
import { chartCommandOf, targetAfter } from '../src/interaction/keyboard';
import type { ChartCommand } from '../src/interaction/keyboard';

const plain = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

describe('chart keyboard commands', () => {
  const keys: ReadonlyArray<readonly [string, ChartCommand]> = [
    ['ArrowRight', { _tag: 'Step', by: 1 }],
    ['ArrowDown', { _tag: 'Step', by: 1 }],
    ['ArrowLeft', { _tag: 'Step', by: -1 }],
    ['ArrowUp', { _tag: 'Step', by: -1 }],
    ['PageDown', { _tag: 'Step', by: 10 }],
    ['PageUp', { _tag: 'Step', by: -10 }],
    ['Home', { _tag: 'Jump', to: 'first' }],
    ['End', { _tag: 'Jump', to: 'last' }],
    ['Escape', { _tag: 'Clear' }],
    ['Enter', { _tag: 'Select' }],
    [' ', { _tag: 'Select' }],
  ];

  it.each(keys)('maps %p', (key, command) => {
    expect(chartCommandOf(key)).toEqual(command);
  });

  it('ignores other keys and leaves modified keys to the browser', () => {
    expect(chartCommandOf('x')).toBeUndefined();
    expect(chartCommandOf('ArrowRight', { ctrlKey: true })).toBeUndefined();
    expect(chartCommandOf('Home', { metaKey: true })).toBeUndefined();
    expect(chartCommandOf('ArrowRight', { shiftKey: true })).toEqual({ _tag: 'Step', by: 1 });
  });

  it('pages by the given size', () => {
    expect(chartCommandOf('PageDown', {}, { page: 4 })).toEqual({ _tag: 'Step', by: 4 });
  });
});

describe('targets after a command', () => {
  it('starts from the first going forward and the last going back', () => {
    expect(targetAfter(5, undefined, { _tag: 'Step', by: 1 })).toBe(0);
    expect(targetAfter(5, undefined, { _tag: 'Step', by: -1 })).toBe(4);
  });

  it('wraps single steps unless told not to, and stops pages at the ends', () => {
    expect(targetAfter(5, 4, { _tag: 'Step', by: 1 })).toBe(0);
    expect(targetAfter(5, 0, { _tag: 'Step', by: -1 })).toBe(4);
    expect(targetAfter(5, 4, { _tag: 'Step', by: 1 }, { wrap: false })).toBe(4);
    expect(targetAfter(5, 3, { _tag: 'Step', by: 10 })).toBe(4);
    expect(targetAfter(5, 2, { _tag: 'Step', by: -10 })).toBe(0);
  });

  it('jumps, clears and selects', () => {
    expect(targetAfter(5, 2, { _tag: 'Jump', to: 'first' })).toBe(0);
    expect(targetAfter(5, 2, { _tag: 'Jump', to: 'last' })).toBe(4);
    expect(targetAfter(5, 2, { _tag: 'Clear' })).toBeUndefined();
    expect(targetAfter(5, 2, { _tag: 'Select' })).toBe(2);
    expect(targetAfter(0, undefined, { _tag: 'Step', by: 1 })).toBeUndefined();
  });

  it('always lands on a target for any step from any target', () => {
    for (let count = 1; count <= 7; count += 1)
      for (let current = 0; current < count; current += 1)
        for (const by of [-12, -10, -3, -1, 1, 3, 10, 12])
          for (const wrap of [true, false]) {
            const next = targetAfter(count, current, { _tag: 'Step', by }, { wrap });
            expect(next).toBeGreaterThanOrEqual(0);
            expect(next).toBeLessThan(count);
          }
  });
});

describe('FoldKit keyboard handlers', () => {
  it('produces a message for chart keys and none for others', () => {
    const handler = chartKeyDown((command) => command._tag);
    expect(handler('Home', plain)).toEqual(Option.some('Jump'));
    expect(handler('Tab', plain)).toEqual(Option.none());
  });

  it('moves roving focus to the target a key leads to', () => {
    const handler = chartKeyDownFocus({
      count: 3,
      current: 1,
      focusSelector: (target) => `#bar-${target}`,
      toMessage: (target) => ({ hovered: target }),
    });
    expect(handler('ArrowRight', plain)).toEqual(
      Option.some({ focusSelector: '#bar-2', message: { hovered: 2 } }),
    );
    expect(handler('End', plain)).toEqual(
      Option.some({ focusSelector: '#bar-2', message: { hovered: 2 } }),
    );
    expect(handler('Escape', plain)).toEqual(Option.none());
    expect(handler('ArrowRight', { ...plain, ctrlKey: true })).toEqual(Option.none());
  });
});
