/**
 * A viewport gizmo as an Effect UI submodel (roadmap, "Beyond parity" 5), after Drei's
 * `GizmoHelper` with `GizmoViewport`: the core's `viewportGizmoNodes` in a scene's
 * `hud`, its heads highlighted under the pointer, and a press on one turning the camera
 * to look from that axis. The parent owns the camera; the submodel owns the highlight:
 *
 * - `Entered` and `Left` (the scene's pointer enter and leave, with the hit key)
 *   highlight a head, and clear it;
 * - `Pressed` (a pointer down, with the hit key and the camera) reports
 *   `Turned { camera }`, the camera looking from that head's axis, for the parent to
 *   keep. A camera with `damping` eases round to it, as Drei's tween does.
 *
 * `hud(model, camera)` is the scene's HUD with the gizmo in it; `nodes` the gizmo alone,
 * for a HUD with more in it.
 *
 * @module
 */

import { UiSchema } from '@effect/ui';
import { ViewportGizmo as Controller } from '@opsydyn/effect-three/browser';

export const { Model, init, axisOf, nodes, hud } = Controller;
export type Model = Controller.Model;

export const Message = UiSchema.TaggedEnum(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const update = Controller.update;
