/**
 * Pointer hit testing and the pointer state machine.
 *
 * Input arrives in normalised device coordinates (NDC: x and y in [-1, 1], y up), never
 * as DOM events, so this stays DOM-free. Hover is reported only on transitions: moving
 * within one object, or holding still over it, emits nothing.
 *
 * @module
 */
import { Raycaster, Vector2 } from 'three';

import type { Vec3 } from './description.ts';
import type { SceneGraph } from './sceneGraph.ts';

/** Pointer input in normalised device coordinates. `button` follows `MouseEvent.button`. */
export type PointerInput =
  | { readonly _tag: 'PointerMove'; readonly x: number; readonly y: number }
  | {
      readonly _tag: 'PointerDown';
      readonly x: number;
      readonly y: number;
      readonly button: number;
    }
  | { readonly _tag: 'PointerUp'; readonly x: number; readonly y: number; readonly button: number }
  | { readonly _tag: 'PointerLeave' };

/** Interaction with an interactive mesh, identified by its key. */
export type SceneEvent =
  | { readonly _tag: 'PointerEnter'; readonly key: string }
  | { readonly _tag: 'PointerLeave'; readonly key: string }
  | {
      readonly _tag: 'PointerDown';
      readonly key: string;
      readonly button: number;
      readonly point: Vec3;
    }
  | { readonly _tag: 'PointerUp'; readonly key: string; readonly button: number; readonly point: Vec3 }
  | { readonly _tag: 'Click'; readonly key: string; readonly button: number; readonly point: Vec3 };

/** The nearest interactive mesh under a point, with the world-space hit point. */
export type Hit = { readonly key: string; readonly point: Vec3 };

export type Picker = {
  /** Hit-tests at NDC `(x, y)`. Updates world matrices first, so it works headless. */
  readonly pick: (x: number, y: number) => Hit | undefined;
};

/** Creates a raycasting picker over a graph's interactive meshes. */
export const createPicker = (graph: SceneGraph): Picker => {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  return {
    pick: (x, y) => {
      const targets = graph.interactiveObjects();
      if (targets.length === 0) return undefined;
      graph.scene.updateMatrixWorld();
      graph.camera.updateMatrixWorld();
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, graph.camera);
      for (const intersection of raycaster.intersectObjects(targets, false)) {
        const key = graph.keyOf(intersection.object);
        if (key !== undefined) {
          const { x: px, y: py, z: pz } = intersection.point;
          return { key, point: [px, py, pz] };
        }
      }
      return undefined;
    },
  };
};

export type PointerTracker = {
  /** Applies one input and returns the resulting events. */
  readonly input: (input: PointerInput) => ReadonlyArray<SceneEvent>;
  /**
   * Re-tests hover at the last pointer position. Call once per frame: objects can move
   * under a stationary pointer. Returns only enter and leave transitions.
   */
  readonly frame: () => ReadonlyArray<SceneEvent>;
};

const none: ReadonlyArray<SceneEvent> = [];

/** Creates the pointer state machine for one scene. */
export const createPointerTracker = (picker: Picker): PointerTracker => {
  let position: { x: number; y: number } | undefined;
  let hovered: string | undefined;
  let pressed: { readonly key: string; readonly button: number } | undefined;

  const hover = (hit: Hit | undefined, events: Array<SceneEvent>): void => {
    const next = hit?.key;
    if (next === hovered) return;
    if (hovered !== undefined) events.push({ _tag: 'PointerLeave', key: hovered });
    if (next !== undefined) events.push({ _tag: 'PointerEnter', key: next });
    hovered = next;
  };

  const input = (event: PointerInput): ReadonlyArray<SceneEvent> => {
    const events: Array<SceneEvent> = [];
    if (event._tag === 'PointerLeave') {
      position = undefined;
      pressed = undefined;
      hover(undefined, events);
      return events;
    }
    position = { x: event.x, y: event.y };
    const hit = picker.pick(event.x, event.y);
    hover(hit, events);
    if (hit === undefined) {
      if (event._tag === 'PointerUp') pressed = undefined;
      return events;
    }
    if (event._tag === 'PointerDown') {
      events.push({ _tag: 'PointerDown', key: hit.key, button: event.button, point: hit.point });
      pressed = { key: hit.key, button: event.button };
    } else if (event._tag === 'PointerUp') {
      events.push({ _tag: 'PointerUp', key: hit.key, button: event.button, point: hit.point });
      if (pressed?.key === hit.key && pressed.button === event.button) {
        events.push({ _tag: 'Click', key: hit.key, button: event.button, point: hit.point });
      }
      pressed = undefined;
    }
    return events;
  };

  const frame = (): ReadonlyArray<SceneEvent> => {
    if (position === undefined) return none;
    const events: Array<SceneEvent> = [];
    hover(picker.pick(position.x, position.y), events);
    return events.length === 0 ? none : events;
  };

  return { input, frame };
};
