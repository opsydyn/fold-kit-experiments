import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import {
  categoryIds,
  decodeRadarDataset,
  Ring,
  ringIds,
  type RadarData,
  type RadarDataset,
} from '../three/data';

/** What the host page hands the 2D radar: the radar to draw. */
export type FlatRadarProps = Readonly<{ dataset: RadarDataset }>;

const Coordinate = Schema.Tuple([Schema.Number, Schema.Number]);
export const Selection = defineTaggedUnion({
  None: {},
  Selected: { id: Schema.String },
  Cleared: {},
});
export type Selection = typeof Selection.Type;
export const Gesture = defineTaggedUnion({
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
export const Model = Schema.Struct({
  data: Schema.Unknown,
  center: Coordinate,
  zoom: Schema.Number,
  query: Schema.String,
  category: Schema.Literals([...categoryIds, 'all']),
  enabledRings: Schema.Array(Ring),
  selection: Selection,
  gesture: Gesture,
});
export type Model = Omit<typeof Model.Type, 'data'> & Readonly<{ data: RadarData }>;
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
export function init(props: FlatRadarProps) {
  return { model: initModel(decodeRadarDataset(props.dataset)) };
}
