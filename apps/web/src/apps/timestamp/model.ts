import { Schema } from 'effect';

export const Iso8601 = Schema.String.pipe(Schema.brand('Iso8601'));
export type Iso8601 = typeof Iso8601.Type;

export const Model = Schema.Struct({
  startedAt: Iso8601,
  elapsedMs: Schema.Number,
  localStart: Schema.NullOr(Schema.String),
});
export type Model = typeof Model.Type;

export const Props = Schema.Struct({ startedAt: Iso8601 });
export type InitProps = typeof Props.Type;

export const init = ({ startedAt }: InitProps): Model => ({
  startedAt,
  elapsedMs: 0,
  localStart: null,
});
