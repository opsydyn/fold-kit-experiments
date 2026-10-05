import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';
import type { Return } from 'foldkit/update';

import { MeasureWords } from './command';
import { initialSettings, Metric, Settings, Word } from './domain';
import type { Message } from './message';
export const Measurement = defineTaggedUnion({
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
export const init = (
  props: Props,
): Return<Model, Message> & {
  readonly commands: NonNullable<Return<Model, Message>['commands']>;
} => ({
  model: {
    ...props,
    settings: initialSettings,
    measurement: Measurement.Loading(),
    revision: 1,
    width: 700,
    activeKey: null,
  },
  commands: [MeasureWords({ revision: 1, words: props.words, settings: initialSettings })],
});
