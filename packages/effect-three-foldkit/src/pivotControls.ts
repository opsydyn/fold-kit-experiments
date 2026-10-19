/**
 * Pivot controls as a Foldkit submodel (roadmap, "Beyond parity" 5): the core's pure
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
import {
  dragPivot,
  hoverPivot,
  type Pivot,
  pivot,
  type PivotHandle,
  pivotHandleOf,
  pivotNodes,
  type Placement,
  pressPivot,
  releasePivot,
  SceneSchema,
  type SceneNode,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { ReturnWithOutMessage } from 'foldkit/update';

export const Model = Schema.Struct({
  /** The key its handles are drawn under: `${key}:arrow-x`, `${key}:slider-z` and so on. */
  key: Schema.String,
  pivot: SceneSchema.Pivot,
  /** The placement the drag last reported, so `Released` can report where it ended. */
  last: Schema.Option(SceneSchema.Placement),
});
export type Model = typeof Model.Type;

const Handle = SceneSchema.PivotHandle;

export const Message = defineMessageUnion({
  Pressed: { handle: Handle, point: SceneSchema.Vec3, placement: SceneSchema.Placement },
  Dragged: { origin: SceneSchema.Vec3, direction: SceneSchema.Vec3, snap: Schema.Boolean },
  Released: {},
  Hovered: { handle: Schema.NullOr(Handle) },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** The object's placement now, during a drag. */
  Moved: { placement: SceneSchema.Placement },
  /** The drag is over, the object here: a step for history. */
  Finished: { placement: SceneSchema.Placement },
});
export type OutMessage = typeof OutMessage.Type;

/** Pivot controls drawn under `key`, with Drei's defaults or the options given. */
export const init = (key: string, options: Parameters<typeof pivot>[0] = {}): Model => ({
  key,
  pivot: pivot(options),
  last: Option.none(),
});

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

const withPivot = (model: Model, next: Pivot): Model => ({ ...model, pivot: next });

const finished = (model: Model): Return => ({
  model: { ...withPivot(model, releasePivot(model.pivot)), last: Option.none() },
  ...Option.match(model.last, {
    onNone: () => ({}),
    onSome: (placement) => ({ outMessage: OutMessage.Finished({ placement }) }),
  }),
});

const dragged = (model: Model, origin: Vec3, direction: Vec3, snap: boolean): Return => {
  const placement = Option.fromNullishOr(dragPivot(model.pivot, { origin, direction }, { snap }));
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
    Pressed: ({ handle, point, placement }) => ({
      model: {
        ...withPivot(model, pressPivot(model.pivot, placement, handle, point)),
        last: Option.none(),
      },
    }),
    Dragged: ({ origin, direction, snap }) => dragged(model, origin, direction, snap),
    Released: () => finished(model),
    Hovered: ({ handle }) => ({ model: withPivot(model, hoverPivot(model.pivot, handle)) }),
  });

/** Whether a hit `key` is one of these controls' handles, and which. */
export const handleOf = (model: Model, key: string): Option.Option<PivotHandle> =>
  Option.fromNullishOr(pivotHandleOf(model.key, key));

/** Whether a handle is held: the parent leaves the camera alone while it is. */
export const held = (model: Model): boolean => model.pivot.grab !== null;

/** The handles for `placement`, for the parent's scene. */
export const nodes = (model: Model, placement: Placement): SceneNode =>
  pivotNodes(model.key, model.pivot, placement);
