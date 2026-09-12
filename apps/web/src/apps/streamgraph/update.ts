import type { Return as UpdateReturn } from 'foldkit/update';

import * as StreamgraphChart from '../../ui/streamgraph-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotStreamgraphMessage: ({ message }) => {
      const { model: streamgraph } = StreamgraphChart.update(
        model.streamgraph,
        message as StreamgraphChart.Message,
      );
      return { model: { ...model, streamgraph } };
    },
  });
