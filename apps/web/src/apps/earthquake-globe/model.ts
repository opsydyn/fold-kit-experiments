import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import type { AppInitProps } from '../types';
import { loadBundledSnapshot, type SnapshotResult } from './data';

const Coordinate = Schema.Tuple([Schema.Number, Schema.Number]);
export const Gesture = defineTaggedUnion({
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
export const Model = Schema.Struct({
  data: Schema.Unknown,
  center: Coordinate,
  zoom: Schema.Number,
  selectedId: Schema.NullOr(Schema.String),
  gesture: Gesture,
});
export type Model = Readonly<{
  data: SnapshotResult;
  center: readonly [number, number];
  zoom: number;
  selectedId: string | null;
  gesture: Gesture;
}>;

export function initModel(data: SnapshotResult): Model {
  return {
    data,
    center: [-180, 0],
    zoom: 1,
    selectedId: null,
    gesture: Gesture.Idle({ ignoreNextMarkerClick: false }),
  };
}
export function init(_props: AppInitProps) {
  return { model: initModel(loadBundledSnapshot()) };
}
