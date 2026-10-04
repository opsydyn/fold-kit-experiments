import type { Return as UpdateReturn } from 'foldkit/update';

import * as ForceGraph from '../../ui/force-graph';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedGraphMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: graph } = ForceGraph.update(model.graph, message as ForceGraph.Message);
      return { model: { ...model, graph } };
    },
  });
