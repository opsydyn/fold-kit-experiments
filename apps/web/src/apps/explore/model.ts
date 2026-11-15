import { Schema } from 'effect';

import type { AppInitProps } from '../types';

const Range = Schema.Tuple([Schema.Number, Schema.Number]);

/** The nearest request under the pointer, in scatter plot pixels, and its row. */
export const Hover = Schema.Struct({ x: Schema.Number, y: Schema.Number, row: Schema.Number });

export const Model = Schema.Struct({
  hover: Schema.NullOr(Hover),
  /** Histogram pixel where a brush drag began; null when not dragging. */
  dragFrom: Schema.NullOr(Schema.Number),
  /** The brush band in histogram pixels, drawn while dragging and after. */
  brushPixels: Schema.NullOr(Range),
  /** The latency range the brush selects, highlighted in the scatter. */
  brushed: Schema.NullOr(Range),
  /** The scatter's latency domain when zoomed; null shows everything. */
  domain: Schema.NullOr(Range),
});
export type Model = typeof Model.Type;

const initialModel: Model = {
  hover: null,
  dragFrom: null,
  brushPixels: null,
  brushed: null,
  domain: null,
};

export const init = (_props: AppInitProps) => ({ model: initialModel });
