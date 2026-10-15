/**
 * The canvas a scene draws into, and DOM event dispatch from scene events.
 *
 * @module
 */
import type { Op, ResourceStore, SceneEvent } from '@opsydyn/effect-three';

import { domEventName, type SceneError } from '../element.ts';
import type { Latch } from './latch.ts';
import { summarise } from './reconciled.ts';

/** Creates a canvas filling `host` and appends it. */
export const appendCanvas = (host: Element): HTMLCanvasElement => {
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Pointer gestures go to the scene, not to page scrolling or zooming.
  canvas.style.touchAction = 'none';
  host.append(canvas);
  return canvas;
};

/** Dispatches a scene event as the element's typed DOM event. */
export const dispatchSceneEvent = (element: Element, event: SceneEvent): void => {
  element.dispatchEvent(new CustomEvent(domEventName[event._tag], { detail: event }));
};

/** Dispatches a rejected scene update as a `scene-error` event. */
export const dispatchSceneError = (element: Element, error: SceneError): void => {
  element.dispatchEvent(new CustomEvent('scene-error', { detail: { error } }));
};

/** Thunk builders, so Effect code can run DOM work with `Effect.sync(thunk)`. */
export const canvasIn = (host: Element) => () => appendCanvas(host);
export const removal = (node: ChildNode) => () => node.remove();
/** Dispatches only while `live` is open: events are dropped during time-travel pause. */
export const sceneEventDispatch = (element: Element, live: Latch) => (event: SceneEvent) => () => {
  if (live.isOpen()) dispatchSceneEvent(element, event);
};
export const sceneErrorDispatch = (element: Element) => (error: SceneError) => () =>
  dispatchSceneError(element, error);

/**
 * Dispatches a `scene-reconciled` summary when an update changed something. Updates with
 * no operations dispatch nothing, so an app storing the summary in its Model can't loop.
 */
export const reconciledDispatch =
  (element: Element, store: ResourceStore) => (ops: ReadonlyArray<Op>) => () => {
    if (ops.length === 0) return;
    element.dispatchEvent(
      new CustomEvent('scene-reconciled', { detail: summarise(ops, store.stats()) }),
    );
  };
