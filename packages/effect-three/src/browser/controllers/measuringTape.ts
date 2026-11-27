import { Option, Schema } from 'effect';

/** Framework-independent Three controller. */
import {
  clearTape,
  placeTapeEnd,
  pointTape,
  SceneSchema,
  type SceneNode,
  tape,
  tapeLength,
  type TapeLook,
  tapeNodes,
} from '../../index.ts';

export const Model = Schema.Struct({
  /** The key its nodes and label are drawn under. */
  key: Schema.String,
  tape: SceneSchema.Tape,
});
export type Model = typeof Model.Type;

export const MessageFields = {
  Placed: { point: SceneSchema.Vec3 },
  Pointed: { point: Schema.NullOr(SceneSchema.Vec3) },
  Cleared: {},
  ChoseSnap: { snap: SceneSchema.Tape.fields.snap },
} as const;
export const Message = Schema.TaggedUnion(MessageFields);
export type Message = typeof Message.Type;

export const OutMessageFields = {
  /** Both ends are placed: where, and how far apart. */
  Measured: { from: SceneSchema.Vec3, to: SceneSchema.Vec3, length: Schema.Finite },
} as const;
export const OutMessage = Schema.TaggedUnion(OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

/** An empty tape drawn under `key`, snapping to `snap` when given. */
export const init = (key: string, options: { readonly snap?: number | null } = {}): Model => ({
  key,
  tape: tape(options),
});

type Return = { readonly model: Model; readonly outMessage?: OutMessage };

/** The OutMessage for a tape that has just been measured, if it has. */
const measured = (next: Model): Return =>
  Option.match(
    Option.all([Option.fromNullishOr(next.tape.from), Option.fromNullishOr(next.tape.to)]),
    {
      onNone: () => ({ model: next }),
      onSome: ([from, to]) => ({
        model: next,
        outMessage: OutMessage.cases.Measured.make({
          from,
          to,
          length: tapeLength(next.tape) ?? 0,
        }),
      }),
    },
  );

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    Placed: ({ point }) => measured({ ...model, tape: placeTapeEnd(model.tape, point) }),
    Pointed: ({ point }) => ({ model: { ...model, tape: pointTape(model.tape, point) } }),
    Cleared: () => ({ model: { ...model, tape: clearTape(model.tape) } }),
    ChoseSnap: ({ snap }) => ({ model: { ...model, tape: { ...model.tape, snap } } }),
  });

/** The tape's length, while it has one (to the pointer while the second end is placed). */
export const length = (model: Model): Option.Option<number> =>
  Option.fromNullishOr(tapeLength(model.tape));

/** The tape, for the parent's scene. */
export const nodes = (model: Model, look: Partial<TapeLook> = {}): SceneNode =>
  tapeNodes(model.key, model.tape, look);
