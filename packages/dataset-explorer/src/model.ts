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
  fixturesUrl: Schema.optional(Schema.String),
  sources: Schema.optional(Schema.Array(Source)),
});
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  chartWidth: Schema.Number,
  selected: DatasetId,
  transport: Transport,
  fixturesUrl: Schema.String,
  sources: Schema.Array(Source),
  activeFile: SourceName,
  nextRevision: Schema.Number,
  datasets: DatasetQuery.Model,
  trace: Schema.Array(ResponseFact),
});
export type Model = typeof Model.Type;
export const initModel: Model = {
  chartWidth: 920,
  selected: 'north',
  transport: 'api',
  fixturesUrl: '/datasets/',
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
    fixturesUrl: props.fixturesUrl ?? '/datasets/',
    sources: props.sources ?? [],
  });
