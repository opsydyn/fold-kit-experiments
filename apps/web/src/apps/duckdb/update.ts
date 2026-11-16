import type { ManagedResource } from 'foldkit';
import type { Return as UpdateReturn } from 'foldkit/update';

import { RunQueries } from './command';
import { Message } from './message';
import type { Model } from './model';
import type { managedResources } from './resource';

/** Commands may use DuckDB, the page's managed resource. */
type Return = UpdateReturn<Model, Message, ManagedResource.ServicesOf<typeof managedResources>>;

const settled = (model: Model): Return => ({ model });

/** Ask DuckDB for both charts at the model's bins and kind. */
const query = (model: Model): Return => ({
  model: { ...model, querying: true },
  commands: [RunQueries({ bins: model.bins, kind: model.kind })],
});

const choose = (model: Model, next: Model): Return =>
  model.engine === 'ready' ? query(next) : settled(next);

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ClickedLoad: () =>
      model.engine === 'off' || model.engine === 'failed'
        ? settled({ ...model, engine: 'starting', failure: '' })
        : settled(model),
    AcquiredDuckDB: () => query({ ...model, engine: 'ready' }),
    FailedDuckDB: ({ reason }) =>
      settled({ ...model, engine: 'failed', failure: reason, querying: false }),
    ReleasedDuckDB: () =>
      settled(model.engine === 'failed' ? model : { ...model, engine: 'off', querying: false }),
    SelectedBins: ({ bins }) => choose(model, { ...model, bins }),
    SelectedKind: ({ kind }) => choose(model, { ...model, kind }),
    // An answer for bins or a kind since changed is stale: the newer query's answer follows.
    RanQueries: ({ ran }) =>
      ran.bins === model.bins && ran.kind === model.kind
        ? settled({ ...model, ran, querying: false, failure: '' })
        : settled(model),
    FailedQueries: ({ reason }) => settled({ ...model, querying: false, failure: reason }),
  });
