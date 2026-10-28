import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import { categoryIds, loadDemoRadar, Ring, ringIds, type RadarData } from '../three/data';

/** The 2D radar seeds its own model; it takes no props yet. */
interface AppInitProps {}

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
export function init(_props: AppInitProps) {
  return { model: initModel(loadDemoRadar()) };
}
