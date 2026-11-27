import { UiSchema } from '@effect/ui';
import {
  categoryIds,
  Ring,
  ringIds,
  type RadarData,
} from '@opsydyn/effect-three-samples/radar/data';
import { Schema } from 'effect';

const Coordinate = Schema.Tuple([Schema.Number, Schema.Number]);
export const Selection = UiSchema.TaggedEnum({
  None: {},
  Selected: { id: Schema.String },
  Cleared: {},
});
export type Selection = typeof Selection.Type;
export const Gesture = UiSchema.TaggedEnum({
  Idle: { ignoreNextBlipClick: Schema.Boolean },
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
  query: Schema.String,
  category: Schema.Literals([...categoryIds, 'all']),
  enabledRings: Schema.Array(Ring),
  selection: Selection,
  gesture: Gesture,
});
export type Model = typeof State.Type & Readonly<{ data: RadarData }>;
export function initModel(data: RadarData): Model {
  return {
    data,
    center: [0, 20],
    zoom: 1,
    query: '',
    category: 'all',
    enabledRings: ringIds,
    selection: Selection.None(),
    gesture: Gesture.Idle({ ignoreNextBlipClick: false }),
  };
}
