import { Schema } from 'effect';

import { DatasetId } from './data';
import { DatasetQuery } from './query';
import { loadSelected } from './update';

export const ResponseFact = Schema.Struct({
  dataset: DatasetId,
  revision: Schema.Number,
  outcome: Schema.Literals(['accepted', 'failed', 'ignored']),
});
export const Model = Schema.Struct({
  selected: DatasetId,
  nextRevision: Schema.Number,
  datasets: DatasetQuery.Model,
  trace: Schema.Array(ResponseFact),
});
export type Model = typeof Model.Type;
export const initModel: Model = {
  selected: 'north',
  nextRevision: 1,
  datasets: DatasetQuery.init(),
  trace: [],
};
export const init = () => loadSelected(initModel);
