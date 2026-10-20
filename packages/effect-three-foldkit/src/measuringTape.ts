/**
 * A measuring tape as a Foldkit submodel (roadmap, "Beyond parity" 5): the core's pure
 * `tape` with Messages for clicks and pointer moves on the scene, an OutMessage when a
 * length is measured, and its length as HTML at the tape's middle. The parent decides
 * when the tape is in use and which clicks are on the scene:
 *
 * - `Placed` (a click on the scene, with the point it hit) places an end, or starts a
 *   new tape; placing the second reports `Measured { from, to, length }`;
 * - `Pointed` (the pointer moving over the scene, or `null` off it) runs the tape to
 *   the pointer while the second end is placed;
 * - `Cleared` empties it; `ChoseSnap` rounds new ends to a step, or not.
 *
 * `nodes(model)` draws it for the scene and `label(model, h)` is the length for the
 * view's `overlays`.
 *
 * @module
 */
import {
  clearTape,
  overlay,
  placeTapeEnd,
  pointTape,
  SceneSchema,
  type SceneNode,
  tape,
  tapeLength,
  type TapeLook,
  tapeMiddle,
  tapeNodes,
} from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

import type { OverlayView } from './overlayView.ts';

export const Model = Schema.Struct({
  /** The key its nodes and label are drawn under. */
  key: Schema.String,
  tape: SceneSchema.Tape,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  Placed: { point: SceneSchema.Vec3 },
  Pointed: { point: Schema.NullOr(SceneSchema.Vec3) },
  Cleared: {},
  ChoseSnap: { snap: SceneSchema.Tape.fields.snap },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** Both ends are placed: where, and how far apart. */
  Measured: { from: SceneSchema.Vec3, to: SceneSchema.Vec3, length: Schema.Finite },
});
export type OutMessage = typeof OutMessage.Type;

/** An empty tape drawn under `key`, snapping to `snap` when given. */
export const init = (key: string, options: { readonly snap?: number | null } = {}): Model => ({
  key,
  tape: tape(options),
});

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

/** The OutMessage for a tape that has just been measured, if it has. */
const measured = (next: Model): Return =>
  Option.match(
    Option.all([Option.fromNullishOr(next.tape.from), Option.fromNullishOr(next.tape.to)]),
    {
      onNone: () => ({ model: next }),
      onSome: ([from, to]) => ({
        model: next,
        outMessage: OutMessage.Measured({ from, to, length: tapeLength(next.tape) ?? 0 }),
      }),
    },
  );

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    Placed: ({ point }) => measured({ ...model, tape: placeTapeEnd(model.tape, point) }),
    Pointed: ({ point }) => ({ model: { ...model, tape: pointTape(model.tape, point) } }),
    Cleared: () => ({ model: { ...model, tape: clearTape(model.tape) } }),
    ChoseSnap: ({ snap }) => ({ model: { ...model, tape: { ...model.tape, snap } } }),
  });

/** The tape's length, while it has one (to the pointer while the second end is placed). */
export const length = (model: Model): Option.Option<number> =>
  Option.fromNullishOr(tapeLength(model.tape));

/** The tape, for the parent's scene. */
export const nodes = (model: Model, look: Partial<TapeLook> = {}): SceneNode =>
  tapeNodes(model.key, model.tape, look);

/** The label's class, when one is given. */
const classOf = <Message>(h: HtmlBuilder<Message>, className: string | undefined) =>
  Option.match(Option.fromNullishOr(className), {
    onNone: () => [],
    onSome: (name) => [h.Class(name)],
  });

/**
 * The length at the tape's middle, for the view's `overlays`: two decimals and `unit`
 * (`m` unless given), in an element with the class `className` (unstyled unless given).
 * Pointer events pass through it to the scene.
 */
export const label = <Message>(
  model: Model,
  h: HtmlBuilder<Message>,
  options: { readonly unit?: string; readonly className?: string } = {},
): ReadonlyArray<OverlayView> =>
  Option.match(Option.all([length(model), Option.fromNullishOr(tapeMiddle(model.tape))]), {
    onNone: () => [],
    onSome: ([measuredLength, middle]) => [
      {
        overlay: overlay({ key: `${model.key}:label`, position: middle, center: true }),
        content: h.span(classOf(h, options.className), [
          `${measuredLength.toFixed(2)} ${options.unit ?? 'm'}`,
        ]),
        pointerEvents: 'none',
      },
    ],
  });
