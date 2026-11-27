/**
 * A transform gizmo as an Effect UI submodel (roadmap, "Beyond parity" 5): the core's pure
 * gizmo (`gizmoNodes`, `pressGizmo`, `dragGizmo`, after three's `TransformControls`)
 * with Messages for the scene's pointer events and OutMessages for what the parent does
 * with them. The parent owns where its objects are; the submodel owns only the gizmo:
 *
 * - `Pressed` (a press on one of its handles, with the object's placement and the
 *   camera) takes hold;
 * - `Dragged` reports `Moved { placement }` for the parent to apply;
 * - `Released` lets go and reports `Finished { placement }`, the moment to record a step
 *   of history;
 * - `Hovered` highlights a handle; `ChoseMode` and `ChoseSpace` switch them.
 *
 * `handleOf(model, key)` says whether a hit is on a handle, and `nodes(model, placement,
 * camera)` draws them, for the parent's scene and view.
 *
 * @module
 */

import { UiSchema } from '@effect/ui';
import { TransformGizmo as Controller } from '@opsydyn/effect-three/browser';

export const { Model, init, handleOf, held, nodes } = Controller;
export type Model = Controller.Model;

export const Message = UiSchema.TaggedEnum(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const update = Controller.update;
