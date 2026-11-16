import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

/** Which chart a pointer event landed on, by the wrapper's data-explore attribute. */
export const Surface = Schema.Literals(['scatter', 'histogram', 'outside']);
export type Surface = typeof Surface.Type;

export const Message = defineMessageUnion({
  /** A pointer position, already in the surface's plot pixels. */
  MovedPointer: { surface: Surface, x: Schema.Number, y: Schema.Number },
  PressedPointer: { surface: Surface, x: Schema.Number },
  ReleasedPointer: {},
  ZoomedIn: {},
  ZoomedOut: {},
  ResetView: {},
  PaintedScatter: { key: Schema.String },
  MountedPointsLayer: {},
  FailedPointsLayer: { reason: Schema.String },
  HighlightedScatter: {},
});
export type Message = typeof Message.Type;
