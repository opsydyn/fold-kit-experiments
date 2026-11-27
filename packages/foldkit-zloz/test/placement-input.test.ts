import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { bindPlacementInput } from '../src/bind-placement-input';
import type { ZlozPlacementInput } from '../src/index';

const previous = ['document', 'PointerEvent', 'KeyboardEvent', 'MouseEvent'].map((key) => ({
  key,
  descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
}));
afterEach(() => {
  for (const { key, descriptor } of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
function fixture() {
  const window = new Window();
  for (const [key, value] of Object.entries({
    document: window.document,
    PointerEvent: window.PointerEvent,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const root = document.createElement('div');
  root.setAttribute('data-zloz-placement-host', '');
  root.dataset.zlozPlacementScope = 'session';
  root.dataset.zlozPlacementGeneration = '0';
  root.dataset.zlozPlacementTargetRevision = '1';
  root.dataset.zlozPlacementActive = 'false';
  root.dataset.zlozPlacementStep = '20';
  root.innerHTML =
    '<button data-zloz-palette-entry="card">Card</button><div data-flow-surface tabindex="0"></div><input><div data-zloz-placement-host><button data-zloz-palette-entry="other">Other</button></div>';
  document.body.append(root);
  const surface = root.querySelector('[data-flow-surface]');
  const button = root.querySelector('button');
  if (!surface || !button) throw new Error('Fixture requires controls');
  let left = 300;
  Object.assign(surface, {
    getBoundingClientRect: () => ({
      left,
      top: 100,
      right: left + 800,
      bottom: 700,
      width: 800,
      height: 600,
    }),
  });
  let captured: number | null = null;
  Object.assign(root, {
    setPointerCapture: (id: number) => {
      captured = id;
    },
    hasPointerCapture: (id: number) => captured === id,
    releasePointerCapture: () => {
      captured = null;
    },
  });
  const events: ZlozPlacementInput[] = [];
  const release = bindPlacementInput(root, (event) => events.push(event));
  const pointer = (
    type: string,
    target = button,
    x = 20,
    y = 20,
    pointerType = 'mouse',
    pointerId = 7,
  ) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  return {
    window,
    root,
    surface,
    button,
    events,
    release,
    pointer,
    shiftOrigin: () => {
      left = 350;
    },
    captured: () => captured,
  };
}
test('mouse and touch capture normalize live origin, exclude other pointers and commit once', () => {
  for (const kind of ['mouse', 'touch']) {
    const f = fixture();
    f.pointer('pointerdown', f.button, 20, 20, kind);
    expect(f.events[0]).toEqual({
      type: 'PaletteEntryActivated',
      scope: 'session',
      generation: 0,
      id: 'card',
    });
    expect(f.captured()).toBe(7);
    f.root.dataset.zlozPlacementGeneration = '1';
    f.root.dataset.zlozPlacementActive = 'true';
    f.pointer('pointermove', f.button, 420, 220, kind, 8);
    expect(f.events).toHaveLength(1);
    f.shiftOrigin();
    f.pointer('pointermove', f.button, 420, 220, kind);
    expect(f.events[1]).toEqual({
      type: 'PlacementPointed',
      scope: 'session',
      generation: 1,
      point: { x: 70, y: 120 },
      bypassed: false,
      commit: false,
    });
    f.pointer('pointerup', f.button, 420, 220, kind);
    expect(
      f.events.filter((event) => event.type === 'PlacementPointed' && event.commit),
    ).toHaveLength(1);
    expect(f.captured()).toBeNull();
    f.pointer('pointerup', f.button, 420, 220, kind);
    expect(f.events).toHaveLength(3);
    f.release();
    f.pointer('pointerdown');
    expect(f.events).toHaveLength(3);
  }
});
test('keyboard activation, cancellation, blur, nested hosts and editable fields are isolated', () => {
  const f = fixture();
  f.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(f.events[0]?.type).toBe('PaletteEntryActivated');
  f.root.dataset.zlozPlacementActive = 'true';
  f.root.dataset.zlozPlacementGeneration = '1';
  f.button.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      shiftKey: true,
      altKey: true,
    }),
  );
  expect(f.events[1]).toEqual({
    type: 'PlacementNudged',
    scope: 'session',
    generation: 1,
    delta: { x: 10, y: 0 },
    bypassed: true,
  });
  f.root
    .querySelector('input')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  f.root
    .querySelector('[data-zloz-palette-entry="other"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(f.events).toHaveLength(2);
  const unrelated = document.createElement('button');
  f.root.append(unrelated);
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  unrelated.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(false);
  expect(f.events).toHaveLength(2);
  f.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(f.events[2]?.type).toBe('PlacementDismissed');
  f.pointer('pointerdown');
  f.pointer('pointercancel');
  expect(f.events.at(-1)?.type).toBe('PlacementDismissed');
  expect(f.captured()).toBeNull();
  f.window.dispatchEvent(new f.window.Event('blur'));
  expect(f.events.at(-1)?.type).toBe('PlacementDismissed');
  f.release();
});
