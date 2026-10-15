import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option, Schema } from 'effect';

import { Paint, paintAt } from '../palette';

export const Cube = Schema.Struct({ key: Schema.String, paint: Paint });
export type Cube = typeof Cube.Type;

export const Model = Schema.Struct({
  left: Schema.Array(Cube),
  right: Schema.Array(Cube),
  nextId: Schema.Number,
  hovered: Schema.Option(Schema.String),
  last: Schema.Option(EffectThreeFoldkit.ReconciledDetail),
});
export type Model = typeof Model.Type;

/** A new cube with a stable key: its three.js object lives exactly as long as the key does. */
export const cubeNumbered = (id: number): Cube => ({ key: `cube-${id}`, paint: paintAt(id) });

export const init = () => ({
  model: {
    left: [0, 1, 2, 3, 4].map(cubeNumbered),
    right: [5, 6].map(cubeNumbered),
    nextId: 7,
    hovered: Option.none(),
    last: Option.none(),
  } satisfies Model,
});
