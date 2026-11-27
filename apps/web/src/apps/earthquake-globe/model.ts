import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import type { SnapshotResult } from './data';

const Coordinate = Schema.Tuple([Schema.Number, Schema.Number]);
export const Gesture = UiSchema.TaggedEnum({
  Idle: { ignoreNextMarkerClick: Schema.Boolean },
  Dragging: {
    pointerId: Schema.Number,
    startX: Schema.Number,
    startY: Schema.Number,
    startCenter: Coordinate,
    renderedRadius: Schema.Number,
    maxDistance: Schema.Number,
  },
});
export type Gesture = typeof Gesture.Type;
export const State = Schema.Struct({
  center: Coordinate,
  zoom: Schema.Number,
  selectedId: Schema.NullOr(Schema.String),
  gesture: Gesture,
});
export type Model = typeof State.Type & Readonly<{ data: SnapshotResult }>;

export function initModel(data: SnapshotResult): Model {
  return {
    data,
    center: [-180, 0],
    zoom: 1,
    selectedId: null,
    gesture: Gesture.Idle({ ignoreNextMarkerClick: false }),
  };
}
