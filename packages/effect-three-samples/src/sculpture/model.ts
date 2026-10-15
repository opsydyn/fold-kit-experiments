import { Schema } from 'effect';

import { Paint } from '../palette';

/** The pieces the sculpture is built from. */
export const Piece = Schema.Literals(['block', 'ball', 'drum']);
export type Piece = typeof Piece.Type;

export const pieces: ReadonlyArray<Piece> = Piece.literals;

export const Block = Schema.Struct({
  id: Schema.Number,
  x: Schema.Int,
  y: Schema.Int,
  z: Schema.Int,
  paint: Paint,
  piece: Piece,
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
  piece: Piece,
  nextId: Schema.Number,
});
export type Model = typeof Model.Type;

const seed: ReadonlyArray<Block> = [
  { id: 0, x: 0, y: 0, z: 0, paint: 'blue', piece: 'block' },
  { id: 1, x: 1, y: 0, z: 0, paint: 'gold', piece: 'drum' },
  { id: 2, x: 0, y: 1, z: 0, paint: 'coral', piece: 'ball' },
];

export const init = () => ({
  model: {
    blocks: seed,
    shown: seed.length,
    paint: 'mint',
    piece: 'block',
    nextId: seed.length,
  } satisfies Model,
});

/** The blocks currently shown. */
export const shownBlocks = (model: Model): ReadonlyArray<Block> =>
  model.blocks.slice(0, model.shown);
