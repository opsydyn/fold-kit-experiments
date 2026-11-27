import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Slide } from './model';

export const Message = UiSchema.TaggedEnum({
  LoadedSlides: { slides: Schema.Array(Slide) },
  PressedSlide: {},
  MovedDragPointer: { deltaX: Schema.Number },
  ReleasedDragPointer: {
    deltaX: Schema.Number,
    velocityX: Schema.Number,
    trackWidth: Schema.Number,
  },
  CancelledDrag: {},
  TickedSettle: { deltaTimeMs: Schema.Number },
  ClickedPrevious: {},
  ClickedNext: {},
  ClickedDot: { index: Schema.Number },
  PressedNavigationKey: { key: Schema.Literals(['ArrowLeft', 'ArrowRight']) },
});
export type Message = typeof Message.Type;
