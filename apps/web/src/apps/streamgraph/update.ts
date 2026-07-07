import { Match } from 'effect';
import * as StreamgraphChart from '../../ui/streamgraph-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotStreamgraphMessage: ({ message }) => {
        const [streamgraph] = StreamgraphChart.update(
          model.streamgraph,
          message as StreamgraphChart.Message,
        );
        return [{ ...model, streamgraph }, []];
      },
    }),
  );
