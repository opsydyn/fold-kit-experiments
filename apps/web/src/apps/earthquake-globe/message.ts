import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  ClickedZoomIn: {},
  ClickedZoomOut: {},
  ClickedReset: {},
  ClickedTurn: { direction: Schema.Literals(['east', 'west', 'north', 'south']) },
  PressedGlobeKey: { key: Schema.String },
  ClickedMarker: { id: Schema.String, keyboard: Schema.Boolean },
  ClickedEventRow: { id: Schema.String },
  StartedGlobePointer: {
    pointerId: Schema.Number,
    clientX: Schema.Number,
    clientY: Schema.Number,
    renderedBaseRadius: Schema.Number,
  },
  MovedGlobePointer: { pointerId: Schema.Number, clientX: Schema.Number, clientY: Schema.Number },
  EndedGlobePointer: { pointerId: Schema.Number },
});
export type Message = typeof Message.Type;
