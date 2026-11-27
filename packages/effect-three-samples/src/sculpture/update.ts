import { Array as Arr, Match, Option, Struct } from 'effect';

import type { Message } from './message';
import { type Block, type Model, shownBlocks } from './model';
import { half } from './scene';

type AppReturn = { readonly model: Model };

const clamp = (value: number): number => Math.max(-half, Math.min(half, Math.round(value)));

/** The grid column a click lands in: the clicked block's own column, or the ground cell. */
const columnFor = (model: Model, key: string, x: number, z: number) =>
  Option.match(
    Arr.findFirst(shownBlocks(model), (block) => `block-${block.id}` === key),
    {
      onNone: () => ({ x: clamp(x), z: clamp(z) }),
      onSome: (block) => ({ x: block.x, z: block.z }),
    },
  );

/** Stacks a block on top of a column, discarding any history after the shown point. */
const place = (model: Model, key: string, x: number, z: number): Model => {
  const column = columnFor(model, key, x, z);
  const shown = shownBlocks(model);
  const height = shown.filter((block) => block.x === column.x && block.z === column.z).length;
  const block: Block = {
    id: model.nextId,
    ...column,
    y: height,
    paint: model.paint,
    piece: model.piece,
  };
  return { ...model, blocks: [...shown, block], shown: shown.length + 1, nextId: model.nextId + 1 };
};

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      ClickedSurface: ({ key, x, z }) => ({ model: place(model, key, x, z) }),
      ClickedPaint: ({ paint }) => ({ model: Struct.evolve(model, { paint: () => paint }) }),
      ClickedPiece: ({ piece }) => ({ model: Struct.evolve(model, { piece: () => piece }) }),
      ChangedHistory: ({ shown }) => ({
        model: Struct.evolve(model, {
          shown: () => Math.max(0, Math.min(model.blocks.length, shown)),
        }),
      }),
      ClickedUndo: () => ({
        model: Struct.evolve(model, { shown: (shown) => Math.max(0, shown - 1) }),
      }),
      ClickedRedo: () => ({
        model: Struct.evolve(model, { shown: (shown) => Math.min(model.blocks.length, shown + 1) }),
      }),
      ClickedClear: () => ({ model: { ...model, blocks: [], shown: 0 } }),
      ReceivedSceneLifecycle: () => ({ model }),
    }),
  );
