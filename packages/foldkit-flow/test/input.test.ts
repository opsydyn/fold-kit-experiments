import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { bindInput } from '../src/input';
import type { EditorEvent } from '../src/types';

const previousEvent = Object.getOwnPropertyDescriptor(globalThis, 'KeyboardEvent');
const previousWheelEvent = Object.getOwnPropertyDescriptor(globalThis, 'WheelEvent');
const previousFocusEvent = Object.getOwnPropertyDescriptor(globalThis, 'FocusEvent');
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (previousFocusEvent) Object.defineProperty(globalThis, 'FocusEvent', previousFocusEvent);
  else Reflect.deleteProperty(globalThis, 'FocusEvent');
  if (previousWheelEvent) Object.defineProperty(globalThis, 'WheelEvent', previousWheelEvent);
  else Reflect.deleteProperty(globalThis, 'WheelEvent');
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
  handle?.setAttribute('data-flow-resize-handle', 'left');
  handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -5, y: 0 },
  });
  element.dataset.flowGridSnap = 'true';
  handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -20, y: 0 },
  });
  handle?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
  );
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -80, y: 0 },
  });
  element.dataset.flowGridSpacing = '32';
  handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -32, y: 0 },
  });
  handle?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
  );
  expect(events.at(-1)).toEqual({
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -128, y: 0 },
  });
  release();
});

test('wheel navigation changes in place and preserves editable and page scrolling', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'WheelEvent', { value: window.WheelEvent, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const element = document.createElement('div');
  element.innerHTML = '<input>';
  Object.defineProperties(element, { clientWidth: { value: 800 }, clientHeight: { value: 400 } });
  const events: EditorEvent[] = [];
  const release = bindInput(element, (event) => events.push(event));
  events.length = 0;
  const wheel = (options: WheelEventInit, target: Element = element) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...options });
    Object.defineProperties(event, {
      clientX: { value: options.clientX ?? 0 },
      clientY: { value: options.clientY ?? 0 },
      ctrlKey: { value: options.ctrlKey ?? false },
      metaKey: { value: options.metaKey ?? false },
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(wheel({ deltaY: 20, clientX: 40, clientY: 60 })).toBe(true);
  expect(events.pop()).toEqual({
    type: 'Zoomed',
    point: { x: 40, y: 60 },
    factor: Math.exp(-0.04),
  });
  element.dataset.flowWheelNavigation = 'pan';
  expect(wheel({ deltaX: 2, deltaY: -3, deltaMode: 1 })).toBe(true);
  expect(events.pop()).toEqual({ type: 'ViewportNudged', delta: { x: -32, y: 48 } });
  expect(wheel({ deltaX: 1, deltaY: 1, deltaMode: 2 })).toBe(true);
  expect(events.pop()).toEqual({ type: 'ViewportNudged', delta: { x: -800, y: -400 } });
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
    expect(wheel({ ...modifiers, deltaY: 20, clientX: 40, clientY: 60 })).toBe(true);
    expect(events.pop()).toEqual({
      type: 'Zoomed',
      point: { x: 40, y: 60 },
      factor: Math.exp(-0.04),
    });
  }
  expect(wheel({ deltaY: 20 }, element.querySelector('input')!)).toBe(false);
  element.dataset.flowWheelNavigation = 'off';
  expect(wheel({ deltaY: 20, ctrlKey: true })).toBe(false);
  expect(events).toEqual([]);
  release();
});

test('node focus tracking follows the containing frame and ignores nested editors', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'FocusEvent', {
    value: window.FocusEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const surface = document.createElement('div');
  surface.dataset.flowSurface = '';
  surface.innerHTML = `
    <div data-flow-node="a"><button>First</button><input></div>
    <div data-flow-group="g"><button>Group</button></div>
    <div data-flow-surface><div data-flow-node="nested"><button>Nested</button></div></div>
  `;
  const events: EditorEvent[] = [];
  const release = bindInput(surface, (event) => events.push(event));
  const first = surface.querySelector('[data-flow-node="a"] button');
  const same = surface.querySelector('input');
  const group = surface.querySelector('[data-flow-group] button');
  const nested = surface.querySelector('[data-flow-node="nested"] button');
  first?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  first?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: same }));
  same?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: group }));
  group?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: nested }));
  nested?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  expect(events.slice(1)).toEqual([
    { type: 'NodeFocusChanged', id: 'a' },
    { type: 'NodeFocusChanged', id: 'g' },
    { type: 'NodeFocusChanged', id: null },
  ]);
  release();
});
