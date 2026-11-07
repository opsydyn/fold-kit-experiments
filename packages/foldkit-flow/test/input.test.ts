import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { bindInput } from '../src/input';
import type { EditorEvent } from '../src/types';

const previousEvent = Object.getOwnPropertyDescriptor(globalThis, 'KeyboardEvent');
const previousWheelEvent = Object.getOwnPropertyDescriptor(globalThis, 'WheelEvent');
const previousFocusEvent = Object.getOwnPropertyDescriptor(globalThis, 'FocusEvent');
const previousMouseEvent = Object.getOwnPropertyDescriptor(globalThis, 'MouseEvent');
const previousPointerEvent = Object.getOwnPropertyDescriptor(globalThis, 'PointerEvent');
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (previousMouseEvent) Object.defineProperty(globalThis, 'MouseEvent', previousMouseEvent);
  else Reflect.deleteProperty(globalThis, 'MouseEvent');
  if (previousPointerEvent) Object.defineProperty(globalThis, 'PointerEvent', previousPointerEvent);
  else Reflect.deleteProperty(globalThis, 'PointerEvent');
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

test('double-click zoom uses two background presses and its own configured factor', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'MouseEvent', { value: window.MouseEvent, configurable: true });
  Object.defineProperty(globalThis, 'PointerEvent', {
    value: window.PointerEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const surface = document.createElement('div');
  surface.dataset.flowSurface = '';
  surface.dataset.flowWheelNavigation = 'off';
  const input = document.createElement('input');
  const button = document.createElement('button');
  surface.append(input, button);
  surface.setPointerCapture = () => {};
  surface.hasPointerCapture = () => false;
  // SAFETY: Happy DOM supplies the standard rectangle coordinates used by the binding.
  surface.getBoundingClientRect = () => new window.DOMRect(10, 20, 800, 400) as DOMRect;
  const events: EditorEvent[] = [];
  const release = bindInput(surface, (event) => {
    events.push(event);
    if (event.type === 'ZoomAreaStarted') surface.dataset.flowZoomAreaMode = 'false';
  });
  const location = { clientX: 60, clientY: 95, bubbles: true, cancelable: true };
  const doubleClick = (target: Element = surface) => {
    for (const detail of [1, 2]) {
      for (const type of ['pointerdown', 'pointerup'])
        target.dispatchEvent(new PointerEvent(type, { ...location, pointerId: 1 }));
      target.dispatchEvent(new MouseEvent('click', { ...location, detail }));
    }
    const event = new MouseEvent('dblclick', { ...location, detail: 2 });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const zooms = () => events.filter(({ type }) => type === 'Zoomed');
  expect(doubleClick()).toBe(false);
  surface.dataset.flowDoubleClickZoom = '1.5';
  expect(doubleClick()).toBe(true);
  expect(zooms()).toEqual([{ type: 'Zoomed', point: { x: 50, y: 75 }, factor: 1.5 }]);
  expect(doubleClick(input)).toBe(false);
  expect(doubleClick(button)).toBe(false);
  surface.dataset.flowSelectionMode = 'true';
  expect(doubleClick()).toBe(false);
  surface.dataset.flowSelectionMode = 'false';
  surface.dataset.flowZoomAreaMode = 'true';
  expect(doubleClick()).toBe(false);
  expect(events.some(({ type }) => type === 'ZoomAreaStarted')).toBe(true);
  expect(zooms()).toHaveLength(1);
  release();
  expect(doubleClick()).toBe(false);
});

test('Space temporarily pans from the focused canvas and resets on release or focus loss', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    value: window.KeyboardEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'PointerEvent', {
    value: window.PointerEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'FocusEvent', { value: window.FocusEvent, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const surface = document.createElement('div');
  surface.dataset.flowSurface = '';
  surface.dataset.flowSelectionMode = 'true';
  surface.setPointerCapture = () => {};
  surface.hasPointerCapture = () => false;
  const input = document.createElement('input');
  const button = document.createElement('button');
  surface.append(input, button);
  const events: EditorEvent[] = [];
  const release = bindInput(surface, (event) => events.push(event));
  const key = (type: 'keydown' | 'keyup', target: Element = surface, repeat = false) => {
    const event = new KeyboardEvent(type, { key: ' ', bubbles: true, cancelable: true, repeat });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  function drag() {
    events.length = 0;
    for (const type of ['pointerdown', 'pointermove', 'pointerup'])
      surface.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1 }));
    return events.map(({ type }) => type);
  }

  expect(key('keydown')).toBe(false);
  expect(drag()).toContain('BoxSelectionStarted');
  surface.dataset.flowSpaceToPan = 'true';
  expect(key('keydown', input)).toBe(false);
  expect(key('keydown', button)).toBe(false);
  expect(drag()).toContain('BoxSelectionStarted');

  surface.dataset.flowZoomAreaMode = 'true';
  expect(key('keydown')).toBe(true);
  expect(drag()).toEqual(['PanStarted', 'PointerMoved', 'PointerMoved', 'PointerReleased']);
  key('keyup');
  expect(drag()).toContain('ZoomAreaStarted');

  surface.dataset.flowZoomAreaMode = 'false';
  key('keydown');
  surface.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: input }));
  expect(drag()).toContain('BoxSelectionStarted');
  key('keydown');
  window.dispatchEvent(new window.Event('blur'));
  expect(drag()).toContain('BoxSelectionStarted');
  key('keydown');
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  key('keydown', surface, true);
  expect(drag()).toContain('BoxSelectionStarted');
  release();
});

test('middle-button pan uses the background and ends when the middle button is released', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'MouseEvent', { value: window.MouseEvent, configurable: true });
  Object.defineProperty(globalThis, 'PointerEvent', {
    value: window.PointerEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const surface = document.createElement('div');
  surface.dataset.flowSurface = '';
  surface.dataset.flowSelectionMode = 'true';
  surface.dataset.flowZoomAreaMode = 'true';
  surface.setPointerCapture = () => {};
  surface.hasPointerCapture = () => false;
  const link = document.createElement('a');
  link.href = '/example';
  const input = document.createElement('input');
  surface.append(link, input);
  const events: EditorEvent[] = [];
  const release = bindInput(surface, (event) => events.push(event));
  const pointer = (type: string, button: number, buttons: number, target: Element = surface) => {
    const event = new PointerEvent(type, {
      button,
      buttons,
      pointerId: 1,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const auxClick = (target: Element) => {
    const event = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  events.length = 0;
  expect(pointer('pointerdown', 1, 4)).toBe(false);
  expect(auxClick(surface)).toBe(false);
  expect(events).toEqual([]);
  surface.dataset.flowMiddleButtonPan = 'true';
  expect(pointer('pointerdown', 1, 4, link)).toBe(false);
  expect(pointer('pointerdown', 1, 4, input)).toBe(false);
  expect(auxClick(link)).toBe(false);
  expect(events).toEqual([]);
  expect(pointer('pointerdown', 1, 4)).toBe(true);
  pointer('pointermove', 0, 5);
  pointer('pointermove', 1, 1);
  pointer('pointerup', 0, 0);
  expect(events.map(({ type }) => type)).toEqual([
    'PanStarted',
    'PointerMoved',
    'PointerMoved',
    'PointerReleased',
  ]);
  expect(auxClick(surface)).toBe(true);

  events.length = 0;
  pointer('pointerdown', 0, 1);
  expect(events[0]?.type).toBe('ZoomAreaStarted');
  pointer('pointerup', 0, 0);
  release();
  expect(pointer('pointerdown', 1, 4)).toBe(false);
  expect(auxClick(surface)).toBe(false);
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

test('dedicated anchor controls capture pointer edits and emit normalized keyboard nudges', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    value: window.KeyboardEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'PointerEvent', {
    value: window.PointerEvent,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const surface = document.createElement('div');
  surface.dataset.flowSurface = '';
  surface.innerHTML =
    '<button data-flow-anchor-node="a" data-flow-anchor-port="out">Position</button>';
  surface.setPointerCapture = () => {};
  surface.hasPointerCapture = () => false;
  const events: EditorEvent[] = [];
  const cleanup = bindInput(surface, (event) => events.push(event));
  const handle = surface.querySelector('button');
  handle?.dispatchEvent(
    new PointerEvent('pointerdown', {
      pointerId: 7,
      button: 0,
      clientX: 30,
      clientY: 40,
      bubbles: true,
    }),
  );
  expect(events.at(-1)).toEqual({
    type: 'PortAnchorDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 7,
    point: { x: 30, y: 40 },
  });
  surface.dispatchEvent(
    new PointerEvent('pointerup', {
      pointerId: 7,
      button: 0,
      clientX: 35,
      clientY: 45,
      bubbles: true,
    }),
  );
  expect(events.at(-1)).toEqual({ type: 'PointerReleased', pointer: 7 });
  handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(events.at(-1)).toEqual({
    type: 'PortAnchorNudged',
    endpoint: { node: 'a', port: 'out' },
    delta: { x: -0.01, y: 0 },
  });
  handle?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
  );
  expect(events.at(-1)).toEqual({
    type: 'PortAnchorNudged',
    endpoint: { node: 'a', port: 'out' },
    delta: { x: 0, y: 0.1 },
  });
  cleanup();
});

test('anchor bypass modifiers are opt-in, captured per gesture and report key-only transitions', () => {
  for (const key of ['Alt', 'Control', 'Meta', 'Shift'] as const) {
    const window = new Window();
    Object.defineProperty(globalThis, 'KeyboardEvent', {
      value: window.KeyboardEvent,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'PointerEvent', {
      value: window.PointerEvent,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
    const surface = document.createElement('div');
    surface.dataset.flowSurface = '';
    surface.dataset.flowPortAnchorSnapBypass = key;
    surface.innerHTML =
      '<button data-flow-anchor-node="a" data-flow-anchor-port="p">Position</button>';
    surface.setPointerCapture = () => {};
    surface.hasPointerCapture = () => false;
    const events: EditorEvent[] = [];
    const cleanup = bindInput(surface, (event) => events.push(event));
    const handle = surface.querySelector('button');
    handle?.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 7, button: 0, bubbles: true }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'PortAnchorDragStarted', snapBypassed: false });
    const flags = {
      altKey: key === 'Alt',
      ctrlKey: key === 'Control',
      metaKey: key === 'Meta',
      shiftKey: key === 'Shift',
    };
    surface.dataset.flowPortAnchorSnapBypass = '';
    handle?.dispatchEvent(new KeyboardEvent('keydown', { key, ...flags, bubbles: true }));
    expect(events.at(-1)).toEqual({
      type: 'PortAnchorSnapBypassChanged',
      pointer: 7,
      bypassed: true,
    });
    surface.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 7, ...flags, clientX: 15, bubbles: true }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'PointerMoved', portAnchorSnapBypassed: true });
    handle?.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    expect(events.at(-1)).toEqual({
      type: 'PortAnchorSnapBypassChanged',
      pointer: 7,
      bypassed: false,
    });
    surface.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }));
    const count = events.length;
    handle?.dispatchEvent(new KeyboardEvent('keydown', { key, ...flags, bubbles: true }));
    expect(events).toHaveLength(count);
    cleanup();
    const disabled: EditorEvent[] = [];
    const close = bindInput(surface, (event) => disabled.push(event));
    handle?.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 8, button: 0, altKey: true, bubbles: true }),
    );
    expect(disabled.at(-1)).not.toHaveProperty('snapBypassed');
    handle?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }),
    );
    expect(disabled.some((event) => event.type === 'PortAnchorSnapBypassChanged')).toBe(false);
    close();
  }
});
