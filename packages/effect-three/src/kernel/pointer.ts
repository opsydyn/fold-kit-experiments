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

import type { Gestures, Vec3 } from './description.ts';
import type { SceneGraph } from './sceneGraph.ts';
import type { XrButtonName, XrHand, XrMesh, XrPlane, XrStickDirection } from './xrInput.ts';

/** Modifier keys held during an input, as on `MouseEvent`. */
export type Modifiers = {
  readonly shift: boolean;
  readonly control: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
};

/**
 * Pointer input in normalised device coordinates. `button` follows `MouseEvent.button`.
 * `pointer` is the input's `PointerEvent.pointerId` (0 when absent): with two pointers
 * pressed (two fingers), the second only takes part in pinches.
 */
export type PointerInput =
  | {
      readonly _tag: 'PointerMove';
      readonly x: number;
      readonly y: number;
      readonly pointer?: number;
    }
  | {
      readonly _tag: 'PointerDown';
      readonly x: number;
      readonly y: number;
      readonly button: number;
      readonly pointer?: number;
      readonly modifiers?: Modifiers;
    }
  | {
      readonly _tag: 'PointerUp';
      readonly x: number;
      readonly y: number;
      readonly button: number;
      readonly pointer?: number;
    }
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
      /** In CSS pixels: line and page deltas are converted, as three.js's controls do. */
      readonly deltaX: number;
      readonly deltaY: number;
      readonly modifiers?: Modifiers;
    }
  | { readonly _tag: 'PointerLeave' };

/**
 * A gesture on the canvas, reported when the scene claims gestures (`gestures: 'scene'`).
 * Distances are CSS pixels, right and down positive, since the previous gesture event;
 * `width` and `height` are the CSS size of the canvas, or of the view the gesture began
 * in, for turning pixels into angles and distances. `view` names that view. `x` and `y`
 * locate the gesture in it (−1 to 1, y up): where a drag was pressed, the wheel turned,
 * or a pinch's midpoint is, for zooming toward the cursor.
 *
 * - `Drag`: the pointer moved while pressed, with the button and modifiers of the press.
 *   `key` names the interactive mesh the press landed on, if any, so a Model can leave
 *   the camera alone while that mesh is dragged.
 * - `Wheel`: the wheel turned, anywhere over the canvas.
 * - `Pinch`: two pointers moved: `scale` is their new distance over the old (above 1
 *   when spreading), and the deltas are how far their midpoint moved.
 */
export type Gesture =
  | {
      readonly _tag: 'Drag';
      readonly button: number;
      readonly modifiers: Modifiers;
      readonly key?: string;
      readonly view?: string;
      readonly deltaX: number;
      readonly deltaY: number;
      readonly width: number;
      readonly height: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly _tag: 'Wheel';
      readonly modifiers: Modifiers;
      readonly view?: string;
      readonly deltaX: number;
      readonly deltaY: number;
      readonly width: number;
      readonly height: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly _tag: 'Pinch';
      readonly view?: string;
      readonly scale: number;
      readonly deltaX: number;
      readonly deltaY: number;
      readonly width: number;
      readonly height: number;
      readonly x: number;
      readonly y: number;
    };

/** No modifier keys held. */
export const noModifiers: Modifiers = { shift: false, control: false, meta: false, alt: false };

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
  /** A drag, wheel or pinch on the canvas, when the scene claims gestures. */
  | { readonly _tag: 'Gesture'; readonly gesture: Gesture }
  /**
   * A gesture that moved has ended: released, or the pointer left. Only after a `Drag`
   * or `Pinch`, with the press's button, modifiers, mesh and view: the moment to finish
   * what the gesture drew, such as a selection box.
   */
  | {
      readonly _tag: 'GestureEnd';
      readonly button: number;
      readonly modifiers: Modifiers;
      readonly key?: string;
      readonly view?: string;
    }
  /**
   * A gesture is about to begin on a camera that has turned by itself (`autoRotate`):
   * where it got to, so the Model can keep it (`autoRotated(camera, detail)`) and the
   * gesture moves on from there. `view` names a view's camera; without it, the scene's.
   */
  | { readonly _tag: 'AutoRotated'; readonly view?: string; readonly position: Vec3 }
  /** In an immersive session, a thumbstick pushed past halfway in a direction, or let back. */
  | { readonly _tag: 'XrStick'; readonly hand: XrHand; readonly direction: XrStickDirection }
  /** In an immersive session, a controller button pressed or released. */
  | {
      readonly _tag: 'XrButton';
      readonly hand: XrHand;
      readonly button: XrButtonName;
      readonly pressed: boolean;
    }
  /**
   * Gliding with the sticks (`xr({ glide })`) stopped: where the player stands, to keep
   * in the Model's `xr({ origin, heading })`.
   */
  | { readonly _tag: 'XrMoved'; readonly origin: Vec3; readonly heading: number }
  /** The session's detected planes changed (`xr({ planes: true })`): all of them, now. */
  | { readonly _tag: 'XrPlanes'; readonly planes: ReadonlyArray<XrPlane> }
  /** The session's detected meshes changed (`xr({ meshes: true })`): all of them, now. */
  | { readonly _tag: 'XrMeshes'; readonly meshes: ReadonlyArray<XrMesh> }
  /** In AR, a select whose ray met a real surface (`xr({ hitTest: true })`). */
  | {
      readonly _tag: 'XrSurface';
      readonly hand: XrHand;
      readonly point: Vec3;
      readonly normal: Vec3;
    }
  /**
   * Two bodies began (`started`) or stopped touching, by their nodes' keys (and, for a body
   * on an instance, the instance's): Rapier's collision events, as react-three-rapier's
   * `onCollisionEnter` and `onCollisionExit`. Not a pointer event: it travels with them so
   * one stream carries everything.
   */
  | {
      readonly _tag: 'Collision';
      readonly a: string;
      readonly aInstance?: string;
      readonly aPart?: string;
      readonly b: string;
      readonly bInstance?: string;
      readonly bPart?: string;
      readonly started: boolean;
    }
  /**
   * Two bodies pushed on each other harder than a body's `contactForces` threshold during
   * a step: react-three-rapier's `onContactForce` payload, named as collisions are.
   */
  | {
      readonly _tag: 'ContactForce';
      readonly a: string;
      readonly aInstance?: string;
      readonly aPart?: string;
      readonly b: string;
      readonly bInstance?: string;
      readonly bPart?: string;
      readonly totalForce: Vec3;
      readonly totalForceMagnitude: number;
      readonly maxForceDirection: Vec3;
      readonly maxForceMagnitude: number;
    }
  /**
   * A measured label's laid-out size changed (`scene({ measure })`, after its glyphs are
   * laid out): in its own units, before its scale, for sizing what goes behind it, as
   * Drei's `Text` `onSync` reads troika's `textRenderInfo`.
   */
  | {
      readonly _tag: 'LabelMeasured';
      readonly key: string;
      readonly block: readonly [number, number, number, number];
      readonly visible: readonly [number, number, number, number];
    }
  /**
   * A measured node's world bounding box changed (`scene({ measure })`): Drei's `Bounds`
   * `box.setFromObject`, reported rather than read. Not a pointer event either.
   */
  | {
      readonly _tag: 'Measured';
      readonly key: string;
      readonly min: Vec3;
      readonly max: Vec3;
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
  /** Hit-tests along a world-space ray: an XR controller's, say. */
  readonly pickRay: (ray: Ray) => Hit | undefined;
  /** The picked graph's viewport in CSS pixels, for pixel thresholds. */
  readonly viewport: () => { readonly width: number; readonly height: number };
  /**
   * The CSS size of what is under NDC `(x, y)`: the view there, with its key, or the
   * whole canvas.
   */
  readonly region: (x: number, y: number) => Region;
  /** Whether the scene claims the pointer's gestures. */
  readonly gestures: () => Gestures;
  /** Holds the cameras' turning (`autoRotate`) while a gesture is pressed. */
  readonly holdCameras: (held: boolean) => void;
  /** Where turning has taken a view's camera (or the scene's), if it has turned. */
  readonly turned: (view: string | undefined) => Vec3 | undefined;
};

/** A part of the canvas in CSS pixels: a view, named by `view`, or the whole canvas. */
export type Region = {
  readonly view?: string;
  readonly width: number;
  readonly height: number;
  /** The point in the region's own normalised coordinates: −1 to 1, y up. */
  readonly x: number;
  readonly y: number;
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

/** Whether an object and every ancestor are visible. */
const shown = (object: Object3D): boolean => {
  for (let at: Object3D | null = object; at !== null; at = at.parent) if (!at.visible) return false;
  return true;
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
  // A world-space ray's origin and direction, as `Raycaster.set` takes them.
  const rayOrigin = new Vector3();
  const rayDirection = new Vector3();

  /** The nearest keyed hit along the raycaster's ray, reporting `view` when there is one. */
  const nearestHit = (view: string | undefined): Hit | undefined => {
    // Recursive, so an interactive group makes every mesh inside it pickable.
    for (const intersection of raycaster.intersectObjects(graph.interactiveObjects(), true)) {
      // Hidden things are not hit: a level of detail not showing, as three's `LOD.raycast`.
      if (!shown(intersection.object)) continue;
      const owner = keyedOwner(graph, intersection.object);
      const key = owner === undefined ? undefined : graph.keyOf(owner);
      if (owner !== undefined && key !== undefined) {
        normal.set(0, 0, 0);
        if (intersection.face) {
          normal.copy(intersection.face.normal).transformDirection(intersection.object.matrixWorld);
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
    region: (x, y) => {
      const { width, height } = graph.viewport();
      const px = ((x + 1) / 2) * width;
      const py = ((1 - y) / 2) * height;
      const view = graph
        .views()
        .findLast(
          ({ area }) =>
            px >= area.x && px <= area.x + area.width && py >= area.y && py <= area.y + area.height,
        );
      return view === undefined
        ? { width, height, x, y }
        : {
            view: view.key,
            width: view.area.width,
            height: view.area.height,
            x: ((px - view.area.x) / view.area.width) * 2 - 1,
            y: 1 - ((py - view.area.y) / view.area.height) * 2,
          };
    },
    gestures: graph.gestures,
    holdCameras: graph.holdCameras,
    turned: graph.turned,
    pick: (x, y) => {
      if (graph.interactiveObjects().length === 0) return undefined;
      const view = aim(x, y);
      if (view === false) return undefined;
      return nearestHit(view);
    },
    pickRay: (ray) => {
      if (graph.interactiveObjects().length === 0) return undefined;
      graph.scene.updateMatrixWorld();
      raycaster.set(
        rayOrigin.fromArray(ray.origin),
        rayDirection.fromArray(ray.direction).normalize(),
      );
      return nearestHit(undefined);
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

/** The press a gesture began with: its button, modifiers, mesh and region. */
type GesturePress = Region & {
  readonly button: number;
  readonly modifiers: Modifiers;
  readonly key?: string;
};

type Point = { readonly x: number; readonly y: number };

const pointerOf = (input: PointerInput): number =>
  'pointer' in input && input.pointer !== undefined ? input.pointer : 0;

/** Creates the pointer state machine for one scene. */
export const createPointerTracker = (picker: Picker): PointerTracker => {
  let position: { x: number; y: number } | undefined;
  // Pressed pointers in NDC, for gestures. The first pressed is primary and drives the
  // press, click and drag machinery; others only take part in pinches.
  const pressedPointers = new Map<number, Point>();
  let primary: number | undefined;
  let gesturePress: GesturePress | undefined;
  // Whether the gesture press has moved: only then does its release end a gesture.
  let gestureMoved = false;
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

  /** NDC distance to CSS pixels on the canvas, down positive. */
  const pixels = (from: Point, to: Point): Point => {
    const { width, height } = picker.viewport();
    return { x: ((to.x - from.x) * width) / 2, y: (-(to.y - from.y) * height) / 2 };
  };

  const pixelDistance = (a: Point, b: Point): number => {
    const { x, y } = pixels(a, b);
    return Math.hypot(x, y);
  };

  /** Reports where the camera under `region` has turned to, before a gesture on it. */
  const reportTurned = (region: Region, events: Array<SceneEvent>): void => {
    const position = picker.turned(region.view);
    if (position === undefined) return;
    events.push({
      _tag: 'AutoRotated',
      ...(region.view === undefined ? {} : { view: region.view }),
      position,
    });
  };

  /** A gesture press begins: the first pointer down while the scene claims gestures. */
  const beginGesture = (
    event: Extract<PointerInput, { readonly _tag: 'PointerDown' }>,
    id: number,
    key: string | undefined,
    events: Array<SceneEvent>,
  ): void => {
    if (picker.gestures() !== 'scene') return;
    pressedPointers.clear();
    primary = id;
    pressedPointers.set(id, { x: event.x, y: event.y });
    gestureMoved = false;
    const region = picker.region(event.x, event.y);
    reportTurned(region, events);
    // Cameras turning by themselves hold still while it is pressed, as `OrbitControls`.
    picker.holdCameras(true);
    gesturePress = {
      ...region,
      button: event.button,
      modifiers: event.modifiers ?? noModifiers,
      ...(key === undefined ? {} : { key }),
    };
  };

  /** Moves pointer `id` to `to`: a drag with one pointer pressed, a pinch with two. */
  const moveGesture = (id: number, to: Point, events: Array<SceneEvent>): void => {
    const from = pressedPointers.get(id);
    if (from === undefined || gesturePress === undefined) return;
    pressedPointers.set(id, to);
    gestureMoved = true;
    const { view, width, height, x, y } = gesturePress;
    const region = { ...(view === undefined ? {} : { view }), width, height, x, y };
    const moved = pixels(from, to);
    const other = [...pressedPointers].find(([pointer]) => pointer !== id)?.[1];
    if (other === undefined) {
      if (id !== primary) return;
      const { button, modifiers, key } = gesturePress;
      events.push({
        _tag: 'Gesture',
        gesture: {
          _tag: 'Drag',
          button,
          modifiers,
          ...(key === undefined ? {} : { key }),
          ...region,
          deltaX: moved.x,
          deltaY: moved.y,
        },
      });
      return;
    }
    const before = pixelDistance(from, other);
    const after = pixelDistance(to, other);
    const middle = picker.region((to.x + other.x) / 2, (to.y + other.y) / 2);
    events.push({
      _tag: 'Gesture',
      gesture: {
        _tag: 'Pinch',
        ...region,
        x: middle.x,
        y: middle.y,
        scale: before === 0 ? 1 : after / before,
        // The midpoint moves half as far as the one pointer that moved.
        deltaX: moved.x / 2,
        deltaY: moved.y / 2,
      },
    });
  };

  const endGestures = (events: Array<SceneEvent>): void => {
    if (gesturePress !== undefined) picker.holdCameras(false);
    if (gesturePress !== undefined && gestureMoved) {
      const { button, modifiers, key, view } = gesturePress;
      events.push({
        _tag: 'GestureEnd',
        button,
        modifiers,
        ...(key === undefined ? {} : { key }),
        ...(view === undefined ? {} : { view }),
      });
    }
    pressedPointers.clear();
    primary = undefined;
    gesturePress = undefined;
    gestureMoved = false;
  };

  /**
   * Input from a pointer other than the primary one while that is pressed: it joins,
   * pinches or leaves, and touches nothing else.
   */
  const secondary = (event: PointerInput, id: number): ReadonlyArray<SceneEvent> => {
    const events: Array<SceneEvent> = [];
    if (event._tag === 'PointerDown' && gesturePress !== undefined) {
      pressedPointers.set(id, { x: event.x, y: event.y });
    } else if (event._tag === 'PointerMove') {
      moveGesture(id, event, events);
    } else if (event._tag === 'PointerUp') {
      pressedPointers.delete(id);
    }
    return events;
  };

  const isSecondary = (event: PointerInput, id: number): boolean =>
    primary !== undefined &&
    id !== primary &&
    (event._tag === 'PointerDown' ||
      ((event._tag === 'PointerMove' || event._tag === 'PointerUp') && pressedPointers.has(id)));

  const input = (event: PointerInput): ReadonlyArray<SceneEvent> => {
    const id = pointerOf(event);
    if (isSecondary(event, id)) return secondary(event, id);
    const events: Array<SceneEvent> = [];
    if (event._tag === 'PointerLeave') {
      endGestures(events);
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
        moveGesture(id, event, events);
        break;
      case 'PointerDown':
        press = { key: hit?.key, button: event.button, x: event.x, y: event.y };
        pressing = true;
        dragged = false;
        if (hit !== undefined) events.push({ _tag: 'PointerDown', button: event.button, ...hit });
        beginGesture(event, id, hit?.key, events);
        break;
      case 'PointerUp':
        release(hit, event, events);
        // Any release ends capture: a mouse's buttons share one pointer.
        endDrag(drag, event.x, event.y, events);
        endGestures(events);
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
        if (picker.gestures() === 'scene') {
          const region = picker.region(event.x, event.y);
          // The wheel does not hold turning still, as `OrbitControls` keeps turning on it.
          reportTurned(region, events);
          events.push({
            _tag: 'Gesture',
            gesture: {
              _tag: 'Wheel',
              modifiers: event.modifiers ?? noModifiers,
              ...region,
              deltaX: event.deltaX,
              deltaY: event.deltaY,
            },
          });
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
