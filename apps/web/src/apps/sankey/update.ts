import type { Return as UpdateReturn } from 'foldkit/update';

import * as SankeyChart from '../../ui/sankey-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedSankeyMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: sankey } = SankeyChart.update(model.sankey, message as SankeyChart.Message);
      return { model: { ...model, sankey } };
    },
  });
