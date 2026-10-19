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
import {
  type Camera,
  dragGizmo,
  type Gizmo,
  gizmo,
  type GizmoHandle,
  gizmoHandleOf,
  gizmoNodes,
  hoverGizmo,
  type Placement,
  pressGizmo,
  releaseGizmo,
  SceneSchema,
  type SceneNode,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

export const Model = Schema.Struct({
  /** The key its handles are drawn under: `${key}:x`, `${key}:xy` and so on. */
  key: Schema.String,
  gizmo: SceneSchema.Gizmo,
  /** The placement the drag last reported, so `Released` can report where it ended. */
  last: Schema.Option(SceneSchema.Placement),
});
export type Model = typeof Model.Type;

const Handle = Schema.Literals(['x', 'y', 'z', 'xy', 'yz', 'xz', 'xyz']);

export const Message = defineMessageUnion({
  Pressed: {
    handle: Handle,
    origin: SceneSchema.Vec3,
    direction: SceneSchema.Vec3,
    placement: SceneSchema.Placement,
    camera: SceneSchema.Camera,
  },
  Dragged: { origin: SceneSchema.Vec3, direction: SceneSchema.Vec3 },
  Released: {},
  Hovered: { handle: Schema.NullOr(Handle) },
  ChoseMode: { mode: Schema.Literals(['translate', 'rotate', 'scale']) },
  ChoseSpace: { space: Schema.Literals(['world', 'local']) },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** The object's placement now, during a drag. */
  Moved: { placement: SceneSchema.Placement },
  /** The drag is over, the object here: a step for history. */
  Finished: { placement: SceneSchema.Placement },
});
export type OutMessage = typeof OutMessage.Type;

/** A gizmo drawn under `key`, with the core's defaults or the options given. */
export const init = (key: string, options: Parameters<typeof gizmo>[0] = {}): Model => ({
  key,
  gizmo: gizmo(options),
  last: Option.none(),
});

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

const withGizmo = (model: Model, next: Gizmo): Model => ({ ...model, gizmo: next });

const finished = (model: Model): Return => ({
  model: { ...withGizmo(model, releaseGizmo(model.gizmo)), last: Option.none() },
  ...Option.match(model.last, {
    onNone: () => ({}),
    onSome: (placement) => ({ outMessage: OutMessage.Finished({ placement }) }),
  }),
});

const dragged = (model: Model, origin: Vec3, direction: Vec3): Return => {
  const placement = Option.fromNullishOr(dragGizmo(model.gizmo, { origin, direction }));
  return Option.match(placement, {
    onNone: () => ({ model }),
    onSome: (placement) => ({
      model: { ...model, last: Option.some(placement) },
      outMessage: OutMessage.Moved({ placement }),
    }),
  });
};

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    Pressed: ({ handle, origin, direction, placement, camera }) => ({
      model: {
        ...withGizmo(
          model,
          pressGizmo(model.gizmo, placement, handle, { origin, direction }, camera),
        ),
        last: Option.none(),
      },
    }),
    Dragged: ({ origin, direction }) => dragged(model, origin, direction),
    Released: () => finished(model),
    Hovered: ({ handle }) => ({ model: withGizmo(model, hoverGizmo(model.gizmo, handle)) }),
    ChoseMode: ({ mode }) => ({ model: withGizmo(model, { ...model.gizmo, mode }) }),
    ChoseSpace: ({ space }) => ({ model: withGizmo(model, { ...model.gizmo, space }) }),
  });

/** Whether a hit `key` is one of this gizmo's handles, and which. */
export const handleOf = (model: Model, key: string): Option.Option<GizmoHandle> =>
  Option.fromNullishOr(gizmoHandleOf(model.key, key));

/** Whether the gizmo is held: the parent leaves the camera alone while it is. */
export const held = (model: Model): boolean => model.gizmo.grab !== null;

/** The handles for `placement`, seen from `camera`, for the parent's scene. */
export const nodes = (model: Model, placement: Placement, camera: Camera): SceneNode =>
  gizmoNodes(model.key, model.gizmo, placement, camera);
