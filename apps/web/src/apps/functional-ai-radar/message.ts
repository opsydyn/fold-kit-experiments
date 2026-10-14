import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { categoryIds, Ring } from './data';

export const Message = defineMessageUnion({
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
  CompletedRadarPointerMount: {},
});
export type Message = typeof Message.Type;
