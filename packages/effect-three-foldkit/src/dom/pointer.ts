/**
 * DOM pointer events to the kernel's normalised device coordinates.
 *
 * @module
 */
import type { PointerInput } from '@opsydyn/effect-three';

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

/** Converts a DOM pointer event into kernel input, or `undefined` for other event types. */
export const toPointerInput = (event: PointerEvent, rect: Rect): PointerInput | undefined => {
  if (event.type === 'pointerleave' || event.type === 'pointercancel') {
    return { _tag: 'PointerLeave' };
  }
  const { x, y } = toNdc(rect, event.clientX, event.clientY);
  if (event.type === 'pointermove') return { _tag: 'PointerMove', x, y };
  if (event.type === 'pointerdown') return { _tag: 'PointerDown', x, y, button: event.button };
  if (event.type === 'pointerup') return { _tag: 'PointerUp', x, y, button: event.button };
  return undefined;
};

const pointerEventTypes = [
  'pointermove',
  'pointerdown',
  'pointerup',
  'pointerleave',
  'pointercancel',
] as const;

/** Forwards pointer input from `element`. Returns a function that removes every listener. */
export const listenForPointer = (
  element: HTMLElement,
  onInput: (input: PointerInput) => void,
): (() => void) => {
  const listener = (event: PointerEvent): void => {
    const input = toPointerInput(event, element.getBoundingClientRect());
    if (input !== undefined) onInput(input);
  };
  for (const type of pointerEventTypes) element.addEventListener(type, listener);
  return () => {
    for (const type of pointerEventTypes) element.removeEventListener(type, listener);
  };
};
