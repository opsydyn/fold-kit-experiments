import type { Return as UpdateReturn } from 'foldkit/update';

import * as SankeyChart from '../../ui/sankey-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotSankeyMessage: ({ message }) => {
      const { model: sankey } = SankeyChart.update(model.sankey, message as SankeyChart.Message);
      return { model: { ...model, sankey } };
    },
  });
