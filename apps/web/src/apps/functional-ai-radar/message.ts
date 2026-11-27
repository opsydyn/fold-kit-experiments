import { UiSchema } from '@effect/ui';
import { categoryIds, Ring } from '@opsydyn/effect-three-samples/radar/data';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  ChangedQuery: { query: Schema.String },
  ChangedCategory: { category: Schema.Literals([...categoryIds, 'all']) },
  ClickedRing: { ring: Ring },
  ClickedClearFilters: {},
  ClickedResetView: {},
  ClickedZoomIn: {},
  ClickedZoomOut: {},
  ClickedTurn: { direction: Schema.Literals(['east', 'west', 'north', 'south']) },
  PressedRadarKey: { key: Schema.String },
  ClickedBlip: { id: Schema.String, keyboard: Schema.Boolean },
  ClickedEntryRow: { id: Schema.String },
  StartedRadarPointer: {
    pointerId: Schema.Number,
    clientX: Schema.Number,
    clientY: Schema.Number,
    renderedBaseRadius: Schema.Number,
  },
  MovedRadarPointer: { pointerId: Schema.Number, clientX: Schema.Number, clientY: Schema.Number },
  EndedRadarPointer: { pointerId: Schema.Number },
});
export type Message = typeof Message.Type;
