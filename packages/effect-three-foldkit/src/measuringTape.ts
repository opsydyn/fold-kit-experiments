/**
 * A measuring tape as a Effect UI submodel (roadmap, "Beyond parity" 5): the core's pure
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
import { UiSchema } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { overlay, tapeMiddle } from '@opsydyn/effect-three';
import { MeasuringTape as Controller } from '@opsydyn/effect-three/browser';
import { Option } from 'effect';

import type { OverlayView } from './overlayView.ts';

export const { Model, init, length, nodes } = Controller;
export type Model = Controller.Model;

export const Message = UiSchema.TaggedEnum(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const update = Controller.update;

/**
 * The length at the tape's middle, for the view's `overlays`: two decimals and `unit`
 * (`m` unless given), in an element with the class `className` (unstyled unless given).
 * Pointer events pass through it to the scene.
 */
export const label = <Message>(
  model: Model,
  h: Html.H<Message>,
  options: { readonly unit?: string; readonly className?: string } = {},
): ReadonlyArray<OverlayView<Message>> =>
  Option.match(
    Option.all([Controller.length(model), Option.fromNullishOr(tapeMiddle(model.tape))]),
    {
      onNone: () => [],
      onSome: ([measuredLength, middle]) => [
        {
          overlay: overlay({ key: `${model.key}:label`, position: middle, center: true }),
          content: h.span
            .attr('class', options.className)
            .children(`${measuredLength.toFixed(2)} ${options.unit ?? 'm'}`),
          pointerEvents: 'none',
        },
      ],
    },
  );
