import { Option, Schema } from 'effect';

/** Framework-independent Three controller. */
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
} from '../../index.ts';

export const Model = Schema.Struct({
  /** The key its handles are drawn under: `${key}:arrow-x`, `${key}:slider-z` and so on. */
  key: Schema.String,
  pivot: SceneSchema.Pivot,
  /** The placement the drag last reported, so `Released` can report where it ended. */
  last: Schema.Option(SceneSchema.Placement),
});
export type Model = typeof Model.Type;

const Handle = SceneSchema.PivotHandle;

export const MessageFields = {
  Pressed: { handle: Handle, point: SceneSchema.Vec3, placement: SceneSchema.Placement },
  Dragged: { origin: SceneSchema.Vec3, direction: SceneSchema.Vec3, snap: Schema.Boolean },
  Released: {},
  Hovered: { handle: Schema.NullOr(Handle) },
} as const;
export const Message = Schema.TaggedUnion(MessageFields);
export type Message = typeof Message.Type;

export const OutMessageFields = {
  /** The object's placement now, during a drag. */
  Moved: { placement: SceneSchema.Placement },
  /** The drag is over, the object here: a step for history. */
  Finished: { placement: SceneSchema.Placement },
} as const;
export const OutMessage = Schema.TaggedUnion(OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

/** Pivot controls drawn under `key`, with Drei's defaults or the options given. */
export const init = (key: string, options: Parameters<typeof pivot>[0] = {}): Model => ({
  key,
  pivot: pivot(options),
  last: Option.none(),
});

type Return = { readonly model: Model; readonly outMessage?: OutMessage };

const withPivot = (model: Model, next: Pivot): Model => ({ ...model, pivot: next });

const finished = (model: Model): Return => ({
  model: { ...withPivot(model, releasePivot(model.pivot)), last: Option.none() },
  ...Option.match(model.last, {
    onNone: () => ({}),
    onSome: (placement) => ({ outMessage: OutMessage.cases.Finished.make({ placement }) }),
  }),
});

const dragged = (model: Model, origin: Vec3, direction: Vec3, snap: boolean): Return => {
  const placement = Option.fromNullishOr(dragPivot(model.pivot, { origin, direction }, { snap }));
  return Option.match(placement, {
    onNone: () => ({ model }),
    onSome: (placement) => ({
      model: { ...model, last: Option.some(placement) },
      outMessage: OutMessage.cases.Moved.make({ placement }),
    }),
  });
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
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
