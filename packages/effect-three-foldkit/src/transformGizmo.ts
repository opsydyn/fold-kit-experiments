/**
 * A transform gizmo as a Foldkit submodel (roadmap, "Beyond parity" 5): the core's pure
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
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

import * as Controller from './controllers/transformGizmo.ts';
import type { Model } from './controllers/transformGizmo.ts';

export { Model, init, handleOf, held, nodes } from './controllers/transformGizmo.ts';

export const Message = defineMessageUnion(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

export const update = (model: Model, message: Message): Return => Controller.update(model, message);
