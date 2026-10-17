/**
 * XR input as the scene's events: controllers and hands pointing, selecting, dragging,
 * pushing sticks and pressing buttons, and (in AR) selecting a real surface.
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`. Its pointers ray-cast along each input
 * source's target ray every frame (`packages/xr/src/pointer`), entering and leaving what
 * they point at, capturing the object a select starts on so moving drags it, and turning
 * select start and end into pointer down, up and click. Its controller locomotion
 * (`controller-locomotion.ts`) reads the thumbstick each frame; here a stick reports when
 * it is pushed past halfway in a direction and when it comes back, so a Model can snap
 * turn and teleport by changing `xr({ origin, heading })`.
 *
 * @module
 */
import type { Vec3 } from './description.ts';
import type { Hit, Picker, Ray, SceneEvent } from './pointer.ts';

/** Which hand an input source is held in or is, as WebXR's `handedness`. */
export type XrHand = 'left' | 'right' | 'none';

/** Where a thumbstick is pushed: `forward` is away from the player. */
export type XrStickDirection = 'center' | 'left' | 'right' | 'forward' | 'back';

/**
 * A controller's buttons, by the `xr-standard` gamepad mapping: the trigger, the grip
 * (`squeeze`), a touchpad, the thumbstick pressed, and the face buttons (A and B on the
 * right controller, X and Y on the left: `primary` and `secondary`).
 */
export type XrButtonName =
  | 'trigger'
  | 'squeeze'
  | 'touchpad'
  | 'thumbstick'
  | 'primary'
  | 'secondary';

/** Input from an immersive session, each from an input source (`source` tells them apart). */
export type XrInput =
  /** A select (the trigger, or a pinch) beginning or ending, along the source's ray. */
  | { readonly _tag: 'SelectStart' | 'SelectEnd'; readonly source: number; readonly ray: Ray }
  /** Where the source points this frame. */
  | { readonly _tag: 'Aim'; readonly source: number; readonly ray: Ray }
  /** The source went away (put down, or the session ended). */
  | { readonly _tag: 'Lost'; readonly source: number }
  | {
      readonly _tag: 'Stick';
      readonly source: number;
      readonly hand: XrHand;
      readonly direction: XrStickDirection;
    }
  | {
      readonly _tag: 'Button';
      readonly source: number;
      readonly hand: XrHand;
      readonly button: XrButtonName;
      readonly pressed: boolean;
    }
  /** In AR, a select whose ray met a real surface: where, and the surface's normal. */
  | {
      readonly _tag: 'Surface';
      readonly source: number;
      readonly hand: XrHand;
      readonly point: Vec3;
      readonly normal: Vec3;
    };

/** One source's state: what it points at, the select it holds, and its last ray. */
type Source = {
  hovered: string | undefined;
  /** The key a held select started on (`undefined` for nothing) and its ray, while held. */
  pressed: { readonly key: string | undefined; readonly ray: Ray } | undefined;
  dragged: boolean;
  ray: Ray | undefined;
};

const none: ReadonlyArray<SceneEvent> = [];

/**
 * How far a held source must move before it drags, as the mouse must travel a few pixels:
 * its ray turned by a degree, or moved a centimetre. Hands and controllers never hold
 * perfectly still, and a select that does not move is a click.
 */
const dragStart = { turn: Math.cos((1 * Math.PI) / 180), shift: 0.01 } as const;

const moved = (from: Ray, to: Ray): boolean => {
  const [a, b, c] = from.direction;
  const [x, y, z] = to.direction;
  const [p, q, r] = from.origin;
  const [u, v, w] = to.origin;
  return (
    a * x + b * y + c * z < dragStart.turn || Math.hypot(u - p, v - q, w - r) > dragStart.shift
  );
};

/** Creates the tracker turning one session's XR input into scene events. */
export const createXrTracker = (picker: Picker) => {
  const sources = new Map<number, Source>();

  const sourceOf = (id: number): Source => {
    const known = sources.get(id);
    if (known !== undefined) return known;
    const created: Source = {
      hovered: undefined,
      pressed: undefined,
      dragged: false,
      ray: undefined,
    };
    sources.set(id, created);
    return created;
  };

  /** Leaves and enters as what the source points at changes. */
  const hover = (source: Source, hit: Hit | undefined, events: Array<SceneEvent>): void => {
    const next = hit?.key;
    if (next === source.hovered) return;
    if (source.hovered !== undefined) events.push({ _tag: 'PointerLeave', key: source.hovered });
    if (hit !== undefined) events.push({ _tag: 'PointerEnter', ...hit });
    source.hovered = next;
  };

  const aim = (source: Source, ray: Ray): ReadonlyArray<SceneEvent> => {
    source.ray = ray;
    const events: Array<SceneEvent> = [];
    const pressed = source.pressed;
    // A select held on a mesh captures it: moving drags it, wherever the ray now points.
    if (pressed?.key !== undefined && (source.dragged || moved(pressed.ray, ray))) {
      source.dragged = true;
      events.push({ _tag: 'Drag', key: pressed.key, button: 0, ray });
    }
    hover(source, picker.pickRay(ray), events);
    return events;
  };

  const selectStart = (source: Source, ray: Ray): ReadonlyArray<SceneEvent> => {
    const hit = picker.pickRay(ray);
    source.pressed = { key: hit?.key, ray };
    source.dragged = false;
    return hit === undefined ? none : [{ _tag: 'PointerDown', button: 0, ...hit }];
  };

  const selectEnd = (source: Source, ray: Ray): ReadonlyArray<SceneEvent> => {
    const from = source.pressed?.key;
    const dragged = source.dragged;
    source.pressed = undefined;
    source.dragged = false;
    const events: Array<SceneEvent> = [];
    if (from !== undefined && dragged) events.push({ _tag: 'DragEnd', key: from, button: 0, ray });
    const hit = picker.pickRay(ray);
    if (hit === undefined) {
      if (from === undefined) events.push({ _tag: 'PointerMissed', button: 0 });
      return events;
    }
    events.push({ _tag: 'PointerUp', button: 0, ...hit });
    if (from === hit.key) events.push({ _tag: 'Click', button: 0, ...hit });
    return events;
  };

  /** A source gone: it leaves what it pointed at, and a drag ends where it last aimed. */
  const lost = (id: number): ReadonlyArray<SceneEvent> => {
    const source = sources.get(id);
    sources.delete(id);
    if (source === undefined) return none;
    const events: Array<SceneEvent> = [];
    const held = source.pressed?.key;
    if (held !== undefined && source.dragged && source.ray !== undefined) {
      events.push({ _tag: 'DragEnd', key: held, button: 0, ray: source.ray });
    }
    if (source.hovered !== undefined) events.push({ _tag: 'PointerLeave', key: source.hovered });
    return events;
  };

  return (input: XrInput): ReadonlyArray<SceneEvent> => {
    switch (input._tag) {
      case 'Aim':
        return aim(sourceOf(input.source), input.ray);
      case 'SelectStart':
        return selectStart(sourceOf(input.source), input.ray);
      case 'SelectEnd':
        return selectEnd(sourceOf(input.source), input.ray);
      case 'Lost':
        return lost(input.source);
      case 'Stick':
        return [{ _tag: 'XrStick', hand: input.hand, direction: input.direction }];
      case 'Button':
        return [
          { _tag: 'XrButton', hand: input.hand, button: input.button, pressed: input.pressed },
        ];
      case 'Surface':
        return [{ _tag: 'XrSurface', hand: input.hand, point: input.point, normal: input.normal }];
    }
  };
};
