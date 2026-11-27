import { Schema } from 'effect';

export const Model = Schema.Struct({
  /** How far the map is zoomed in; 1 shows the whole world. */
  zoom: Schema.Number,
  /** The longitude and latitude at the middle of the map. */
  center: Schema.Tuple([Schema.Number, Schema.Number]),
});
export type Model = typeof Model.Type;

export const initialModel: Model = { zoom: 1, center: [10, 20] };
