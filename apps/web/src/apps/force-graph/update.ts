import { Match } from 'effect';
import * as ForceGraph from '../../ui/force-graph';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotGraphMessage: ({ message }) => {
        const [graph] = ForceGraph.update(model.graph, message as ForceGraph.Message);
        return [{ ...model, graph }, []];
      },
    }),
  );
