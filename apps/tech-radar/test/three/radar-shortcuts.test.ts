import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import { type Model, visibleOf } from '../../src/radar/three/model';
import { shortcuts } from '../../src/radar/three/shortcuts';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const press = (model: Model, shortcut: (typeof shortcuts)[number]['shortcut']) =>
  update(model, Message.PressedShortcut({ shortcut }));
const ids = visibleOf(start).map(({ entry }) => entry.id);

describe('keyboard shortcuts', () => {
  test('J and K step through the entries the filters show, wrapping at either end', () => {
    const first = press(start, 'next-entry').model;
    expect(first.selected).toEqual(Option.some(ids[0] ?? ''));
    expect(press(first, 'previous-entry').model.selected).toEqual(Option.some(ids.at(-1) ?? ''));
    expect(press(start, 'previous-entry').model.selected).toEqual(Option.some(ids.at(-1) ?? ''));
  });

  test('[ and ] step through the editions and stop at either end', () => {
    expect(press(start, 'next-edition').model.edition).toBe(start.edition);
    expect(press(start, 'previous-edition').model.edition).toBe(start.edition - 1);
  });

  test('Esc closes the shortcut list before it unpins', () => {
    const pinned = press(start, 'next-entry').model;
    const open = press(pinned, 'toggle-help').model;
    expect(open.shortcutsOpen).toBe(true);
    const closed = press(open, 'clear').model;
    expect(closed.shortcutsOpen).toBe(false);
    expect(Option.isSome(closed.selected)).toBe(true);
    expect(press(closed, 'clear').model.selected).toEqual(Option.none());
  });

  test('O opens the pinned entry only, and / asks for the search box', () => {
    expect(press(start, 'open-page').commands ?? []).toEqual([]);
    expect((press(start, 'focus-search').commands ?? []).length).toBe(1);
  });

  test('every shortcut has a key, and no key is bound twice', () => {
    const keys = shortcuts.flatMap(({ keys: bound }) => bound);
    expect(new Set(keys).size).toBe(keys.length);
    expect(shortcuts.every(({ keys: bound }) => bound.length > 0)).toBe(true);
  });
});
