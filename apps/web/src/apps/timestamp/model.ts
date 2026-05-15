import { Schema } from 'effect';

export const Iso8601 = Schema.String.pipe(Schema.brand('Iso8601'));
export type Iso8601 = typeof Iso8601.Type;

export const Model = Schema.Struct({
  startedAt: Iso8601,
  elapsedMs: Schema.Number,
});
export type Model = typeof Model.Type;

const Props = Schema.Struct({ startedAt: Iso8601 });

export const init = (props: unknown): readonly [Model, readonly []] => {
  const { startedAt } = Schema.decodeUnknownSync(Props)(props);
  return [{ startedAt, elapsedMs: 0 }, []];
};
