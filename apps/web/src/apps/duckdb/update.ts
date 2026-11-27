import { Message } from './message';
import type { Model } from './model';

const choose = (model: Model, next: Model): Model =>
  model.engine === 'ready'
    ? { ...next, revision: model.revision + 1, failure: '', querying: true }
    : next;

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    ClickedLoad: () =>
      model.engine === 'off' || model.engine === 'failed'
        ? { ...model, engine: 'starting' as const, failure: '', revision: model.revision + 1 }
        : model,
    AcquiredDuckDB: () =>
      model.engine === 'starting' ? { ...model, engine: 'ready' as const, querying: true } : model,
    FailedDuckDB: ({ reason }) => ({
      ...model,
      engine: 'failed' as const,
      failure: reason,
      querying: false,
    }),
    SelectedBins: ({ bins }) => choose(model, { ...model, bins }),
    SelectedKind: ({ kind }) => choose(model, { ...model, kind }),
    RanQueries: ({ revision, ran }) =>
      revision === model.revision && ran.bins === model.bins && ran.kind === model.kind
        ? { ...model, ran, querying: false, failure: '' }
        : model,
    FailedQueries: ({ revision, reason }) =>
      revision === model.revision ? { ...model, querying: false, failure: reason } : model,
  });
