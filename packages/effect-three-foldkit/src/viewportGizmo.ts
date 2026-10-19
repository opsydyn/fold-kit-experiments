/**
 * A viewport gizmo as a Foldkit submodel (roadmap, "Beyond parity" 5), after Drei's
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
import {
  type Camera,
  cameraAlong,
  hud as describeHud,
  type Hud,
  type HudAlignment,
  SceneSchema,
  type SceneNode,
  type ViewAxis,
  viewportAxisOf,
  viewportGizmoNodes,
} from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

const Axis = Schema.Literals(['x', 'y', 'z', '-x', '-y', '-z']);

export const Model = Schema.Struct({
  /** The key its nodes are drawn under: `${key}:x`, `${key}:-y` and so on. */
  key: Schema.String,
  /** The head under the pointer. */
  hovered: Schema.NullOr(Axis),
  /** Leaves out the negative heads. */
  hideNegativeAxes: Schema.Boolean,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  Entered: { key: Schema.String },
  Left: { key: Schema.String },
  Pressed: { key: Schema.String, camera: SceneSchema.Camera },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** The camera, looking from the axis of the head pressed. */
  Turned: { camera: SceneSchema.Camera },
});
export type OutMessage = typeof OutMessage.Type;

/** A gizmo drawn under `key`, every head shown unless `hideNegativeAxes`. */
export const init = (
  key: string,
  options: { readonly hideNegativeAxes?: boolean } = {},
): Model => ({
  key,
  hovered: null,
  hideNegativeAxes: options.hideNegativeAxes ?? false,
});

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

/** Which head a hit `key` is on, if it is one of this gizmo's. */
export const axisOf = (model: Model, key: string): Option.Option<ViewAxis> =>
  Option.fromNullishOr(viewportAxisOf(model.key, key));

const entered = (model: Model, key: string): Model =>
  Option.match(axisOf(model, key), {
    onNone: () => model,
    onSome: (axis) => ({ ...model, hovered: axis }),
  });

/** Leaving a head clears the highlight; leaving anything else changes nothing. */
const left = (model: Model, key: string): Model =>
  Option.match(axisOf(model, key), {
    onNone: () => model,
    onSome: () => ({ ...model, hovered: null }),
  });

const pressed = (model: Model, key: string, camera: Camera): Return =>
  Option.match(axisOf(model, key), {
    onNone: () => ({ model }),
    onSome: (axis) => ({
      model,
      outMessage: OutMessage.Turned({ camera: cameraAlong(camera, axis) }),
    }),
  });

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    Entered: ({ key }) => ({ model: entered(model, key) }),
    Left: ({ key }) => ({ model: left(model, key) }),
    Pressed: ({ key, camera }) => pressed(model, key, camera),
  });

/** The gizmo for `camera`, for a HUD. */
export const nodes = (model: Model, camera: Camera): SceneNode =>
  viewportGizmoNodes(model.key, camera, {
    hovered: model.hovered,
    hideNegativeAxes: model.hideNegativeAxes,
  });

/** A HUD holding only the gizmo, 80 pixels in from the bottom right unless placed. */
export const hud = (
  model: Model,
  camera: Camera,
  placement: {
    readonly alignment?: HudAlignment;
    readonly margin?: readonly [number, number];
  } = {},
): Hud => describeHud({ ...placement, children: [nodes(model, camera)] });
