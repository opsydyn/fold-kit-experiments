/**
 * DOM pointer events to the kernel's normalised device coordinates.
 *
 * @module
 */
import type { Gestures, Modifiers, PointerInput, SceneEvent } from '@opsydyn/effect-three';

/** The part of `DOMRect` the conversion needs. */
export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Client coordinates to NDC: x and y in [-1, 1], y up. A zero-sized rect maps to the centre. */
export const toNdc = (
  rect: Rect,
  clientX: number,
  clientY: number,
): { readonly x: number; readonly y: number } => {
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
};

const modifiersOf = (event: MouseEvent): Modifiers => ({
  shift: event.shiftKey,
  control: event.ctrlKey,
  meta: event.metaKey,
  alt: event.altKey,
});

/** The pointer's id, or 0 for mouse events that are not pointer events. */
const pointerIdOf = (event: MouseEvent): number =>
  event instanceof PointerEvent ? event.pointerId : 0;

/**
 * Wheel deltas in CSS pixels: line and page modes scaled as three.js's `OrbitControls`
 * scales them (`_customWheelEvent`: 16 and 100).
 */
const wheelScale = [1, 16, 100] as const;

/**
 * Converts a DOM pointer, mouse or wheel event into kernel input, or `undefined` for
 * other event types. Pointer cancel is treated as leaving the surface.
 */
export const toPointerInput = (event: MouseEvent, rect: Rect): PointerInput | undefined => {
  if (event.type === 'pointerleave' || event.type === 'pointercancel') {
    return { _tag: 'PointerLeave' };
  }
  const { x, y } = toNdc(rect, event.clientX, event.clientY);
  const pointer = pointerIdOf(event);
  switch (event.type) {
    case 'pointermove':
      return { _tag: 'PointerMove', x, y, pointer };
    case 'pointerdown':
      return {
        _tag: 'PointerDown',
        x,
        y,
        button: event.button,
        pointer,
        modifiers: modifiersOf(event),
      };
    case 'pointerup':
      return { _tag: 'PointerUp', x, y, button: event.button, pointer };
    case 'dblclick':
      return { _tag: 'DoubleClick', x, y, button: event.button };
    case 'contextmenu':
      return { _tag: 'ContextMenu', x, y };
    case 'wheel':
      return event instanceof WheelEvent
        ? {
            _tag: 'Wheel',
            x,
            y,
            deltaX: event.deltaX * (wheelScale[event.deltaMode] ?? 1),
            deltaY: event.deltaY * (wheelScale[event.deltaMode] ?? 1),
            modifiers: modifiersOf(event),
          }
        : undefined;
    default:
      return undefined;
  }
};

/** True when a press landed on an interactive mesh, which then captures the pointer. */
export const capturesPointer = (events: ReadonlyArray<SceneEvent>): boolean =>
  events.some((event) => event._tag === 'PointerDown');

/** True when the scene handled a context-menu input, so the browser menu should not open. */
export const claimsContextMenu = (events: ReadonlyArray<SceneEvent>): boolean =>
  events.some((event) => event._tag === 'ContextMenu');

const eventTypes = [
  'pointermove',
  'pointerdown',
  'pointerup',
  'pointerleave',
  'pointercancel',
  'dblclick',
  'contextmenu',
  'wheel',
] as const;

/**
 * Forwards pointer, mouse and wheel input from `element`. `onInput` returns the scene
 * events it produced. By default the page keeps its gestures: wheel and touch scroll it,
 * and the browser's menu opens except over an interactive mesh that handles it. A press
 * on a mesh captures the pointer.
 *
 * While `claimsGestures()` is true the scene owns them, as three.js's `OrbitControls` does
 * when connected: every press captures the pointer, the wheel does not scroll the page,
 * and the context menu stays shut (the right button pans). Returns a function that
 * removes every listener.
 */
export const listenForPointer = (
  element: HTMLElement,
  onInput: (input: PointerInput) => ReadonlyArray<SceneEvent>,
  claimsGestures: () => boolean = () => false,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    const input = toPointerInput(event, element.getBoundingClientRect());
    if (input === undefined) return;
    const events = onInput(input);
    const claimed = claimsGestures();
    if (claimed && (event.type === 'wheel' || event.type === 'contextmenu')) {
      event.preventDefault();
    }
    if (event.type === 'contextmenu' && claimsContextMenu(events)) event.preventDefault();
    // Keep the drag's moves and release coming here even off the canvas, as React Three
    // Fiber's setPointerCapture does. The browser releases capture on pointer up.
    if (
      event instanceof PointerEvent &&
      event.type === 'pointerdown' &&
      (claimed || capturesPointer(events))
    ) {
      element.setPointerCapture(event.pointerId);
    }
  };
  // Not passive, so a claimed wheel can stop the page scrolling; unclaimed wheels are
  // left alone.
  for (const type of eventTypes) element.addEventListener(type, listener, { passive: false });
  return () => {
    for (const type of eventTypes) element.removeEventListener(type, listener);
  };
};

/** Whatever reports the scene's claim on gestures: its graph. */
type GestureOwner = { readonly gestures: () => Gestures };

/** Whether the scene currently claims the pointer's gestures. */
export const claimsGestures = (owner: GestureOwner) => (): boolean => owner.gestures() === 'scene';

/** Lets the browser pan and zoom on touch, or not while the scene claims gestures. */
export const touchActionSync = (element: HTMLElement, owner: GestureOwner) => (): void => {
  const touchAction = claimsGestures(owner)() ? 'none' : '';
  if (element.style.touchAction !== touchAction) element.style.touchAction = touchAction;
};

/** After an update: report it, then match the canvas's touch handling to the new claim. */
export const afterUpdate =
  <A>(report: (value: A) => () => void, element: HTMLElement, owner: GestureOwner) =>
  (value: A) =>
  (): void => {
    report(value)();
    touchActionSync(element, owner)();
  };
