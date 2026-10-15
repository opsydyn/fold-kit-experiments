/**
 * DOM pointer events to the kernel's normalised device coordinates.
 *
 * @module
 */
import type { PointerInput, SceneEvent } from '@opsydyn/effect-three';

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

/**
 * Converts a DOM pointer, mouse or wheel event into kernel input, or `undefined` for
 * other event types. Pointer cancel is treated as leaving the surface.
 */
export const toPointerInput = (event: MouseEvent, rect: Rect): PointerInput | undefined => {
  if (event.type === 'pointerleave' || event.type === 'pointercancel') {
    return { _tag: 'PointerLeave' };
  }
  const { x, y } = toNdc(rect, event.clientX, event.clientY);
  switch (event.type) {
    case 'pointermove':
      return { _tag: 'PointerMove', x, y };
    case 'pointerdown':
      return { _tag: 'PointerDown', x, y, button: event.button };
    case 'pointerup':
      return { _tag: 'PointerUp', x, y, button: event.button };
    case 'dblclick':
      return { _tag: 'DoubleClick', x, y, button: event.button };
    case 'contextmenu':
      return { _tag: 'ContextMenu', x, y };
    case 'wheel':
      return 'deltaY' in event && event instanceof WheelEvent
        ? { _tag: 'Wheel', x, y, deltaX: event.deltaX, deltaY: event.deltaY }
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
 * events it produced: a context menu over an interactive mesh suppresses the browser's
 * menu, anywhere else it opens as usual, and a press on a mesh captures the pointer. Wheel listening is passive, so page scrolling
 * is never blocked. Returns a function that removes every listener.
 */
export const listenForPointer = (
  element: HTMLElement,
  onInput: (input: PointerInput) => ReadonlyArray<SceneEvent>,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    const input = toPointerInput(event, element.getBoundingClientRect());
    if (input === undefined) return;
    const events = onInput(input);
    if (event.type === 'contextmenu' && claimsContextMenu(events)) event.preventDefault();
    // Keep the drag's moves and release coming here even off the canvas, as React Three
    // Fiber's setPointerCapture does. The browser releases capture on pointer up.
    if (event instanceof PointerEvent && event.type === 'pointerdown' && capturesPointer(events)) {
      element.setPointerCapture(event.pointerId);
    }
  };
  for (const type of eventTypes)
    element.addEventListener(type, listener, { passive: type === 'wheel' });
  return () => {
    for (const type of eventTypes) element.removeEventListener(type, listener);
  };
};
