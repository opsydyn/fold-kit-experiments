import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { bindInput } from '../src/input';
import type { EditorEvent } from '../src/types';

const previousEvent = Object.getOwnPropertyDescriptor(globalThis, 'KeyboardEvent');
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  if (previousEvent) Object.defineProperty(globalThis, 'KeyboardEvent', previousEvent);
  else Reflect.deleteProperty(globalThis, 'KeyboardEvent');
});

test('input cleanup removes listeners and text fields retain their editing keys', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    value: window.KeyboardEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const element = document.createElement('div');
  element.innerHTML = '<button data-flow-handle="a">Source</button><input value="hello">';
  const events: EditorEvent[] = [];
  const release = bindInput(element, (event) => events.push(event));
  expect(events).toEqual([{ type: 'GestureCancelled' }]);
  events.length = 0;
  element
    .querySelector('input')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  expect(events).toEqual([]);
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  expect(events).toEqual([{ type: 'DeletePressed' }]);
  release();
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  expect(events).toHaveLength(1);
  const releaseAgain = bindInput(element, (event) => events.push(event));
  expect(events.at(-1)).toEqual({ type: 'GestureCancelled' });
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  expect(events).toHaveLength(3);
  releaseAgain();
});

test('group resize keyboard arrows emit dimensions rather than moving the selection', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    value: window.KeyboardEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const element = document.createElement('div');
  element.innerHTML = '<button data-flow-group-resize data-flow-resize="g">Resize group</button>';
  const events: EditorEvent[] = [];
  const release = bindInput(element, (event) => events.push(event));
  events.length = 0;
  const handle = element.querySelector('button');
  for (const [key, shiftKey] of [
    ['ArrowRight', false],
    ['ArrowUp', true],
  ] as const) {
    const event = new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    handle?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(events).toEqual([
    { type: 'GroupResizeNudged', id: 'g', delta: { x: 5, y: 0 } },
    { type: 'GroupResizeNudged', id: 'g', delta: { x: 0, y: -20 } },
  ]);
  handle?.setAttribute('data-flow-resize-corner', 'top-left');
  handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    corner: 'top-left',
    delta: { x: 5, y: 0 },
  });
  release();
});
