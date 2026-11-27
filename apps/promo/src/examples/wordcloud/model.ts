import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { initialSettings, Metric, Settings, Word } from './domain';
export const Measurement = UiSchema.TaggedEnum({
  Loading: {},
  Ready: { words: Schema.Array(Metric) },
  Failed: { error: Schema.String },
});
export const Props = Schema.Struct({ words: Schema.Array(Word) });
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  words: Schema.Array(Word),
  settings: Settings,
  measurement: Measurement,
  revision: Schema.Number,
  width: Schema.Number,
  activeKey: Schema.NullOr(Schema.String),
});
export type Model = typeof Model.Type;
export const init = (props: Props): Model => ({
  ...props,
  settings: initialSettings,
  measurement: Measurement.Loading(),
  revision: 1,
  width: 700,
  activeKey: null,
});
