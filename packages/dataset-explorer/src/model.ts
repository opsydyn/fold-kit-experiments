import { Schema } from 'effect';

import { DatasetId, Transport } from './data';
import { DatasetQuery } from './query';
import { Source, SourceName } from './source';
import { loadSelected } from './update';

export const ResponseFact = Schema.Struct({
  dataset: DatasetId,
  revision: Schema.Number,
  outcome: Schema.Literals(['accepted', 'failed', 'ignored']),
});
export const Props = Schema.Struct({
  transport: Schema.optional(Transport),
  sources: Schema.optional(Schema.Array(Source)),
});
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  selected: DatasetId,
  transport: Transport,
  sources: Schema.Array(Source),
  activeFile: SourceName,
  nextRevision: Schema.Number,
  datasets: DatasetQuery.Model,
  trace: Schema.Array(ResponseFact),
});
export type Model = typeof Model.Type;
export const initModel: Model = {
  selected: 'north',
  transport: 'api',
  sources: [],
  activeFile: 'query.ts',
  nextRevision: 1,
  datasets: DatasetQuery.init(),
  trace: [],
};
export const init = (props: Props = {}) =>
  loadSelected({
    ...initModel,
    transport: props.transport ?? 'api',
    sources: props.sources ?? [],
  });
