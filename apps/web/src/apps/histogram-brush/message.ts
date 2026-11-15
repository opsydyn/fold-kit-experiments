import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

/** Whether a pointer event landed on the histogram, by its wrapper's data-brush attribute. */
export const Surface = Schema.Literals(['histogram', 'outside']);
export type Surface = typeof Surface.Type;

export const Message = defineMessageUnion({
  /** A pointer position, already in histogram plot pixels. */
  MovedPointer: { surface: Surface, x: Schema.Number },
  PressedPointer: { surface: Surface, x: Schema.Number },
  ReleasedPointer: {},
  ClearedBrush: {},
});
export type Message = typeof Message.Type;
