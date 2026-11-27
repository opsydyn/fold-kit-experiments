import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Slide = Schema.Struct({
  title: Schema.String,
  caption: Schema.String,
  bg: Schema.String,
});
export type Slide = typeof Slide.Type;

export const Drag = UiSchema.TaggedEnum({
  Idle: {},
  Dragging: {
    originIndex: Schema.Number,
    deltaX: Schema.Number,
  },
  Settling: {
    fromIndex: Schema.Number,
    targetIndex: Schema.Number,
    fromDeltaX: Schema.Number,
    elapsed: Schema.Number,
    duration: Schema.Number,
  },
});

export const Model = UiSchema.TaggedEnum({
  Loading: {},
  Loaded: {
    slides: Schema.Array(Slide),
    activeIndex: Schema.Number,
    drag: Drag,
  },
});
export type Model = typeof Model.Type;
export type Loaded = typeof Model.cases.Loaded.Type;
