/** Framework-independent Three controller. */
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

export const MessageFields = {
  Entered: { key: Schema.String },
  Left: { key: Schema.String },
  Pressed: { key: Schema.String, camera: SceneSchema.Camera },
} as const;
export const Message = Schema.TaggedUnion(MessageFields);
export type Message = typeof Message.Type;

export const OutMessageFields = {
  /** The camera, looking from the axis of the head pressed. */
  Turned: { camera: SceneSchema.Camera },
} as const;
export const OutMessage = Schema.TaggedUnion(OutMessageFields);
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

type Return = { readonly model: Model; readonly outMessage?: OutMessage };

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
      outMessage: OutMessage.cases.Turned.make({ camera: cameraAlong(camera, axis) }),
    }),
  });

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
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
