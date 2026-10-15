import { Schema } from 'effect';

import { Paint } from '../palette';

export const Block = Schema.Struct({
  id: Schema.Number,
  x: Schema.Int,
  y: Schema.Int,
  z: Schema.Int,
  paint: Paint,
});
export type Block = typeof Block.Type;

/**
 * Every block ever placed, in order, and how many of them are shown. Scrubbing `shown`
 * back replays the build; placing a block while scrubbed back discards the later ones.
 */
export const Model = Schema.Struct({
  blocks: Schema.Array(Block),
  shown: Schema.Int,
  paint: Paint,
  nextId: Schema.Number,
});
export type Model = typeof Model.Type;

const seed: ReadonlyArray<Block> = [
  { id: 0, x: 0, y: 0, z: 0, paint: 'blue' },
  { id: 1, x: 1, y: 0, z: 0, paint: 'gold' },
  { id: 2, x: 0, y: 1, z: 0, paint: 'coral' },
];

export const init = () => ({
  model: { blocks: seed, shown: seed.length, paint: 'mint', nextId: seed.length } satisfies Model,
});

/** The blocks currently shown. */
export const shownBlocks = (model: Model): ReadonlyArray<Block> =>
  model.blocks.slice(0, model.shown);
