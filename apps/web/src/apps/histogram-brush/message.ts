import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

/** Whether a pointer event landed on the histogram, by its wrapper's data-brush attribute. */
export const Surface = Schema.Literals(['histogram', 'outside']);
export type Surface = typeof Surface.Type;

export const Message = UiSchema.TaggedEnum({
  /** A pointer position, already in histogram plot pixels. */
  MovedPointer: { surface: Surface, x: Schema.Number },
  PressedPointer: { surface: Surface, x: Schema.Number },
  ReleasedPointer: {},
  ClearedBrush: {},
});
export type Message = typeof Message.Type;
