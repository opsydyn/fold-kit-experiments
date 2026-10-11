import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Font, Metric, Spiral } from './domain';
export const Message = defineMessageUnion({
  SucceededMeasurement: { revision: Schema.Number, measurements: Schema.Array(Metric) },
  FailedMeasurement: { revision: Schema.Number, error: Schema.String },
  SelectedSpiral: { spiral: Spiral },
  SelectedFont: { font: Font },
  SelectedRotation: { rotate: Schema.Boolean },
  ChangedPadding: { value: Schema.String },
  ChangedSize: { value: Schema.String },
  RecordedWidth: { width: Schema.Number },
  InspectedWord: { key: Schema.String },
  ClickedRetry: {},
  ClickedReset: {},
});
export type Message = typeof Message.Type;
