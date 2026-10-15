import { Option, Schema } from 'effect';

import { Paint, paintAt } from '../palette';

export const Model = Schema.Struct({
  paints: Schema.Array(Paint),
  hovered: Schema.Option(Schema.Int),
});
export type Model = typeof Model.Type;

export const cubeCount = 9;

export const init = () => ({
  model: {
    paints: Array.from({ length: cubeCount }, (_, index) => paintAt(index)),
    hovered: Option.none(),
  } satisfies Model,
});
