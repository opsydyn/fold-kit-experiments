/**
 * Pointer hit testing and the pointer state machine.
 *
 * Input arrives in normalised device coordinates (NDC: x and y in [-1, 1], y up), never
 * as DOM events, so this stays DOM-free. Hover is reported on transitions (enter, leave)
 * plus a move for each pointer movement over an interactive mesh.
 *
 * Behavioural reference: React Three Fiber `packages/fiber/src/core/events.ts` at
 * `d74622e`. As there, click, double-click and context-menu events go only to the mesh
 * that was also under the pointer when it was pressed, and a click that hits nothing and
 * moved at most two CSS pixels is a miss.
 *
 * @module
 */
import { type Object3D, Raycaster, Vector2, Vector3 } from 'three';

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
  | {
      readonly _tag: 'DoubleClick';
      readonly x: number;
      readonly y: number;
      readonly button: number;
    }
  | { readonly _tag: 'ContextMenu'; readonly x: number; readonly y: number }
  | {
      readonly _tag: 'Wheel';
      readonly x: number;
      readonly y: number;
      readonly deltaX: number;
      readonly deltaY: number;
    }
  | { readonly _tag: 'PointerLeave' };

/**
 * The nearest interactive mesh under a point.
 *
 * - `point`: world-space hit point. `distance`: from the camera, in world units.
 * - `normal`: world-space normal of the face hit. `uv`: texture coordinates at the hit.
 *   Every kernel-built geometry has both; a geometry without them reports zeros.
 */
export type Hit = {
  readonly key: string;
  /** For an `instances` node, the key of the instance hit. */
  readonly instance?: string;
  /** For a `borrowed` node, the `name` of the object hit inside it, when it has one. */
  readonly part?: string;
  /** With several views, the key of the view the pointer was over. */
  readonly view?: string;
  /**
   * Keys of the hit mesh's ancestor groups, nearest first. Match on it to handle every
   * mesh in a group with one handler: React Three Fiber's bubbling, as data.
   */
  readonly path: ReadonlyArray<string>;
  readonly point: Vec3;
  readonly distance: number;
  readonly normal: Vec3;
  readonly uv: readonly [u: number, v: number];
  /** The world-space ray through the pointer, as on every React Three Fiber event. */
  readonly ray: Ray;
};

/** A world-space ray from the camera through the pointer. `direction` is unit length. */
export type Ray = { readonly origin: Vec3; readonly direction: Vec3 };

/** A plane `normal · p + constant = 0`, as three.js's `Plane`. */
export type PlaneEquation = { readonly normal: Vec3; readonly constant: number };

/**
 * Where a ray meets a plane, or `undefined` when it runs parallel or the plane is behind
 * it. Turns drag rays into points: `pointOnPlane(ray, { normal: [0, 1, 0], constant: 0 })`
 * is the point on the ground.
 */
export const pointOnPlane = (ray: Ray, plane: PlaneEquation): Vec3 | undefined => {
  const [nx, ny, nz] = plane.normal;
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.direction;
  const denominator = nx * dx + ny * dy + nz * dz;
  if (Math.abs(denominator) < 1e-12) return undefined;
  const t = -(nx * ox + ny * oy + nz * oz + plane.constant) / denominator;
  if (t < 0) return undefined;
  return [ox + dx * t, oy + dy * t, oz + dz * t];
};

/** A hit with a tag and extra fields, flattened into one object type. */
type HitEvent<Tag extends string, Extra = unknown> = {
  readonly [K in keyof ({ readonly _tag: Tag } & Hit & Extra)]: ({ readonly _tag: Tag } & Hit &
    Extra)[K];
};

/** Interaction with an interactive mesh, identified by its key, plus misses. */
export type SceneEvent =
  | HitEvent<'PointerEnter'>
  | { readonly _tag: 'PointerLeave'; readonly key: string }
  | HitEvent<'PointerMove'>
  | HitEvent<'PointerDown', { readonly button: number }>
  | HitEvent<'PointerUp', { readonly button: number }>
  | HitEvent<'Click', { readonly button: number }>
  | HitEvent<'DoubleClick', { readonly button: number }>
  | HitEvent<'ContextMenu'>
  | HitEvent<'Wheel', { readonly deltaX: number; readonly deltaY: number }>
  /** A click that hit no interactive mesh: useful for clearing a selection. */
  | { readonly _tag: 'PointerMissed'; readonly button: number }
  /**
   * The pointer moved while pressed on mesh `key`, anywhere: the press captures the
   * pointer, as React Three Fiber's `setPointerCapture` does, until release.
   */
  | { readonly _tag: 'Drag'; readonly key: string; readonly button: number; readonly ray: Ray }
  /** A drag on `key` ended: released anywhere, or the pointer left. Only after a `Drag`. */
  | {
      readonly _tag: 'DragEnd';
      readonly key: string;
      readonly button: number;
      readonly ray: Ray;
    }
  /**
   * The frame-rate monitor moved the performance factor (0 to 1). Not a pointer event:
   * it travels with them so one stream carries everything the scene reports.
   */
  | { readonly _tag: 'PerformanceChanged'; readonly fps: number; readonly factor: number };

export type Picker = {
  /** Hit-tests at NDC `(x, y)`. Updates world matrices first, so it works headless. */
  readonly pick: (x: number, y: number) => Hit | undefined;
  /** The world-space ray through NDC `(x, y)`. */
  readonly ray: (x: number, y: number) => Ray;
  /** The picked graph's viewport in CSS pixels, for pixel thresholds. */
  readonly viewport: () => { readonly width: number; readonly height: number };
};

const toVec3 = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

/**
 * The nearest object with a key: the object itself for kernel-built meshes, or the
 * borrowed node wrapping an application object.
 */
const keyedOwner = (graph: SceneGraph, object: Object3D): Object3D | undefined => {
  for (let current: Object3D | null = object; current !== null; current = current.parent) {
    if (graph.keyOf(current) !== undefined) return current;
  }
  return undefined;
};

/** The name of the part hit inside a borrowed object, when the hit is inside one. */
const partOf = (owner: Object3D, hit: Object3D): { readonly part?: string } =>
  owner === hit || hit.name === '' ? {} : { part: hit.name };

/** Keys of an object's keyed ancestors, nearest first. */
const pathOf = (graph: SceneGraph, object: Object3D): ReadonlyArray<string> => {
  const path: Array<string> = [];
  for (let parent = object.parent; parent !== null; parent = parent.parent) {
    const key = graph.keyOf(parent);
    if (key !== undefined) path.push(key);
  }
  return path;
};

/** Creates a raycasting picker over a graph's interactive meshes and groups. */
export const createPicker = (graph: SceneGraph): Picker => {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const normal = new Vector3();
  /**
   * Aims the ray through canvas NDC `(x, y)`: with the main camera, or with the camera of
   * the topmost view under the point, in that view's own NDC. Returns the view's key, or
   * `false` when views exist but none is under the point.
   */
  const aim = (x: number, y: number): string | undefined | false => {
    graph.scene.updateMatrixWorld();
    const views = graph.views();
    if (views.length === 0) {
      graph.camera.updateMatrixWorld();
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, graph.camera);
      return undefined;
    }
    const { width, height } = graph.viewport();
    const px = ((x + 1) / 2) * width;
    const py = ((1 - y) / 2) * height;
    for (let i = views.length - 1; i >= 0; i--) {
      const view = views[i];
      if (view === undefined) continue;
      const { area } = view;
      if (px < area.x || px > area.x + area.width || py < area.y || py > area.y + area.height) {
        continue;
      }
      view.camera.updateMatrixWorld();
      ndc.set(((px - area.x) / area.width) * 2 - 1, -(((py - area.y) / area.height) * 2 - 1));
      raycaster.setFromCamera(ndc, view.camera);
      return view.key;
    }
    return false;
  };
  const currentRay = (): Ray => ({
    origin: toVec3(raycaster.ray.origin),
    direction: toVec3(raycaster.ray.direction),
  });
  return {
    ray: (x, y) => {
      aim(x, y);
      return currentRay();
    },
    pick: (x, y) => {
      const targets = graph.interactiveObjects();
      if (targets.length === 0) return undefined;
      const view = aim(x, y);
      if (view === false) return undefined;
      // Recursive, so an interactive group makes every mesh inside it pickable.
      for (const intersection of raycaster.intersectObjects(targets, true)) {
        const owner = keyedOwner(graph, intersection.object);
        const key = owner === undefined ? undefined : graph.keyOf(owner);
        if (owner !== undefined && key !== undefined) {
          normal.set(0, 0, 0);
          if (intersection.face) {
            normal
              .copy(intersection.face.normal)
              .transformDirection(intersection.object.matrixWorld);
          }
          const instance =
            intersection.instanceId === undefined
              ? undefined
              : graph.instanceKeyOf(intersection.object, intersection.instanceId);
          return {
            key,
            ...(instance === undefined ? {} : { instance }),
            ...partOf(owner, intersection.object),
            ...(view === undefined ? {} : { view }),
            path: pathOf(graph, owner),
            point: toVec3(intersection.point),
            distance: intersection.distance,
            normal: toVec3(normal),
            uv: [intersection.uv?.x ?? 0, intersection.uv?.y ?? 0],
            ray: currentRay(),
          };
        }
      }
      return undefined;
    },
    viewport: graph.viewport,
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

/** A click moving further than this, in CSS pixels, is a drag and never a miss. */
const missTolerance = 2;

type Press = {
  readonly key: string | undefined;
  readonly button: number;
  readonly x: number;
  readonly y: number;
};

/** Creates the pointer state machine for one scene. */
export const createPointerTracker = (picker: Picker): PointerTracker => {
  let position: { x: number; y: number } | undefined;
  let hovered: string | undefined;
  // The latest press, kept after release: double-click and context-menu events follow it.
  let press: Press | undefined;
  let pressing = false;
  // Whether the current press has dragged: only then does its release end a drag.
  let dragged = false;

  const hover = (hit: Hit | undefined, events: Array<SceneEvent>): void => {
    const next = hit?.key;
    if (next === hovered) return;
    if (hovered !== undefined) events.push({ _tag: 'PointerLeave', key: hovered });
    if (hit !== undefined) events.push({ _tag: 'PointerEnter', ...hit });
    hovered = next;
  };

  /** CSS pixels between the press and NDC `(x, y)`. */
  const travel = (from: Press, x: number, y: number): number => {
    const { width, height } = picker.viewport();
    return Math.hypot(((x - from.x) * width) / 2, ((y - from.y) * height) / 2);
  };

  const pressed = (hit: Hit): boolean => press !== undefined && press.key === hit.key;

  const release = (
    hit: Hit | undefined,
    event: { readonly x: number; readonly y: number; readonly button: number },
    events: Array<SceneEvent>,
  ): void => {
    const from = pressing ? press : undefined;
    pressing = false;
    if (hit !== undefined) {
      events.push({ _tag: 'PointerUp', button: event.button, ...hit });
      if (from?.key === hit.key && from.button === event.button) {
        events.push({ _tag: 'Click', button: event.button, ...hit });
      }
      return;
    }
    if (from?.button === event.button && travel(from, event.x, event.y) <= missTolerance) {
      events.push({ _tag: 'PointerMissed', button: event.button });
    }
  };

  /** The pressed mesh holding pointer capture, if any. */
  const captured = (): { readonly key: string; readonly button: number } | undefined =>
    pressing && press?.key !== undefined ? { key: press.key, button: press.button } : undefined;

  /** Ends a drag that moved; a press released without moving was a click, not a drag. */
  const endDrag = (
    drag: { readonly key: string; readonly button: number } | undefined,
    x: number,
    y: number,
    events: Array<SceneEvent>,
  ): void => {
    if (drag !== undefined && dragged) {
      events.push({ _tag: 'DragEnd', ...drag, ray: picker.ray(x, y) });
    }
    dragged = false;
  };

  const input = (event: PointerInput): ReadonlyArray<SceneEvent> => {
    const events: Array<SceneEvent> = [];
    if (event._tag === 'PointerLeave') {
      // A cancelled or abandoned press still ends its drag, at the last known position.
      if (position !== undefined) endDrag(captured(), position.x, position.y, events);
      dragged = false;
      position = undefined;
      press = undefined;
      pressing = false;
      hover(undefined, events);
      return events;
    }
    const drag = captured();
    position = { x: event.x, y: event.y };
    const hit = picker.pick(event.x, event.y);
    hover(hit, events);
    switch (event._tag) {
      case 'PointerMove':
        if (hit !== undefined) events.push({ _tag: 'PointerMove', ...hit });
        if (drag !== undefined) {
          dragged = true;
          events.push({ _tag: 'Drag', ...drag, ray: picker.ray(event.x, event.y) });
        }
        break;
      case 'PointerDown':
        press = { key: hit?.key, button: event.button, x: event.x, y: event.y };
        pressing = true;
        dragged = false;
        if (hit !== undefined) events.push({ _tag: 'PointerDown', button: event.button, ...hit });
        break;
      case 'PointerUp':
        release(hit, event, events);
        // Any release ends capture: a mouse's buttons share one pointer.
        endDrag(drag, event.x, event.y, events);
        break;
      case 'DoubleClick':
        if (hit !== undefined && pressed(hit)) {
          events.push({ _tag: 'DoubleClick', button: event.button, ...hit });
        }
        break;
      case 'ContextMenu':
        if (hit !== undefined && pressed(hit)) events.push({ _tag: 'ContextMenu', ...hit });
        break;
      case 'Wheel':
        if (hit !== undefined) {
          events.push({ _tag: 'Wheel', deltaX: event.deltaX, deltaY: event.deltaY, ...hit });
        }
        break;
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
