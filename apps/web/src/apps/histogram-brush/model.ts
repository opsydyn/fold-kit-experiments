import { Schema } from 'effect';

const Range = Schema.Tuple([Schema.Number, Schema.Number]);

export const Model = Schema.Struct({
  /** Histogram pixel where a brush drag began; null when not dragging. */
  dragFrom: Schema.NullOr(Schema.Number),
  /** The brush band in histogram pixels, drawn while dragging and after. */
  brushPixels: Schema.NullOr(Range),
  /** The response-time range the brush selects, snapped to bin edges. */
  brushed: Schema.NullOr(Range),
});
export type Model = typeof Model.Type;

export const init: Model = { dragFrom: null, brushPixels: null, brushed: null };
