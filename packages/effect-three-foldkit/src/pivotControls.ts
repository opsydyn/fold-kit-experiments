/**
 * Pivot controls as an Effect UI submodel (roadmap, "Beyond parity" 5): the core's pure
 * `pivotNodes`, `pressPivot` and `dragPivot` (after Drei's `PivotControls`) with
 * Messages for the scene's pointer events and OutMessages for what the parent does with
 * them, as `TransformGizmo` is for three's controls. The parent owns where its objects
 * are; the submodel owns only the handles:
 *
 * - `Pressed` (a pointer down on one of its handles, with the point it hit and the
 *   object's placement) takes hold;
 * - `Dragged` reports `Moved { placement }` for the parent to apply (`snap` rounds turns
 *   to ten degrees and scales to tenths, as Drei's shift does);
 * - `Released` lets go and reports `Finished { placement }`, a step for history;
 * - `Hovered` highlights a handle.
 *
 * `handleOf(model, key)` says whether a hit is on a handle, and `nodes(model, placement)`
 * draws them.
 *
 * @module
 */

import { UiSchema } from '@effect/ui';
import { PivotControls as Controller } from '@opsydyn/effect-three/browser';

export const { Model, init, handleOf, held, nodes } = Controller;
export type Model = Controller.Model;

export const Message = UiSchema.TaggedEnum(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const update = Controller.update;
