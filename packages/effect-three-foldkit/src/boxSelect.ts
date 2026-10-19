/**
 * Box selection as a Foldkit submodel (roadmap, "Beyond parity" 5), after Drei's `Select`
 * over three.js's `SelectionBox`: a shift-drag that begins on nothing draws a box, and
 * its release selects what the box holds, through the core's pure `boxSelect`. The parent
 * owns what is selected; the submodel owns only the box:
 *
 * - `Dragged` (each scene `Drag` gesture the box `claims`, made with `dragOf`) starts the box
 *   where the press was and moves its far corner by the gesture's deltas;
 * - `Ended` (the scene's `GestureEnd`, with the camera and what can be selected) reports
 *   `Selected { keys }`, which replaces the selection as Drei's box does, and clears the
 *   box;
 * - `Cancelled` clears the box and selects nothing.
 *
 * `rectangle(model)` places the box on the canvas in CSS pixels, for an HTML outline, and
 * `inside(model, camera, selectable)` says what the box holds so far, for highlighting
 * while it is drawn (Drei selects as the box moves).
 *
 * @module
 */
import { boxSelect, type Camera, type Gesture, SceneSchema } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

const Corner = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });

/** Something the box can select: its key, and the point that must fall inside. */
const Selectable = Schema.Struct({ key: Schema.String, at: SceneSchema.Vec3 });

/** A box being drawn: its corners in the canvas's normalised coordinates, −1 to 1, y up. */
export const Box = Schema.Struct({
  from: Corner,
  to: Corner,
  width: Schema.Finite,
  height: Schema.Finite,
});
export type Box = typeof Box.Type;

export const Model = Schema.Struct({ box: Schema.Option(Box) });
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  Dragged: {
    x: Schema.Finite,
    y: Schema.Finite,
    deltaX: Schema.Finite,
    deltaY: Schema.Finite,
    width: Schema.Finite,
    height: Schema.Finite,
  },
  Ended: { camera: SceneSchema.Camera, selectable: Schema.Array(Selectable) },
  Cancelled: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** The box was let go: the keys inside it, for the new selection. */
  Selected: { keys: Schema.Array(Schema.String) },
});
export type OutMessage = typeof OutMessage.Type;

/** No box drawn. */
export const init = (): Model => ({ box: Option.none() });

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

/** The box with its far corner moved by a drag's CSS-pixel deltas (down positive). */
const moved = (box: Box, deltaX: number, deltaY: number): Box => ({
  ...box,
  to: { x: box.to.x + (deltaX * 2) / box.width, y: box.to.y - (deltaY * 2) / box.height },
});

const dragged = (model: Model, message: Extract<Message, { _tag: 'Dragged' }>): Model => {
  const { x, y, deltaX, deltaY, width, height } = message;
  const start: Box = { from: { x, y }, to: { x, y }, width, height };
  const box = Option.getOrElse(model.box, () => start);
  return { box: Option.some(moved(box, deltaX, deltaY)) };
};

type Selectables = ReadonlyArray<typeof Selectable.Type>;

const keysIn = (box: Box, camera: Camera, selectable: Selectables): ReadonlyArray<string> =>
  boxSelect(camera, box, box.from, box.to, selectable);

const ended = (model: Model, camera: Camera, selectable: Selectables): Return =>
  Option.match(model.box, {
    onNone: () => ({ model }),
    onSome: (box) => ({
      model: init(),
      outMessage: OutMessage.Selected({ keys: keysIn(box, camera, selectable) }),
    }),
  });

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    Dragged: (drag) => ({ model: dragged(model, drag) }),
    Ended: ({ camera, selectable }) => ended(model, camera, selectable),
    Cancelled: () => ({ model: init() }),
  });

/** Whether a box is being drawn: the parent leaves the camera alone while it is. */
export const drawing = (model: Model): boolean => Option.isSome(model.box);

/** A scene `Drag` gesture: the only kind a box takes. */
export type DragGesture = Extract<Gesture, { readonly _tag: 'Drag' }>;

/** The primary button: a box starts only with it. */
const primaryButton = 0;

/** A primary-button shift-drag that began on nothing starts a box. */
const startsBox = (drag: DragGesture): boolean =>
  drag.button === primaryButton && drag.modifiers.shift && drag.key === undefined;

/** Whether the box takes `drag`: every drag while one is drawn, and one that starts it. */
export const claims = (model: Model, drag: DragGesture): boolean =>
  drawing(model) || startsBox(drag);

/** The `Dragged` Message for a drag the box claims. */
export const dragOf = (gesture: DragGesture): Message =>
  Message.Dragged({
    x: gesture.x,
    y: gesture.y,
    deltaX: gesture.deltaX,
    deltaY: gesture.deltaY,
    width: gesture.width,
    height: gesture.height,
  });

/** What the box holds so far, seen through `camera`: none while no box is drawn. */
export const inside = (
  model: Model,
  camera: Camera,
  selectable: Selectables,
): ReadonlyArray<string> =>
  Option.match(model.box, {
    onNone: () => [],
    onSome: (box) => keysIn(box, camera, selectable),
  });

/** A box on the canvas, in CSS pixels from its top left. */
export type Rectangle = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const onCanvas = (box: Box): Rectangle => {
  const left = ((Math.min(box.from.x, box.to.x) + 1) / 2) * box.width;
  const right = ((Math.max(box.from.x, box.to.x) + 1) / 2) * box.width;
  const top = ((1 - Math.max(box.from.y, box.to.y)) / 2) * box.height;
  const bottom = ((1 - Math.min(box.from.y, box.to.y)) / 2) * box.height;
  return { left, top, width: right - left, height: bottom - top };
};

/** Where the box sits on the canvas, while one is drawn. */
export const rectangle = (model: Model): Option.Option<Rectangle> =>
  Option.map(model.box, onCanvas);
